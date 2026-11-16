-- Procedência documental e identidade comercial: não inferir pelo prefixo SKU CI.
create table if not exists public.produto_procedencia (
 produto_id uuid primary key references public.produtos(id) on delete cascade,
 loja_id uuid not null references public.lojas(id) on delete cascade,
 marca_comercial text,
 fabricante_legal text,
 importador_legal text,
 pais_fabricacao text,
 originalidade text not null default 'a_confirmar'
   check(originalidade in ('a_confirmar','genuina_montadora','original_fabricante','reposicao_independente')),
 condicao_importacao text not null default 'a_confirmar'
   check(condicao_importacao in ('a_confirmar','importada','nacional')),
 fonte_documental text,
 nota_vinculo_id bigint references public.produto_vinculo_nf(id),
 estado text not null default 'a_confirmar' check(estado in ('a_confirmar','aprovado','rejeitado')),
 conferido_por text,
 conferido_em timestamptz,
 atualizado_em timestamptz not null default now(),
 constraint produto_procedencia_aprovacao check (
   estado <> 'aprovado' or (
     nullif(btrim(fonte_documental),'') is not null and
     conferido_por is not null and conferido_em is not null and
     originalidade <> 'a_confirmar' and condicao_importacao <> 'a_confirmar'
   )
 )
);
alter table public.produto_procedencia enable row level security;
revoke all on public.produto_procedencia from anon,authenticated;

-- Aliases precisam de aprovação independente (TRIM GO, TRIMIGO etc.).
create table if not exists public.marca_aliases (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 marca_id uuid not null references public.marcas(id) on delete cascade,
 nome_alias text not null,
 nome_normalizado text not null,
 evidencia text,
 estado text not null default 'a_confirmar' check(estado in ('a_confirmar','aprovado','rejeitado')),
 revisado_por text,
 revisado_em timestamptz,
 constraint marca_aliases_prova check (
  estado<>'aprovado' or (nullif(btrim(evidencia),'') is not null and revisado_por is not null and revisado_em is not null)
 )
);
create unique index if not exists marca_alias_unico_loja on public.marca_aliases(loja_id,nome_normalizado);
alter table public.marca_aliases enable row level security;
revoke all on public.marca_aliases from anon,authenticated;

comment on table public.produto_procedencia is 'Separar nacionalidade industrial, importação, originalidade e origem fiscal. Prefixo de SKU não é documento comprobatório.';
comment on table public.marca_aliases is 'Alias de marca com documento e aprovação; impedir equivalência de marcas por semelhança lexical.';
