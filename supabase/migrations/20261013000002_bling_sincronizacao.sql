-- Conexão com o Bling por loja, fila idempotente de sincronização e erros.
-- Tokens do Bling (JWT ~1.500–3.000 caracteres): sempre TEXT, cifrados, no schema private.

create type public.status_conexao as enum ('pendente', 'conectada', 'expirada', 'erro', 'desconectada');

create table public.bling_conexoes (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  status public.status_conexao not null default 'pendente',
  ultimo_sync_ok_em timestamptz,   -- saúde da conexão (frescor), não a última alteração de produto
  ultimo_erro text,
  atualizado_em timestamptz not null default now()
);

-- Segredos: sem policy nem grant para anon/authenticated. Só service_role (servidor).
create table private.bling_credenciais (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  access_token_cifrado text not null,
  refresh_token_cifrado text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now()
);

create type public.origem_sync as enum ('webhook', 'varredura', 'manual');
create type public.status_sync as enum ('pendente', 'processando', 'aplicado', 'ignorado', 'erro');

create table public.sync_eventos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  origem public.origem_sync not null,
  tipo text not null check (tipo in ('produto', 'preco', 'estoque', 'inativacao')),
  bling_id text not null,
  versao_origem timestamptz,                -- data de alteração no Bling; ordena a aplicação
  chave_idempotencia text not null,
  payload jsonb,
  status public.status_sync not null default 'pendente',
  tentativas int not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  processado_em timestamptz,
  unique (loja_id, chave_idempotencia)
);
create index on public.sync_eventos (status, proxima_tentativa_em);
create index on public.sync_eventos (loja_id, bling_id);

create table public.sync_erros (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  evento_id uuid references public.sync_eventos(id) on delete set null,
  mensagem text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index on public.sync_erros (loja_id, criado_em desc);

alter table public.bling_conexoes enable row level security;
alter table public.sync_eventos enable row level security;
alter table public.sync_erros enable row level security;
alter table private.bling_credenciais enable row level security;

create policy conexoes_ver on public.bling_conexoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy eventos_ver on public.sync_eventos for select to authenticated using (private.pode_ver_loja(loja_id));
create policy erros_ver on public.sync_erros for select to authenticated using (private.pode_ver_loja(loja_id));

grant select on public.bling_conexoes, public.sync_eventos, public.sync_erros to authenticated;
-- Escritas: somente service_role (servidor), que ignora RLS.
grant select, insert, update, delete on private.bling_credenciais to service_role;
