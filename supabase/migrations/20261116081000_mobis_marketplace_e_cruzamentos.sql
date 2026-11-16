-- MOBIS / Nano: evidência comercial de marketplace e cruzamentos de MARCAS.
-- A existência de um anúncio não confirma OEM, fabricante real, importador, país ou produto físico.
-- Esta tabela NÃO alimenta diretamente produto_aplicacoes, produto_equivalencias ou estoque.
create table if not exists public.catalogo_evidencias_comerciais(
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  fonte_id uuid not null references public.fontes(id),
  produto_id uuid references public.produtos(id) on delete set null,
  plataforma text not null check(plataforma in ('mercado_livre','alibaba')),
  tipo_pagina text not null check(tipo_pagina in ('anuncio','catalogo','busca','perfil_fornecedor')),
  url text not null check(url like 'https://%' and length(url)<=1400),
  identificador_anuncio text,
  codigo_consultado text check (codigo_consultado is null or length(codigo_consultado)<=90),
  marca_alegada text,
  referencia_alegada text,
  gtin_alegado text,
  oem_alegados text[] not null default '{}',
  vendedor_alegado text,
  origem_alegada text,
  observacoes text not null check(length(observacoes)>15 and length(observacoes)<=2500),
  situacao text not null default 'candidato' check(situacao in ('candidato','em_revisao','rejeitado')),
  coletado_em timestamptz not null default now(),
  constraint catalogo_evidencias_comerciais_plataforma_url check (
   (plataforma='mercado_livre' and (url like 'https://www.mercadolivre.com.br/%'
     or url like 'https://produto.mercadolivre.com.br/%'))
   or (plataforma='alibaba' and (url like 'https://www.alibaba.com/%'
     or url like 'https://portuguese.alibaba.com/%' or url like 'https://autopart.alibaba.com/%'))
  ),
  constraint catalogo_evidencias_comerciais_ref_limite check (
     referencia_alegada is null or length(referencia_alegada)<=150)
);
create unique index if not exists catalogo_evidencias_comerciais_unica
 on public.catalogo_evidencias_comerciais(loja_id,plataforma,url);
create index if not exists catalogo_evidencias_comerciais_pendentes
 on public.catalogo_evidencias_comerciais(loja_id,plataforma,situacao,coletado_em desc);
alter table public.catalogo_evidencias_comerciais enable row level security;
revoke all on public.catalogo_evidencias_comerciais from anon,authenticated;
comment on table public.catalogo_evidencias_comerciais is
'Fonte de INDÍCIO COMERCIAL: oferta de marketplace não comprova genuinidade, origem, OEM, aplicação ou relacionamento contratual com a MOBIS. Registrar apenas dados textuais mínimos e URL; sem cópia não autorizada de fotos ou descrições.';

-- Uma família de referências convertidas por catálogo NÃO é um produto único,
-- nem garante dimensões, válvulas ou aplicações idênticas.
create table if not exists public.catalogo_cruzamentos_marca (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  familia text not null check(length(btrim(familia)) between 5 and 150),
  marca_id uuid not null references public.marcas(id),
  referencia text not null check(length(btrim(referencia)) between 2 and 90),
  fonte_id uuid not null references public.fontes(id),
  classe_fonte text not null check(classe_fonte in ('fabricante','comercial')),
  dimensoes_documentadas jsonb not null default '{}'::jsonb
    check(jsonb_typeof(dimensoes_documentadas)='object'),
  situacao text not null default 'candidato'
    check(situacao in ('candidato','em_revisao','rejeitado')),
  ressalva text not null check(length(btrim(ressalva)) >= 20),
  coletado_em timestamptz not null default now()
);
create unique index if not exists catalogo_cruzamentos_marca_unica
 on public.catalogo_cruzamentos_marca
 (loja_id,familia,marca_id,upper(btrim(referencia)),fonte_id);
create index if not exists catalogo_cruzamentos_marca_familia
 on public.catalogo_cruzamentos_marca(loja_id,familia,situacao);
alter table public.catalogo_cruzamentos_marca enable row level security;
revoke all on public.catalogo_cruzamentos_marca from anon,authenticated;
comment on table public.catalogo_cruzamentos_marca is
'Matriz de referências de fabricantes, não de SKUs físicos. Somente candidato em revisão até homologação por aplicação, dimensões e NF/embalagem; não publica automaticamente.';

-- Consulta administrativa autorizada; nenhum acesso direto à tabela é dado a clientes.
create or replace function public.mobis_evidencias_comerciais_admin(
 p_loja uuid,p_limite integer default 100
) returns table (
 id uuid,plataforma text,tipo_pagina text,produto_id uuid,url text,
 codigo_consultado text,marca_alegada text,referencia_alegada text,
 oem_alegados text[],situacao text,observacoes text
) language plpgsql security definer stable
set search_path to ''
as $$
begin
  if (select auth.uid()) is null
     or not coalesce(public.pode_administrar_loja(p_loja),false) then
    raise exception 'Acesso restrito ao administrador da loja' using errcode='42501';
  end if;
  return query
    select e.id,e.plataforma,e.tipo_pagina,e.produto_id,e.url,
      e.codigo_consultado,e.marca_alegada,e.referencia_alegada,
      e.oem_alegados,e.situacao,e.observacoes
    from public.catalogo_evidencias_comerciais e
    where e.loja_id=p_loja
    order by e.coletado_em desc
    limit least(greatest(coalesce(p_limite,100),1),200);
end;
$$;
revoke all on function public.mobis_evidencias_comerciais_admin(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.mobis_evidencias_comerciais_admin(uuid,integer) to authenticated;
