-- Recebimento seguro de imagens do plugin MCP: apenas rascunhos privados;
-- nunca vinculados automaticamente à vitrine, a banners ativos ou ao Bling.
create table if not exists public.conecta_midia_pendentes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id),
  produto_id uuid not null references public.produtos(id),
  criado_por uuid not null,
  sku text not null check (length(sku) between 1 and 80),
  finalidade text not null check (finalidade in ('foto_produto','banner')),
  status text not null default 'a_confirmar' check (status in ('a_confirmar','aprovada','rejeitada')),
  aplicacao_id uuid references public.produto_aplicacoes(id),
  titulo text check (length(titulo)<=120),
  origem text check (length(origem)<=200),
  direitos_declarados text not null default 'a_confirmar'
    check (direitos_declarados in ('a_confirmar','autor_proprio','licenca_informada')),
  nome_arquivo text check (length(nome_arquivo)<=180),
  storage_bucket text not null default 'agente-anexos' check (storage_bucket='agente-anexos'),
  storage_path text not null unique check (storage_path like 'mcp-midias/%'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  tamanho_bytes integer not null check (tamanho_bytes between 1 and 8388608),
  largura_px integer not null check (largura_px between 1 and 12000),
  altura_px integer not null check (altura_px between 1 and 12000),
  criado_em timestamptz not null default now(),
  check (finalidade <> 'foto_produto' or aplicacao_id is null),
  check (finalidade <> 'banner' or (titulo is not null and length(btrim(titulo))>0))
);
comment on table public.conecta_midia_pendentes is
 'Arquivo original privado vindo do MCP; etapa de revisão humana pendente. Nenhuma linha publica ou promove a mídia.';
create index if not exists conecta_midia_pendentes_loja_status_idx
  on public.conecta_midia_pendentes(loja_id, status, criado_em desc);
create index if not exists conecta_midia_pendentes_produto_idx
  on public.conecta_midia_pendentes(loja_id, produto_id, finalidade);
alter table public.conecta_midia_pendentes enable row level security;
revoke all on table public.conecta_midia_pendentes from public, anon, authenticated;
grant all on table public.conecta_midia_pendentes to service_role;
-- Apenas donos autenticados da própria loja podem LISTAR; a escrita fica exclusiva da Edge Function.
create policy conecta_midia_dono_leitura on public.conecta_midia_pendentes
  for select to authenticated
  using (private.administra_loja(loja_id, (select auth.uid())));
grant select on table public.conecta_midia_pendentes to authenticated;
