-- Migração 8: taxonomia própria, códigos e aplicações veiculares (perfil autopeças),
-- campos adicionais do espelho e precisão numérica do Bling.
-- Regras: enriquecimento nunca inventa (fonte + data + confiança); aprovado exige fonte e data;
-- custo/fornecedor NÃO são espelhados (confidencial); escrita só pelo servidor (service_role).

-- 1) Precisão do Bling: preço 6 casas, estoque 7, peso 5 (numeric(14,2)/(14,3)/(10,3) arredondava).
alter table public.produtos
  alter column preco type numeric(16,6),
  alter column estoque type numeric(18,7),
  alter column peso_kg type numeric(12,5);

-- 2) Campos adicionais do espelho (somente leitura do Bling).
alter table public.produtos
  add column descricao_curta text,
  add column descricao_complementar text,
  add column gtin_tributario text,
  add column unidade text,
  add column condicao text,
  add column formato text,                     -- simples / com variações / kit (valor como veio do Bling)
  add column pai_bling_id text,                -- variação aponta para o produto pai
  add column categoria_bling_id text,
  add column tags text[] not null default '{}',
  add column campos_customizados jsonb;        -- como veio; nomes técnicos a confirmar pela API

create table public.bling_categorias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  bling_id text not null,
  nome text not null,
  pai_bling_id text,
  sincronizado_em timestamptz not null default now(),
  unique (loja_id, bling_id)
);

-- 3) Perfil de ramo e taxonomia própria (global por ramo; a loja escolhe o perfil).
create table public.perfis_ramo (
  codigo text primary key check (codigo ~ '^[a-z0-9_]{2,40}$'),
  nome text not null,
  campos_obrigatorios text[] not null default '{}'   -- exigências de publicação do ramo
);
insert into public.perfis_ramo (codigo, nome, campos_obrigatorios) values
  ('autopecas', 'Autopeças', array['nome','sku','preco','categoria','imagem_principal','marca_peca','codigo_fabricante']);
alter table public.lojas add column perfil_ramo text not null default 'autopecas' references public.perfis_ramo(codigo);

create table public.taxonomia_nos (
  id uuid primary key default gen_random_uuid(),
  perfil_ramo text not null references public.perfis_ramo(codigo),
  pai_id uuid references public.taxonomia_nos(id) on delete restrict,
  nome text not null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  google_categoria_id text,                    -- mapeamento p/ Google Shopping, quando confirmado
  ordem int not null default 0,
  unique (perfil_ramo, slug)
);
alter table public.produtos add column taxonomia_no_id uuid references public.taxonomia_nos(id);

-- 4) Marcas (do veículo e da peça): cadastro curado por loja.
create table public.marcas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  tipo text not null check (tipo in ('veiculo', 'peca')),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now()
);
create unique index marcas_unica on public.marcas (loja_id, tipo, lower(btrim(nome)));

-- 5) Códigos do produto (OEM, fabricante, similares, antigos...). Aprovado exige fonte e data.
create table public.produto_codigos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  tipo text not null check (tipo in ('sku', 'oem', 'fabricante', 'ean', 'similar', 'substituto', 'antigo')),
  valor text not null check (length(btrim(valor)) > 0),
  marca_id uuid references public.marcas(id),
  fonte text,
  coletado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null)),
  unique (produto_id, tipo, valor)
);
create index on public.produto_codigos (loja_id, valor);

-- 6) Aplicação veicular: só com relação técnica, fonte e data registradas.
create table public.produto_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  marca_veiculo_id uuid references public.marcas(id),
  modelo text not null,
  motorizacao text,
  ano_inicial int check (ano_inicial between 1950 and 2100),
  ano_final int check (ano_final between 1950 and 2100),
  fonte text,
  coletado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (ano_final is null or ano_inicial is null or ano_final >= ano_inicial),
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null))
);
create index on public.produto_aplicacoes (loja_id, produto_id);

-- 7) RLS e grants. Lojista só lê a própria loja; escrita só pelo servidor.
alter table public.bling_categorias enable row level security;
alter table public.perfis_ramo enable row level security;
alter table public.taxonomia_nos enable row level security;
alter table public.marcas enable row level security;
alter table public.produto_codigos enable row level security;
alter table public.produto_aplicacoes enable row level security;

create policy categorias_ver on public.bling_categorias for select to authenticated using (private.pode_ver_loja(loja_id));
create policy marcas_ver on public.marcas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy codigos_ver on public.produto_codigos for select to authenticated using (private.pode_ver_loja(loja_id));
create policy aplic_ver on public.produto_aplicacoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy perfis_ver on public.perfis_ramo for select to authenticated, anon using (true);
create policy taxonomia_ver on public.taxonomia_nos for select to authenticated, anon using (true);

-- Vitrine pública: só o aprovado, de produto publicado em loja ativa.
create policy codigos_publicos on public.produto_codigos for select to anon
  using (status = 'aprovado' and private.loja_ativa(loja_id)
         and exists (select 1 from public.produtos p where p.id = produto_id and p.publicado));
create policy aplic_publicas on public.produto_aplicacoes for select to anon
  using (status = 'aprovado' and private.loja_ativa(loja_id)
         and exists (select 1 from public.produtos p where p.id = produto_id and p.publicado));
create policy marcas_publicas on public.marcas for select to anon
  using (status = 'aprovado' and private.loja_ativa(loja_id));

grant select on public.bling_categorias, public.marcas, public.produto_codigos, public.produto_aplicacoes to authenticated;
grant select on public.marcas, public.produto_codigos, public.produto_aplicacoes to anon;
grant select on public.perfis_ramo, public.taxonomia_nos to authenticated, anon;
grant select, insert, update, delete on public.bling_categorias, public.perfis_ramo, public.taxonomia_nos,
  public.marcas, public.produto_codigos, public.produto_aplicacoes to service_role;
