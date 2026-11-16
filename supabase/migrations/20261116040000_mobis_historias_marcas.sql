-- Conteúdo editorial separado da homologação técnica e dos dados fiscais.
-- Modelos e marcas possuem histórico e URLs de fontes, nunca equivalência deduzida.
create table if not exists public.catalogo_historias (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 marca_id uuid references public.marcas(id) on delete cascade,
 modelo_id uuid references public.modelos(id) on delete cascade,
 titulo text not null check (char_length(titulo) between 5 and 150),
 resumo text not null check (char_length(resumo) between 20 and 2000),
 eventos jsonb not null default '[]'::jsonb check (jsonb_typeof(eventos)='array'),
 fontes jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes)='array'),
 status text not null default 'a_confirmar' check(status in ('a_confirmar','aprovado','rejeitado')),
 texto_revisao text,
 atualizado_em timestamptz not null default now(),
 constraint catalogo_historias_alvo check ((marca_id is not null) <> (modelo_id is not null)),
 constraint catalogo_historias_fontes check (status <> 'aprovado' or jsonb_array_length(fontes)>0)
);
create unique index if not exists catalogo_historia_unica_marca on public.catalogo_historias(loja_id,marca_id) where marca_id is not null;
create unique index if not exists catalogo_historia_unica_modelo on public.catalogo_historias(loja_id,modelo_id) where modelo_id is not null;
alter table public.catalogo_historias enable row level security;
revoke all on public.catalogo_historias from anon,authenticated;

-- O identificador da marca é distinto do nome fornecido pelo ERP e da identidade da montadora.
-- Logotipos são exibidos apenas depois de evidência de uso e aprovação editorial.
create table if not exists public.marca_identidade_publica (
 marca_id uuid primary key references public.marcas(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,
 logo_png_url text,
 logo_fonte text,
 logo_direitos text,
 site_oficial text,
 status text not null default 'a_confirmar' check(status in ('a_confirmar','aprovado','rejeitado')),
 atualizado_em timestamptz not null default now(),
 constraint marca_identidade_logo_check check (
  status<>'aprovado' or logo_png_url is null or
  (logo_png_url like 'https://%' and nullif(btrim(logo_direitos),'') is not null
   and nullif(btrim(logo_fonte),'') is not null)
 )
);
alter table public.marca_identidade_publica enable row level security;
revoke all on public.marca_identidade_publica from anon,authenticated;

comment on table public.catalogo_historias is 'História editorial de marca ou modelo; não comprova aplicação OEM, garantia nem origem de peças.';
comment on table public.marca_identidade_publica is 'Logotipo de marca de peça, aprovado e comprovado. Logo da montadora segue veiculo_midias.';
