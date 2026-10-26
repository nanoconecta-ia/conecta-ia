-- Aprovar uma sugestão de categoria (produto_enriquecimento.campo = 'categoria_sugerida') passa a valer de fato:
-- a decisão do lojista leva o produto ao nó escolhido na taxonomia, e a sincronização do Bling (que reaplica o
-- mapeamento categoria do Bling -> nó) NÃO desfaz mais essa decisão.
-- Só muda a função bling_categoria_taxonomia_aplicar (mesma assinatura, mesmas permissões). Nenhuma tabela nova.
-- O valor da sugestão é um texto "Grupo › Subgrupo" ou "Grupo" (aceita também o separador ">" das sugestões antigas).
-- Só aplica quando o caminho resolve para UM único nó da taxonomia do ramo da loja; caso contrário o produto fica como está.
create or replace function public.bling_categoria_taxonomia_aplicar(p_loja uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_sugestoes integer;
  v_mapeamento integer;
begin
  -- 1) decisões aprovadas pelo lojista (valem mais que o mapeamento da categoria do Bling)
  with caminhos as (
    select e.produto_id, l.perfil_ramo,
           regexp_split_to_array(btrim(e.valor #>> '{}'), '\s*[›>]\s*') as c
    from public.produto_enriquecimento e
    join public.lojas l on l.id = e.loja_id
    where e.loja_id = p_loja and e.campo = 'categoria_sugerida' and e.status = 'aprovado'
      and jsonb_typeof(e.valor) = 'string'
  ), resolvidos as (
    select c.produto_id, (array_agg(n.id))[1] as no_id
    from caminhos c
    join public.taxonomia_nos n on n.perfil_ramo = c.perfil_ramo and n.nome = c.c[array_length(c.c, 1)]
    left join public.taxonomia_nos pai on pai.id = n.pai_id
    where (array_length(c.c, 1) = 1 and n.pai_id is null)
       or (array_length(c.c, 1) = 2 and pai.nome = c.c[1] and pai.pai_id is null)
    group by c.produto_id
    having count(*) = 1
  ), atualizados as (
    update public.produtos p set taxonomia_no_id = r.no_id
    from resolvidos r
    where p.id = r.produto_id and p.loja_id = p_loja and p.taxonomia_no_id is distinct from r.no_id
    returning 1
  )
  select count(*)::integer into v_sugestoes from atualizados;

  -- 2) mapeamento da categoria do Bling, só para produtos SEM decisão aprovada do lojista
  with atualizados as (
    update public.produtos p set taxonomia_no_id = m.taxonomia_no_id
    from public.bling_categoria_taxonomia m
    where p.loja_id = p_loja and m.loja_id = p_loja and p.categoria_bling_id = m.bling_categoria_id
      and p.taxonomia_no_id is distinct from m.taxonomia_no_id
      and not exists (
        select 1 from public.produto_enriquecimento e
        where e.produto_id = p.id and e.campo = 'categoria_sugerida' and e.status = 'aprovado')
    returning 1
  )
  select count(*)::integer into v_mapeamento from atualizados;

  return v_sugestoes + v_mapeamento;
end $$;

revoke all on function public.bling_categoria_taxonomia_aplicar(uuid) from public, anon, authenticated;
grant execute on function public.bling_categoria_taxonomia_aplicar(uuid) to service_role;
