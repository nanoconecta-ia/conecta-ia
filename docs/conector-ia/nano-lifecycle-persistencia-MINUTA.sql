-- MINUTA NÃO APLICADA. Gerar migração oficial por CLI e homologar no Postgres
-- descartável antes de usar. Não executar no banco de produção diretamente.
-- Registro de captura, NÃO segunda fila de enriquecimento. pipeline_itens
-- continua sendo executor. Chave de ativação default false por loja.
begin;
create table public.nano_lifecycle_checkpoint (
 loja_id uuid primary key references public.lojas(id) on delete cascade,
 habilitado boolean not null default false,
 revisao text check(revisao is null or revisao ~ '^[A-Za-z0-9_-]{8,96}$'),
 atualizado_em timestamptz not null default now()
);
create table public.nano_lifecycle_capturas (
 loja_id uuid not null references public.lojas(id) on delete cascade,
 revisao text not null check(revisao ~ '^[A-Za-z0-9_-]{8,96}$'),
 predecessor text,
 estado text not null check(estado in ('baseline','pronto_para_transacao')),
 eventos jsonb not null check(jsonb_typeof(eventos)='array' and jsonb_array_length(eventos)<=5000),
 bloqueios jsonb not null check(jsonb_typeof(bloqueios)='array' and jsonb_array_length(bloqueios)<=5000),
 criado_em timestamptz not null default now(),
 primary key(loja_id,revisao),
 check ((estado='baseline' and predecessor is null and jsonb_array_length(eventos)=0 and jsonb_array_length(bloqueios)=0) or (estado='pronto_para_transacao' and predecessor is not null)),
 check(predecessor is null or predecessor<>revisao)
);
alter table public.nano_lifecycle_checkpoint enable row level security;
alter table public.nano_lifecycle_capturas enable row level security;
revoke all on public.nano_lifecycle_checkpoint,public.nano_lifecycle_capturas from public,anon,authenticated,service_role;
grant select,insert,update on public.nano_lifecycle_checkpoint to service_role;
grant select,insert on public.nano_lifecycle_capturas to service_role;
-- A operação recebe exclusivamente projeção técnica do adaptador servidor.
-- Nunca recebe JSON do Bling integral (backup contém preço/custo/fornecedor).
create function public.nano_lifecycle_registrar(
 p_loja uuid,p_revisao text,p_predecessor text,p_estado text,p_eventos jsonb,p_bloqueios jsonb
) returns text language plpgsql security invoker set search_path='' as $$
declare c public.nano_lifecycle_checkpoint; r public.nano_lifecycle_capturas; e jsonb; b jsonb;
begin
 if p_revisao is null or p_revisao !~ '^[A-Za-z0-9_-]{8,96}$' or p_estado is null or p_estado not in ('baseline','pronto_para_transacao')
 or p_eventos is null or jsonb_typeof(p_eventos)<>'array' or p_bloqueios is null or jsonb_typeof(p_bloqueios)<>'array'
 then raise exception 'captura inválida'; end if;
 if jsonb_array_length(p_eventos)>5000 or jsonb_array_length(p_bloqueios)>5000 then raise exception 'lote excedido'; end if;
 select * into c from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not c.habilitado then return 'desabilitado'; end if;
 select * into r from public.nano_lifecycle_capturas where loja_id=p_loja and revisao=p_revisao;
 if found then
  if r.predecessor is not distinct from p_predecessor and r.estado=p_estado and r.eventos=p_eventos and r.bloqueios=p_bloqueios then return 'ja_gravado'; end if;
  return 'conflito';
 end if;
 if c.revisao is distinct from p_predecessor then return 'conflito'; end if;
 for e in select value from jsonb_array_elements(p_eventos) loop
  if jsonb_typeof(e)<>'object' then raise exception 'evento inválido'; end if;
  if (e - array['produto_id','loja_id','bling_id','sku','tipo','campos','revisao','idempotency_key','destino','pausado_na_captura']) <> '{}'::jsonb
   or e->>'loja_id' is distinct from p_loja::text or e->>'revisao' is distinct from p_revisao
   or coalesce(e->>'idempotency_key','') !~ '^nano-lifecycle:[0-9a-f]{64}$'
   or coalesce(e->>'tipo','') not in ('novo','reativado','alteracao_tecnica','inativado')
   or (e->>'destino') is distinct from (case when e->>'tipo'='inativado' then 'revisao_inativacao' else 'pesquisa' end)
   or jsonb_typeof(e->'pausado_na_captura') is distinct from 'boolean'
   or jsonb_typeof(e->'campos') is distinct from 'array'
  then raise exception 'evento fora do contrato'; end if;
  if exists(select 1 from jsonb_array_elements_text(e->'campos') f(v) where f.v is null or f.v not in ('sku','nome','marca','gtin','categoria_bling_id','descricao_curta','descricao_complementar','peso_kg','largura_cm','altura_cm','profundidade_cm','formato','pai_bling_id')) then raise exception 'campo fora do contrato'; end if;
  if not exists(select 1 from public.produtos p where p.loja_id=p_loja and p.id::text=e->>'produto_id' and p.bling_id=e->>'bling_id' and btrim(p.sku)=e->>'sku') then raise exception 'identidade divergente'; end if;
 end loop;
 if (select count(distinct x->>'idempotency_key') from jsonb_array_elements(p_eventos) x)<>jsonb_array_length(p_eventos) then raise exception 'eventos duplicados'; end if;
 for b in select value from jsonb_array_elements(p_bloqueios) loop
  if jsonb_typeof(b)<>'object' then raise exception 'bloqueio inválido'; end if;
  if (b-array['produto_id','motivo'])<>'{}'::jsonb or coalesce(b->>'motivo','') not in ('identidade_incompleta','sku_duplicado','bling_id_duplicado','pausado','identidade_alterada') or not exists(select 1 from public.produtos p where p.loja_id=p_loja and p.id::text=b->>'produto_id') then raise exception 'bloqueio fora do contrato'; end if;
 end loop;
 insert into public.nano_lifecycle_capturas(loja_id,revisao,predecessor,estado,eventos,bloqueios) values(p_loja,p_revisao,p_predecessor,p_estado,p_eventos,p_bloqueios);
 update public.nano_lifecycle_checkpoint set revisao=p_revisao,atualizado_em=now() where loja_id=p_loja;
 return 'gravado';
end $$;
revoke all on function public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb) to service_role;
commit;
-- Sem insert de checkpoint, sem cron, sem chamada pipeline_criar.
