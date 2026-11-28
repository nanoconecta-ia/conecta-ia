-- MINUTA exclusiva de PostgreSQL descartável. Autoridade separada de despacho.
begin;
create role nano_lifecycle_despachante nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,nano_lifecycle_interno to nano_lifecycle_despachante;
grant create on schema nano_lifecycle_interno to nano_lifecycle_despachante;
grant select,update(atualizado_em) on public.nano_lifecycle_checkpoint to nano_lifecycle_despachante;
grant select on public.nano_lifecycle_reserva,public.nano_lifecycle_capturas,public.nano_lifecycle_snapshots,public.produtos to nano_lifecycle_despachante;
-- UPDATE é necessário para LOCK TABLE; políticas restritivas impedem DML.
grant select,update on public.pipeline_itens,public.produto_automacao to nano_lifecycle_despachante;
grant insert(loja_id,produto_id,sku,entrada,idempotency_key) on public.pipeline_itens to nano_lifecycle_despachante;
grant select,insert(item_id,loja_id,de,para,ator) on public.pipeline_historico to nano_lifecycle_despachante;
grant usage on sequence public.pipeline_historico_id_seq to nano_lifecycle_despachante;
grant execute on function public.nano_lifecycle_projecao(uuid),public.pipeline_orcamento_estado(uuid) to nano_lifecycle_despachante;
create policy nano_despachante_ler on public.nano_lifecycle_checkpoint for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.nano_lifecycle_checkpoint as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.nano_lifecycle_reserva for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.nano_lifecycle_reserva as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.nano_lifecycle_capturas for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.nano_lifecycle_capturas as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.nano_lifecycle_snapshots for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.nano_lifecycle_snapshots as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.produtos for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.produtos as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.pipeline_itens for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.pipeline_itens as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.produto_automacao for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.produto_automacao as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_ler on public.pipeline_historico for select to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_escopo on public.pipeline_historico as restrictive for all to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_lock on public.nano_lifecycle_checkpoint for update to nano_lifecycle_despachante using (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.dispatch_loja',true),''));
create policy nano_despachante_nao_update on public.pipeline_itens as restrictive for update to nano_lifecycle_despachante using(false) with check(false);
create policy nano_despachante_nao_update on public.produto_automacao as restrictive for update to nano_lifecycle_despachante using(false) with check(false);
create policy nano_despachante_inserir on public.pipeline_itens for insert to nano_lifecycle_despachante with check(entrada->>'origem'='nano_lifecycle' and idempotency_key~'^nano-lifecycle:[0-9a-f]{64}$');
create policy nano_despachante_inserir on public.pipeline_historico for insert to nano_lifecycle_despachante with check(de is null and para='entrada' and ator='sistema' and not por_humano);
create function nano_lifecycle_interno.nano_lifecycle_despachar(p_loja uuid,p_revisao text,p_chave text)
returns jsonb language plpgsql security definer set search_path='' set nano.dispatch_loja='' as $fn$
declare cp public.nano_lifecycle_checkpoint; e jsonb; atual jsonb; snap jsonb; item public.pipeline_itens; entrada jsonb; pid uuid; novo uuid; ultima text; n integer; raiz text; resto numeric;
begin
 perform set_config('nano.dispatch_loja',coalesce(p_loja::text,''),true);
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
 insert into public.pipeline_itens(loja_id,produto_id,sku,entrada,idempotency_key) values(p_loja,pid,e->>'sku',entrada,p_chave) returning id into novo;
 insert into public.pipeline_historico(item_id,loja_id,de,para,ator) values(novo,p_loja,null,'entrada','sistema');
 select * into item from public.pipeline_itens where id=novo and loja_id=p_loja;
 if not found or item.produto_id is distinct from pid or item.sku is distinct from e->>'sku' or item.entrada is distinct from entrada or item.idempotency_key is distinct from p_chave then raise exception 'retorno de pipeline divergente'; end if;
 return jsonb_build_object('estado','encaminhado','item_id',novo);
end $fn$;

alter function nano_lifecycle_interno.nano_lifecycle_despachar(uuid,text,text) owner to nano_lifecycle_despachante;
revoke all on function nano_lifecycle_interno.nano_lifecycle_despachar(uuid,text,text) from public,anon,authenticated,service_role,nano_lifecycle_consumidor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_despachar(uuid,text,text) to service_role,nano_lifecycle_consumidor;
create or replace function public.nano_lifecycle_encaminhar(p_loja uuid,p_revisao text,p_chave text)
returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_despachar(p_loja,p_revisao,p_chave)
$fn$;
revoke all on function public.nano_lifecycle_encaminhar(uuid,text,text) from public,anon,authenticated;
grant execute on function public.nano_lifecycle_encaminhar(uuid,text,text) to service_role,nano_lifecycle_consumidor;
revoke execute on function public.pipeline_criar(uuid,text,uuid,jsonb,text) from nano_lifecycle_consumidor;
create or replace function public.pipeline_criar(p_loja uuid, p_sku text, p_produto uuid, p_entrada jsonb, p_idem text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if lower(btrim(coalesce(p_entrada->>'origem','')))='nano_lifecycle' or lower(btrim(coalesce(p_idem,''))) like 'nano-lifecycle:%' then raise exception 'namespace Nano exclusivo do despachante' using errcode='42501'; end if;
  if p_produto is not null and not exists (select 1 from public.produtos where id = p_produto and loja_id = p_loja) then
    raise exception 'produto não pertence à loja' using errcode = '42501';
  end if;
  select id into v_id from public.pipeline_itens where loja_id = p_loja and idempotency_key = p_idem;
  if v_id is not null then
    if exists(select 1 from public.pipeline_itens where id=v_id and entrada->>'origem'='nano_lifecycle') then raise exception 'tarefa Nano exige despachante' using errcode='42501'; end if;
    return v_id;
  end if;
  select id into v_id from public.pipeline_itens where loja_id = p_loja and sku = p_sku and estado not in ('sincronizado', 'rejeitado', 'falhou');
  if v_id is not null then
    if exists(select 1 from public.pipeline_itens where id=v_id and entrada->>'origem'='nano_lifecycle') then raise exception 'tarefa Nano exige despachante' using errcode='42501'; end if;
    return v_id;
  end if;                        -- já existe item ativo para este SKU: não duplica
  insert into public.pipeline_itens (loja_id, produto_id, sku, entrada, idempotency_key) values (p_loja, p_produto, nullif(btrim(p_sku), ''), coalesce(p_entrada, '{}'::jsonb), p_idem)
    returning id into v_id;
  insert into public.pipeline_historico (item_id, loja_id, de, para, ator) values (v_id, p_loja, null, 'entrada', 'sistema');
  return v_id;
end $$;


-- Namespace reservado também para DML direto, inclusive disfarce em chave legada.
create function nano_lifecycle_interno.proteger_origem_fila() returns trigger
language plpgsql security invoker set search_path='' as $fn$
declare velho boolean:=false; novo boolean:=false;
begin
 if tg_op<>'INSERT' then velho:=coalesce(lower(btrim(old.entrada->>'origem'))='nano_lifecycle',false) or lower(btrim(old.idempotency_key)) like 'nano-lifecycle:%'; end if;
 if tg_op<>'DELETE' then novo:=coalesce(lower(btrim(new.entrada->>'origem'))='nano_lifecycle',false) or lower(btrim(new.idempotency_key)) like 'nano-lifecycle:%'; end if;
 if tg_op='DELETE' then
  if velho then raise exception 'exclusão Nano, inclusive cascata, bloqueada' using errcode='42501'; end if;
  return old;
 elsif tg_op='INSERT' and novo then
  if current_user<>'nano_lifecycle_despachante' or new.loja_id::text is distinct from current_setting('nano.dispatch_loja',true) or new.entrada->>'origem' is distinct from 'nano_lifecycle' or new.idempotency_key !~ '^nano-lifecycle:[0-9a-f]{64}$' then raise exception 'criação Nano exige despachante' using errcode='42501'; end if;
 elsif tg_op='UPDATE' and velho is distinct from novo then
  raise exception 'namespace Nano imutável' using errcode='42501';
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.proteger_origem_fila() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_proteger_origem before insert or update or delete on public.pipeline_itens for each row execute function nano_lifecycle_interno.proteger_origem_fila();
create function nano_lifecycle_interno.proteger_historico_fila() returns trigger
language plpgsql security invoker set search_path='' as $fn$
declare eh_nano boolean;
begin
 if tg_op='TRUNCATE' then raise exception 'TRUNCATE de histórico bloqueado' using errcode='42501'; end if;
 if tg_op='INSERT' then
  select exists(select 1 from public.pipeline_itens i where i.id=new.item_id and i.loja_id=new.loja_id and i.entrada->>'origem'='nano_lifecycle') into eh_nano;
  if eh_nano and (current_user<>'nano_lifecycle_despachante' or new.loja_id::text is distinct from current_setting('nano.dispatch_loja',true) or new.de is not null or new.para<>'entrada' or new.ator<>'sistema' or new.por_humano or new.motivo is not null or new.evidencias<>'[]'::jsonb) then raise exception 'histórico Nano exige despacho autorizado' using errcode='42501'; end if;
  if eh_nano and exists(select 1 from public.pipeline_historico h where h.item_id=new.item_id and h.loja_id=new.loja_id) then raise exception 'histórico inicial Nano já existe' using errcode='42501'; end if;
 end if;
 -- UPDATE/DELETE continuam protegidos pelo trigger imutável existente.
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.proteger_historico_fila() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_proteger_historico before insert on public.pipeline_historico for each row execute function nano_lifecycle_interno.proteger_historico_fila();
create trigger nano_lifecycle_historico_truncate before truncate on public.pipeline_historico for each statement execute function nano_lifecycle_interno.proteger_historico_fila();
revoke create on schema nano_lifecycle_interno from nano_lifecycle_despachante;
commit;
