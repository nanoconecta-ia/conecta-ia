-- RASCUNHO PARA APROVAÇÃO (decisão C1). NÃO APLICAR antes do aval do dono.
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
