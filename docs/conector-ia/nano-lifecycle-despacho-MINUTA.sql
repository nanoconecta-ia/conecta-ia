-- MINUTA somente CI descartável. Não habilita worker, cron ou gastos.
begin;
alter table public.nano_lifecycle_checkpoint add column despacho_habilitado boolean not null default false;
-- O serviço não recebe UPDATE desta coluna: ativação é decisão administrativa.
create function public.nano_lifecycle_encaminhar(p_loja uuid,p_revisao text,p_chave text)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare cp public.nano_lifecycle_checkpoint; e jsonb; atual jsonb; snap jsonb; item public.pipeline_itens; entrada jsonb; pid uuid; novo uuid; ultima text; n integer; raiz text; resto numeric;
begin
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 if exists(select 1 from public.nano_lifecycle_reserva where loja_id=p_loja and not encerrada and expira_em>clock_timestamp()) then return jsonb_build_object('estado','sync_em_andamento'); end if;
 select v into e from public.nano_lifecycle_capturas c cross join lateral jsonb_array_elements(c.eventos) v where c.loja_id=p_loja and c.revisao=p_revisao and v->>'idempotency_key'=p_chave;
 if not found then return jsonb_build_object('estado','evento_inexistente'); end if;
 pid:=(e->>'produto_id')::uuid;
 -- Cadeia do checkpoint: procura última alteração/bloqueio relevante ao produto.
 -- Limite explícito: não conclui com histórico truncado.
 with recursive cadeia as (
  select revisao,predecessor,eventos,bloqueios,1 as nivel from public.nano_lifecycle_capturas where loja_id=p_loja and revisao=cp.revisao
  union all
  select c.revisao,c.predecessor,c.eventos,c.bloqueios,a.nivel+1 from public.nano_lifecycle_capturas c join cadeia a on c.revisao=a.predecessor where c.loja_id=p_loja and a.nivel<5000
 )
 select (select revisao from cadeia where exists(select 1 from jsonb_array_elements(eventos) v where v->>'produto_id'=pid::text) or exists(select 1 from jsonb_array_elements(bloqueios) v where v->>'produto_id'=pid::text) order by nivel limit 1), (select count(*) from cadeia), (select revisao from cadeia where predecessor is null limit 1) into ultima,n,raiz;
 if n=0 or raiz is null or ultima is distinct from p_revisao then return jsonb_build_object('estado','revisao_a_reconciliar'); end if;
 select v into atual from jsonb_array_elements(public.nano_lifecycle_projecao(p_loja)) v where v->>'id'=pid::text;
 select v into snap from public.nano_lifecycle_snapshots s cross join lateral jsonb_array_elements(s.produtos) v where s.loja_id=p_loja and s.revisao=cp.revisao and v->>'id'=pid::text;
 if atual is null or snap is null or atual is distinct from snap or atual->>'bling_id' is distinct from e->>'bling_id' or btrim(atual->>'sku') is distinct from e->>'sku' then return jsonb_build_object('estado','identidade_a_revisar'); end if;
 if exists(select 1 from public.produtos p where p.loja_id=p_loja and p.id<>pid and (p.bling_id=e->>'bling_id' or upper(btrim(p.sku))=upper(e->>'sku'))) then return jsonb_build_object('estado','identidade_a_revisar'); end if;
 if e->>'destino'='revisao_inativacao' then return jsonb_build_object('estado','revisar_inativacao'); end if;
 if atual->>'situacao' is distinct from 'A' then return jsonb_build_object('estado','inativo'); end if;
 -- Prototipo de exclusão com escritores legados: bloqueios breves, NOWAIT.
 -- Nenhum acesso remoto enquanto o lock estiver mantido.
 begin
  lock table public.produto_automacao in share mode nowait;
  lock table public.pipeline_itens in share row exclusive mode nowait;
 exception when lock_not_available then return jsonb_build_object('estado','ocupado'); end;
 if exists(select 1 from public.produto_automacao where loja_id=p_loja and produto_id=pid and pausado) then return jsonb_build_object('estado','pausado'); end if;
 entrada:=jsonb_build_object('origem','nano_lifecycle','revisao',p_revisao,'tipo',e->>'tipo','campos',e->'campos');
 select * into item from public.pipeline_itens where loja_id=p_loja and idempotency_key=p_chave;
 if found then
  if item.produto_id is distinct from pid or item.sku is distinct from e->>'sku' or item.entrada is distinct from entrada then return jsonb_build_object('estado','conflito_idempotencia'); end if;
  return jsonb_build_object('estado','ja_encaminhado','item_id',item.id);
 end if;
 if exists(select 1 from public.pipeline_itens where loja_id=p_loja and estado not in ('sincronizado','rejeitado','falhou') and (produto_id=pid or upper(btrim(sku))=upper(e->>'sku'))) then return jsonb_build_object('estado','pipeline_ativo_aguardar'); end if;
 resto:=(public.pipeline_orcamento_estado(p_loja)->>'restante_usd')::numeric;
 if resto is null or resto<=0 then return jsonb_build_object('estado','orcamento_indisponivel'); end if;
 novo:=public.pipeline_criar(p_loja,e->>'sku',pid,entrada,p_chave);
 select * into item from public.pipeline_itens where id=novo and loja_id=p_loja;
 if not found or item.produto_id is distinct from pid or item.sku is distinct from e->>'sku' or item.entrada is distinct from entrada or item.idempotency_key is distinct from p_chave then raise exception 'retorno de pipeline divergente'; end if;
 return jsonb_build_object('estado','encaminhado','item_id',novo);
end $fn$;
revoke all on function public.nano_lifecycle_encaminhar(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_encaminhar(uuid,text,text) to service_role;
commit;
