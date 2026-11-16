-- MOBIS: fila determinística de pendências para o Nano e revisão humana.
-- SOMENTE leitura; a função não cria publicação, estoque, NF, aplicações ou anúncios.
-- SECURITY INVOKER e EXECUTE restrito a service_role: nenhum vazamento para a vitrine.
create or replace function public.mobis_revisao_catalogo(
  p_loja uuid,
  p_limite integer default 80
)
returns table(
  prioridade text,
  tipo text,
  produto_id uuid,
  sku text,
  registro_id uuid,
  motivos text[]
)
language sql stable security invoker
set search_path = ''
as $sql$
with revisao as (
  select
    case when nullif(btrim(p.sku),'') is null or nullif(btrim(p.bling_id),'') is null
      then 'P0' else 'P1' end::text as prioridade,
    'produto_mestre'::text as tipo,
    p.id as produto_id,
    p.sku as sku,
    p.id as registro_id,
    array_remove(array[
      case when nullif(btrim(p.sku),'') is null then 'SKU físico ausente' end,
      case when nullif(btrim(p.bling_id),'') is null then 'ID do Bling ausente' end,
      case when nullif(btrim(p.marca),'') is null then 'Marca real não identificada' end,
      case when p.taxonomia_no_id is null then 'Categoria técnica sem nó' end
    ]::text[],null) as motivos
  from public.produtos p
  where p.loja_id = p_loja

  union all
  select
    'P0'::text,
    'aplicacao_veicular'::text,
    a.produto_id,
    p.sku,
    a.id,
    array_remove(array[
      case when a.modelo_id is null then 'Modelo não vinculado à tabela de modelos' end,
      case when nullif(btrim(a.codigo_oem),'') is null then 'OEM não documentado' end,
      case when a.ano_inicial is null or a.ano_final is null then 'Intervalo de anos incompleto' end,
      case when a.status::text <> 'aprovado' then 'Aplicação ainda sem homologação' end
    ]::text[],null)
  from public.produto_aplicacoes a
  join public.produtos p on p.id = a.produto_id and p.loja_id = a.loja_id
  where a.loja_id = p_loja

  union all
  select
    'P1'::text,
    'codigo_cruzado'::text,
    c.produto_id,
    p.sku,
    c.id,
    array_remove(array[
      case when c.marca_id is null then 'Referência cruzada sem marca emissora' end,
      case when c.status::text <> 'aprovado' then 'Referência ainda não homologada' end
    ]::text[],null)
  from public.produto_codigos c
  join public.produtos p on p.id = c.produto_id and p.loja_id = c.loja_id
  where c.loja_id = p_loja

  union all
  select
    'P1'::text,
    'ncm_documental'::text,
    f.produto_id,
    p.sku,
    f.produto_id,
    array_remove(array[
      case when f.origem_ncm = 'bling_erp' and f.status <> 'validado'
        then 'NCM cadastrado no Bling, XML de entrada não homologado' end
    ]::text[],null)
  from public.produto_fiscal f
  join public.produtos p on p.id = f.produto_id and p.loja_id = f.loja_id
  where f.loja_id = p_loja
)
select r.prioridade,r.tipo,r.produto_id,r.sku,r.registro_id,r.motivos
from revisao r
where cardinality(r.motivos)>0
order by r.prioridade,r.tipo,r.sku nulls last,r.registro_id
limit least(greatest(coalesce(p_limite,80),1),200)
$sql$;

revoke all on function public.mobis_revisao_catalogo(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.mobis_revisao_catalogo(uuid,integer) to service_role;
comment on function public.mobis_revisao_catalogo(uuid,integer) is
'Fila administrativa determinística e somente leitura para Nano. Não aprova OEM, não altera Bling e nunca é acessível por anônimos. Os motivos são indícios para revisão humana, não diagnóstico fiscal concluído.';
