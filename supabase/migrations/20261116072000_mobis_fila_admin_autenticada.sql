-- Painel de auditoria Mobis: leitura restrita ao administrador da loja.
-- A fila base permanece acessível exclusivamente a service_role; este wrapper
-- autentica e valida a administração ANTES de executar a consulta administrativa.
create or replace function public.mobis_fila_admin(
  p_loja uuid,
  p_limite integer default 100
)
returns table (
 prioridade text,
 tipo text,
 produto_id uuid,
 sku text,
 registro_id uuid,
 motivos text[]
)
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is null
     or not coalesce(public.pode_administrar_loja(p_loja),false) then
    raise exception 'Acesso restrito ao administrador da loja'
      using errcode='42501';
  end if;
  return query
    select x.prioridade,x.tipo,x.produto_id,x.sku,x.registro_id,x.motivos
    from public.mobis_revisao_catalogo(
      p_loja,least(greatest(coalesce(p_limite,100),1),200)
    ) x;
end;
$$;
revoke all on function public.mobis_fila_admin(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.mobis_fila_admin(uuid,integer) to authenticated;

create or replace function public.mobis_fila_resumo_admin(p_loja uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
 resumo jsonb;
begin
  if (select auth.uid()) is null
     or not coalesce(public.pode_administrar_loja(p_loja),false) then
    raise exception 'Acesso restrito ao administrador da loja'
      using errcode='42501';
  end if;
  select jsonb_build_object(
    'produtos', (select count(*) from public.produtos where loja_id=p_loja),
    'sem_sku', (select count(*) from public.produtos where loja_id=p_loja and nullif(btrim(sku),'') is null),
    'sem_categoria', (select count(*) from public.produtos where loja_id=p_loja and taxonomia_no_id is null),
    'sem_marca', (select count(*) from public.produtos where loja_id=p_loja and nullif(btrim(marca),'') is null),
    'aplicacoes_sem_oem', (select count(*) from public.produto_aplicacoes
       where loja_id=p_loja and nullif(btrim(codigo_oem),'') is null),
    'aplicacoes_sem_modelo', (select count(*) from public.produto_aplicacoes
       where loja_id=p_loja and modelo_id is null),
    'aplicacoes_aprovadas', (select count(*) from public.produto_aplicacoes
       where loja_id=p_loja and status::text='aprovado'),
    'codigos_sem_marca', (select count(*) from public.produto_codigos
       where loja_id=p_loja and marca_id is null),
    'enriquecimentos_conflitantes', (select count(*) from public.produto_enriquecimento
       where loja_id=p_loja and status::text='aprovado' and (
         fonte ilike '%aguarda aprovação%' or fonte ilike '%aguarda aprovacao%'
         or fonte ilike '%decisão humana%' or fonte ilike '%decisao humana%')),
    'momento',now()
  ) into resumo;
  return resumo;
end;
$$;
revoke all on function public.mobis_fila_resumo_admin(uuid)
  from public,anon,authenticated;
grant execute on function public.mobis_fila_resumo_admin(uuid) to authenticated;

comment on function public.mobis_fila_admin(uuid,integer) is
'Auditoria administrativa SOMENTE LEITURA e limitada a 200 itens por consulta. Não executa propostas nem altera ERP.';
comment on function public.mobis_fila_resumo_admin(uuid) is
'Contadores completos do catálogo; apenas administrador da própria loja, sem dados comerciais de fornecedores.';
