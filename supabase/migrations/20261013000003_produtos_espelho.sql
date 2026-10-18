-- Espelho SOMENTE LEITURA do catálogo do Bling. Ninguém edita produto no site.
-- Campos aprovados: nome, SKU, preço, estoque, situação, imagens, categoria, marca,
-- GTIN, descrição, peso, medidas, embalagem e volumes.

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  bling_id text not null,
  sku text,
  nome text,
  preco numeric(14,2),
  estoque numeric(14,3),
  situacao text,
  categoria text,
  marca text,
  gtin text,
  descricao text,
  peso_kg numeric(10,3),
  largura_cm numeric(10,2),
  altura_cm numeric(10,2),
  profundidade_cm numeric(10,2),
  embalagem jsonb,
  volumes int,
  versao_origem timestamptz,          -- ignora atualização mais antiga que esta
  sincronizado_em timestamptz not null default now(),
  publicado boolean not null default false,  -- produto incompleto não é publicado
  criado_em timestamptz not null default now(),
  unique (loja_id, bling_id)
);
create unique index produtos_loja_sku on public.produtos (loja_id, sku) where sku is not null;
create index on public.produtos (loja_id, publicado);

create table public.produto_imagens (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  url text not null,
  ordem int not null default 0,
  tipo text not null default 'real' check (tipo in ('real', 'gerada_ia', 'ilustrativa')),
  origem text,                          -- bling, fornecedor, enriquecimento...
  direitos text,                        -- licença/autorização conhecida; vazio = a confirmar
  largura_px int,
  altura_px int,
  principal boolean not null default false,
  aprovada boolean not null default false,
  criado_em timestamptz not null default now(),
  -- imagem de IA nunca é principal sem aprovação, nem se apresenta como foto real
  check (not (principal and tipo <> 'real' and not aprovada))
);
create index on public.produto_imagens (produto_id);
create index on public.produto_imagens (loja_id);

alter table public.produtos enable row level security;
alter table public.produto_imagens enable row level security;

create policy produtos_ver on public.produtos for select to authenticated using (private.pode_ver_loja(loja_id));
create policy imagens_ver on public.produto_imagens for select to authenticated using (private.pode_ver_loja(loja_id));
-- Vitrine pública: apenas produtos publicados de lojas ativas.
create function private.loja_ativa(p_loja uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.lojas where id = p_loja and ativa); $$;
grant usage on schema private to anon;
grant execute on function private.loja_ativa(uuid) to anon, authenticated;

create policy produtos_publicos on public.produtos for select to anon
  using (publicado and private.loja_ativa(loja_id));
create policy imagens_publicas on public.produto_imagens for select to anon
  using (aprovada and exists (select 1 from public.produtos p where p.id = produto_id));

grant select on public.produtos, public.produto_imagens to authenticated, anon;
-- Escritas: somente service_role (sincronização).
