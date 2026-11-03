-- APLICAÇÃO MANUAL no SQL Editor do Supabase (projeto conecta-ia, ref dsfzhsrudriqkumtlqwj). CONFIRA O REF NA BARRA DO PAINEL ANTES.
-- Só cria uma tabela nova (sem DROP, sem alterar nada existente) e roda numa única transação: se algo falhar, nada é aplicado.
-- Reversão: docs/conector-ia/CONTEXTO_SESSOES_REVERSAO.sql (a tabela só guarda contexto efêmero de 30 min).
begin;
set local lock_timeout = '5s';

-- Contexto Vivo: produto ativo + seleção de UMA sessão autenticada. Efêmero (TTL 30 min), um registro por (loja, principal).
-- Escrita só pelo service_role (gateway); o navegador nunca grava direto. Sem dado fiscal, custo ou fornecedor.
create table public.contexto_sessoes (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  principal text not null check (char_length(principal) between 1 and 80),
  origem text not null check (origem in ('conecta-ui', 'bling-ui')),
  produto_ativo_id uuid,
  produtos_selecionados uuid[] not null default '{}' check (cardinality(produtos_selecionados) <= 100),
  versao integer not null default 0 check (versao >= 0),
  ultimo_evento_id uuid,
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 minutes',
  primary key (loja_id, principal),
  foreign key (produto_ativo_id, loja_id) references public.produtos (id, loja_id)
);
create index on public.contexto_sessoes (expira_em);

alter table public.contexto_sessoes enable row level security;
revoke all on public.contexto_sessoes from anon, authenticated;
grant select, insert, update, delete on public.contexto_sessoes to service_role;
-- Sem política para authenticated/anon: nenhuma leitura direta pelo navegador. O MCP lê via gateway (service_role) filtrando loja e principal.

do $$
begin
  if to_regclass('public.contexto_sessoes') is null then raise exception 'tabela não criada'; end if;
  if not (select relrowsecurity from pg_class where oid='public.contexto_sessoes'::regclass) then raise exception 'RLS desligada'; end if;
  if has_table_privilege('anon', 'public.contexto_sessoes', 'select') or has_table_privilege('authenticated', 'public.contexto_sessoes', 'select') then raise exception 'navegador não pode ter acesso direto'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='contexto_sessoes') then raise exception 'não deve haver política para navegador'; end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261103000003', 'contexto_sessoes') on conflict (version) do nothing;
select 'OK' as resultado;
commit;
