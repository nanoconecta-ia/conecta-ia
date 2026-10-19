-- Três ferramentas de VERIFICAÇÃO (somente leitura) do Conector IA: duplicidade, referência cruzada e aplicação por SKU.
-- Nenhuma conclui "incompatível": ausência de registro significa "não confirmado". Sem transitividade nos cruzados.
create function public.detectar_duplicidade(p_loja uuid, p_sku text default null, p_gtin text default null, p_nome text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_sku text := upper(regexp_replace(coalesce(p_sku, ''), '[^0-9A-Za-z]', '', 'g'));
  v_nome text := regexp_replace(translate(lower(coalesce(p_nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^0-9a-z]', '', 'g');
  v_gtin text := regexp_replace(coalesce(p_gtin, ''), '\D', '', 'g');
  r jsonb;
begin
  -- variações (pai_bling_id) compartilham nome por natureza: ficam fora da comparação por nome e SKU
  with b as (
    select id, sku, nome, gtin, bling_id,
           upper(regexp_replace(coalesce(sku, ''), '[^0-9A-Za-z]', '', 'g')) as k_sku,
           regexp_replace(translate(lower(coalesce(nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^0-9a-z]', '', 'g') as k_nome,
           regexp_replace(coalesce(gtin, ''), '\D', '', 'g') as k_gtin
    from public.produtos where loja_id = p_loja and pai_bling_id is null
  ), alvo as (
    select * from b where
      (v_sku <> '' and k_sku = v_sku) or (v_gtin <> '' and k_gtin = v_gtin) or (v_nome <> '' and k_nome = v_nome)
  ), grupos as (
    select 'sku' tipo, k_sku chave, jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'bling_id', bling_id) order by bling_id) itens, count(*) n from b where k_sku <> '' group by k_sku having count(*) > 1
    union all
    select 'gtin', k_gtin, jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'bling_id', bling_id) order by bling_id), count(*) from b where k_gtin <> '' group by k_gtin having count(*) > 1
    union all
    select 'nome', k_nome, jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'bling_id', bling_id) order by bling_id), count(*) from b where k_nome <> '' group by k_nome having count(*) > 1
  )
  select jsonb_build_object(
    'modo', case when v_sku = '' and v_gtin = '' and v_nome = '' then 'varredura_da_loja' else 'consulta' end,
    'grupos', coalesce((select jsonb_agg(jsonb_build_object('tipo', tipo, 'chave', chave, 'quantidade', n, 'itens', itens) order by n desc, tipo) from (select * from grupos limit 50) g
                        where (v_sku = '' and v_gtin = '' and v_nome = '') or chave in (v_sku, v_gtin, v_nome)), '[]'::jsonb),
    'candidatos', case when v_sku = '' and v_gtin = '' and v_nome = '' then '[]'::jsonb
                  else coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'nome', nome, 'bling_id', bling_id)) from alvo), '[]'::jsonb) end,
    'aviso', 'Duplicidade é CANDIDATA: confirme no Bling antes de qualquer unificação. Nada é mesclado nem alterado por esta ferramenta.')
  into r;
  return r;
end $$;

create function public.verificar_cruzados_do_sku(p_loja uuid, p_sku text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_prod uuid; r jsonb;
begin
  select id into v_prod from public.produtos where loja_id = p_loja and sku = p_sku limit 1;
  if v_prod is null then return jsonb_build_object('erro', 'Produto não encontrado nesta loja.'); end if;
  select jsonb_build_object(
    'sku', p_sku,
    'pecas', coalesce((select jsonb_agg(jsonb_build_object(
        'codigo', p.codigo, 'classe', p.classe, 'relacao_com_o_sku', pp.relacao, 'status_da_ligacao', pp.status,
        'cruzados_diretos', coalesce((select jsonb_agg(jsonb_build_object(
            'codigo', d.codigo, 'classe', d.classe, 'tipo', r2.tipo, 'status', r2.status, 'restricoes', r2.restricoes, 'evidencia', r2.evidencia_validacao))
          from public.ref_cruzada r2 join public.pecas_ref d on d.id = case when r2.origem_peca_id = p.id then r2.destino_peca_id else r2.origem_peca_id end
          where r2.origem_peca_id = p.id or r2.destino_peca_id = p.id), '[]'::jsonb)))
      from public.produto_pecas_ref pp join public.pecas_ref p on p.id = pp.peca_id where pp.produto_id = v_prod and pp.loja_id = p_loja), '[]'::jsonb),
    'aviso', 'Só relações DIRETAS. A→B e B→C não geram A→C. Sem relação registrada = não confirmado, não incompatível.') into r;
  if jsonb_array_length(r->'pecas') = 0 then
    r := r || jsonb_build_object('observacao', 'Este SKU não está ligado a nenhuma peça de referência; nada a verificar.');
  end if;
  return r;
end $$;

create function public.validar_aplicacoes_do_sku(p_loja uuid, p_sku text, p_ano int default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_prod uuid; itens jsonb; v_conf boolean;
begin
  select id into v_prod from public.produtos where loja_id = p_loja and sku = p_sku limit 1;
  if v_prod is null then return jsonb_build_object('erro', 'Produto não encontrado nesta loja.'); end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into itens from (
    select jsonb_build_object(
      'peca', p.codigo, 'versao', v.nome_comercial, 'modelo', mo.nome, 'montadora', ma.nome, 'mercado', v.mercado,
      'status', a.status, 'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim, 'restricoes', a.restricoes,
      'ano_consultado', p_ano,
      'ano_dentro_do_periodo', case when p_ano is null then null else (a.periodo_inicio is not null and p_ano >= a.periodo_inicio and p_ano <= coalesce(a.periodo_fim, 9999)) end,
      'eventos_no_brasil', (select coalesce(jsonb_agg(jsonb_build_object('tipo', e.tipo, 'data', e.data_evento, 'precisao', e.precisao, 'status', e.status)), '[]'::jsonb)
                            from public.eventos_veiculo e where e.versao_id = v.id and (e.mercado is null or e.mercado = 'BR')),
      'confirmada', a.status = 'aprovado' and (p_ano is null or (a.periodo_inicio is not null and p_ano >= a.periodo_inicio and p_ano <= coalesce(a.periodo_fim, 9999)))
    ) as x
    from public.produto_pecas_ref pp
    join public.pecas_ref p on p.id = pp.peca_id
    join public.pecas_aplicacoes_tecnicas a on a.peca_id = p.id
    join public.versoes v on v.id = a.versao_id and v.mercado = 'BR'
    join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id join public.montadoras ma on ma.id = mo.montadora_id
    where pp.produto_id = v_prod and pp.loja_id = p_loja
  ) s;
  select exists (select 1 from jsonb_array_elements(itens) i where (i->>'confirmada')::boolean) into v_conf;
  return jsonb_build_object('sku', p_sku, 'resultado', case when v_conf then 'confirmada' else 'nao_confirmada' end, 'aplicacoes', itens,
    'aviso', 'Só aplicações do mercado BR por VERSÃO do veículo. "nao_confirmada" significa sem registro aprovado que cubra o caso — nunca "incompatível". Mesmo motor não prova compatibilidade.');
end $$;

revoke all on function public.detectar_duplicidade(uuid, text, text, text), public.verificar_cruzados_do_sku(uuid, text), public.validar_aplicacoes_do_sku(uuid, text, int) from public, anon, authenticated;
grant execute on function public.detectar_duplicidade(uuid, text, text, text), public.verificar_cruzados_do_sku(uuid, text), public.validar_aplicacoes_do_sku(uuid, text, int) to service_role;
