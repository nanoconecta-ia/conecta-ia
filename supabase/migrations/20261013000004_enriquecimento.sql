-- Camada de enriquecimento SEPARADA do dado do Bling. Nunca inventa: sem evidência = a_confirmar.

create type public.status_tarefa as enum ('na_fila', 'reivindicada', 'concluida', 'falhou');
create type public.provedor_enriquecimento as enum ('integrado', 'nanoshell');
create type public.status_enriquecimento as enum ('a_confirmar', 'aprovado', 'desatualizado', 'rejeitado');

create table public.enriquecimento_tarefas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo text not null,
  provedor_preferido text not null default 'automatico' check (provedor_preferido in ('integrado', 'nanoshell', 'automatico')),
  provedor_executor public.provedor_enriquecimento,
  status public.status_tarefa not null default 'na_fila',
  lease_ate timestamptz,              -- tarefa reivindicada que expira volta à fila
  lease_por text,
  tentativas int not null default 0,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create index on public.enriquecimento_tarefas (loja_id, status);
create index on public.enriquecimento_tarefas (status, lease_ate);

create table public.produto_enriquecimento (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  campo text not null,
  valor jsonb,
  fonte text,                           -- URL/documento de onde veio
  coletado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  provedor public.provedor_enriquecimento,
  hash_origem text,                     -- hash do dado do Bling usado; mudou = desatualizado
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  -- valor sem fonte e data não pode ser aprovado
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null)),
  unique (produto_id, campo)
);
create index on public.produto_enriquecimento (loja_id, status);

create table public.enriquecimento_execucoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  tarefa_id uuid references public.enriquecimento_tarefas(id) on delete set null,
  provedor_ia text,
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  custo_estimado numeric(12,6),
  criado_em timestamptz not null default now()
);
create index on public.enriquecimento_execucoes (loja_id, criado_em desc);

-- Chave de IA do cliente (BYOK). Metadados visíveis; a chave cifrada fica em private.
create table public.loja_chaves_ia (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  provedor text not null,
  ativa boolean not null default true,
  limite_mensal_tokens bigint,
  ultimo_uso_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (loja_id, provedor)
);
create table private.chaves_ia_segredos (
  chave_id uuid primary key references public.loja_chaves_ia(id) on delete cascade,
  chave_cifrada text not null
);

-- Credenciais MCP por loja: só o HASH é guardado; alcança apenas a própria loja.
create table public.loja_mcp_chaves (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  hash_chave text not null unique,
  escopos text[] not null default array['leitura'],
  ultimo_uso_em timestamptz,
  revogada_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.loja_mcp_chaves (loja_id);

alter table public.enriquecimento_tarefas enable row level security;
alter table public.produto_enriquecimento enable row level security;
alter table public.enriquecimento_execucoes enable row level security;
alter table public.loja_chaves_ia enable row level security;
alter table private.chaves_ia_segredos enable row level security;
alter table public.loja_mcp_chaves enable row level security;

create policy tarefas_ver on public.enriquecimento_tarefas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy enriq_ver on public.produto_enriquecimento for select to authenticated using (private.pode_ver_loja(loja_id));
create policy exec_ver on public.enriquecimento_execucoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy chaves_ia_ver on public.loja_chaves_ia for select to authenticated using (private.pode_ver_loja(loja_id));
create policy mcp_ver on public.loja_mcp_chaves for select to authenticated using (private.pode_ver_loja(loja_id));

-- hash_chave nunca vai para o navegador
grant select on public.enriquecimento_tarefas, public.produto_enriquecimento,
  public.enriquecimento_execucoes, public.loja_chaves_ia to authenticated;
grant select (id, loja_id, nome, escopos, ultimo_uso_em, revogada_em, criado_em) on public.loja_mcp_chaves to authenticated;
grant select, insert, update, delete on private.chaves_ia_segredos to service_role;
