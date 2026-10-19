-- Busca direta por código OEM: devolve o "DNA" da peça (classe, fabricante, fonte, aplicações por VERSÃO do veículo, motor,
-- referências cruzadas diretas e SKUs da loja). Só leitura. Por padrão só mostra o que está APROVADO (com fonte e verificação);
-- o que está a confirmar só aparece quando o chamador pede, e vem rotulado. Nada é deduzido: sem registro, avisa que não há dado.
create function public.dna_por_codigo_oem(p_loja uuid, p_codigo text, p_apenas_aprovados boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_norm text := upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g'));
  v_pecas jsonb;
  v_citam jsonb;
  v_ocultas int;
  v_avisos jsonb := '[]'::jsonb;
begin
  if length(v_norm) < 5 then
    return jsonb_build_object('erro', 'Informe o código completo (mínimo 5 caracteres, sem contar hífen ou espaço).');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'peca_id', p.id, 'codigo', p.codigo, 'classe', p.classe, 'status', p.status, 'descricao', p.descricao, 'verificado_em', p.verificado_em,
    'fabricante', (select f.nome from public.fabricantes_peca f where f.id = p.fabricante_id),
    'montadora', (select m.nome from public.montadoras m where m.id = p.montadora_id),
    'fonte', (select jsonb_build_object('titulo', s.titulo, 'url', s.url, 'documento', s.documento) from public.fontes s where s.id = p.fonte_id),
    'aplicacoes', (select coalesce(jsonb_agg(jsonb_build_object(
        'status', a.status, 'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim, 'faixa_serie', a.faixa_serie, 'restricoes', a.restricoes,
        'veiculo', (select jsonb_build_object('montadora', ma.nome, 'modelo', mo.nome, 'geracao', g.ordem, 'versao', v.nome_comercial, 'mercado', v.mercado)
                    from public.versoes v join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id
                    join public.montadoras ma on ma.id = mo.montadora_id where v.id = a.versao_id),
        'motor', (select jsonb_build_object('familia', fm.nome, 'codigo', mt.codigo, 'variante', mt.variante, 'cilindrada_cc', mt.cilindrada_cc,
                    'sistema_emissoes', mt.sistema_emissoes, 'status', mt.status)
                  from public.motores mt join public.familias_motor fm on fm.id = mt.familia_id where mt.id = a.motor_id),
        'motores_da_versao', (select coalesce(jsonb_agg(jsonb_build_object('familia', fm.nome, 'codigo', mt.codigo, 'variante', mt.variante, 'status', vm.status)), '[]'::jsonb)
                  from public.versao_motor vm join public.motores mt on mt.id = vm.motor_id join public.familias_motor fm on fm.id = mt.familia_id
                  where vm.versao_id = a.versao_id and (not p_apenas_aprovados or vm.status = 'aprovado')),
        'aviso', 'mesmo motor não prova compatibilidade: vale a versão do veículo informada acima'))
      , '[]'::jsonb) from public.pecas_aplicacoes_tecnicas a where a.peca_id = p.id and (not p_apenas_aprovados or a.status = 'aprovado')),
    'referencias_cruzadas', (select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', r.tipo, 'status', r.status, 'restricoes', r.restricoes, 'evidencia', r.evidencia_validacao,
        'codigo', d.codigo, 'classe', d.classe, 'fabricante', (select f2.nome from public.fabricantes_peca f2 where f2.id = d.fabricante_id))), '[]'::jsonb)
      from public.ref_cruzada r join public.pecas_ref d on d.id = case when r.origem_peca_id = p.id then r.destino_peca_id else r.origem_peca_id end
      where (r.origem_peca_id = p.id or r.destino_peca_id = p.id) and (not p_apenas_aprovados or r.status = 'aprovado')),
    'produtos_da_loja', (select coalesce(jsonb_agg(jsonb_build_object('sku', pr.sku, 'nome', pr.nome, 'relacao', pp.relacao, 'status', pp.status)), '[]'::jsonb)
      from public.produto_pecas_ref pp join public.produtos pr on pr.id = pp.produto_id
      where pp.peca_id = p.id and pp.loja_id = p_loja and (not p_apenas_aprovados or pp.status = 'aprovado'))
  ) order by p.classe, p.codigo), '[]'::jsonb)
  into v_pecas
  from public.pecas_ref p
  where upper(regexp_replace(p.codigo, '[^0-9A-Za-z]', '', 'g')) = v_norm and (not p_apenas_aprovados or p.status = 'aprovado');

  select count(*) into v_ocultas from public.pecas_ref p
  where upper(regexp_replace(p.codigo, '[^0-9A-Za-z]', '', 'g')) = v_norm and p.status <> 'aprovado';

  -- menções no texto do cadastro da loja: ajuda a achar o SKU, mas NÃO prova aplicação
  select coalesce(jsonb_agg(jsonb_build_object('sku', x.sku, 'nome', x.nome)), '[]'::jsonb) into v_citam
  from (select pr.sku, pr.nome from public.produtos pr
        where pr.loja_id = p_loja
          and upper(regexp_replace(coalesce(pr.descricao_curta, '') || ' ' || coalesce(pr.descricao, ''), '[^0-9A-Za-z]', '', 'g')) like '%' || v_norm || '%'
        order by pr.sku limit 20) x;

  if jsonb_array_length(v_pecas) = 0 then
    v_avisos := v_avisos || to_jsonb('Código não encontrado no catálogo técnico aprovado. Nada foi deduzido.'::text);
  end if;
  if p_apenas_aprovados and v_ocultas > 0 then
    v_avisos := v_avisos || to_jsonb(format('%s registro(s) deste código ainda estão a confirmar e não são exibidos.', v_ocultas));
  end if;
  if jsonb_array_length(v_citam) > 0 then
    v_avisos := v_avisos || to_jsonb('Há SKUs da loja que citam o código no texto do cadastro; isso ajuda a localizar, mas não prova aplicação.'::text);
  end if;

  return jsonb_build_object('codigo_normalizado', v_norm, 'pecas', v_pecas, 'skus_que_citam_o_codigo', v_citam, 'avisos', v_avisos);
end $$;
revoke all on function public.dna_por_codigo_oem(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.dna_por_codigo_oem(uuid, text, boolean) to service_role;
