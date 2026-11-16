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
  -- Registro marcado como aprovado enquanto a própria fonte pede aprovação.
  select
    'P0'::text,
    'enriquecimento_incoerente'::text,
    e.produto_id,
    p.sku,
    e.id,
    array['Enriquecimento aprovado, mas a fonte exige revisão humana'::text]
  from public.produto_enriquecimento e
  join public.produtos p on p.id = e.produto_id and p.loja_id = e.loja_id
  where e.loja_id = p_loja and e.status::text = 'aprovado'
    and (e.fonte ilike '%aguarda aprovação%'
      or e.fonte ilike '%aguarda aprovacao%'
      or e.fonte ilike '%decisão humana%'
      or e.fonte ilike '%decisao humana%')

  union all
  -- Um mesmo GTIN em dois registros do Bling sinaliza POSSÍVEL duplicidade.
  -- Não fundir produtos, saldos, marcas ou custo automaticamente.
  select
    'P0'::text,
    'gtin_repetido'::text,
    p.id,
    p.sku,
    p.id,
    array['GTIN compartilhado com outro ID do Bling; conferir item físico, marca, NF, saldo e origem antes de decidir'::text]
  from public.produtos p
  where p.loja_id=p_loja and nullif(btrim(p.gtin),'') is not null
    and exists(
      select 1 from public.produtos q
      where q.loja_id=p.loja_id and q.id<>p.id and q.gtin=p.gtin
    )

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

-- Leitura da matriz conservadora de referências de marcas, somente para admin.
create or replace function public.mobis_cruzamentos_marcas_admin(
 p_loja uuid,p_limite integer default 100
) returns table (
 marca text,referencia text,familia text,situacao text,
 classe_fonte text,fonte_titulo text,fonte_url text,
 dimensoes_documentadas jsonb,ressalva text
) language plpgsql stable security definer set search_path to ''
as $$
begin
 if (select auth.uid()) is null
    or not coalesce(public.pode_administrar_loja(p_loja),false) then
   raise exception 'Acesso restrito ao administrador' using errcode='42501';
 end if;
 return query
 select m.nome,c.referencia,c.familia,c.situacao,c.classe_fonte,
   f.titulo,f.url,c.dimensoes_documentadas,c.ressalva
 from public.catalogo_cruzamentos_marca c
 join public.marcas m on m.id=c.marca_id
 join public.fontes f on f.id=c.fonte_id
 where c.loja_id=p_loja
 order by m.nome,c.referencia
 limit least(greatest(coalesce(p_limite,100),1),200);
end;
$$;
revoke all on function public.mobis_cruzamentos_marcas_admin(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.mobis_cruzamentos_marcas_admin(uuid,integer)
 to authenticated;

create or replace function public.mobis_referencias_resumo_admin(p_loja uuid)
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare r jsonb;
begin
 if (select auth.uid()) is null
   or not coalesce(public.pode_administrar_loja(p_loja),false) then
   raise exception 'Acesso restrito ao administrador' using errcode='42501';
 end if;
 select jsonb_build_object(
   'gtins_em_mais_de_um_cadastro',(
      select count(*) from (
        select gtin from public.produtos
        where loja_id=p_loja and nullif(btrim(gtin),'') is not null
        group by gtin having count(*)>1
      ) d),
   'referencias_marcas_candidatas',(
      select count(*) from public.catalogo_cruzamentos_marca
      where loja_id=p_loja and situacao='candidato'),
   'evidencias_marketplace_candidatas',(
      select count(*) from public.catalogo_evidencias_comerciais
      where loja_id=p_loja and situacao='candidato'),
   'timestamp',now()
 ) into r;
 return r;
end;
$$;
revoke all on function public.mobis_referencias_resumo_admin(uuid)
 from public,anon,authenticated;
grant execute on function public.mobis_referencias_resumo_admin(uuid) to authenticated;
