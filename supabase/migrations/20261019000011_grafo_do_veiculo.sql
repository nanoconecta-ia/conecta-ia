-- Consulta do grafo técnico: Montadora → modelo → geração → versão → motor → peça (com sistema/componente, fabricante e referência).
-- Relações muitos-para-muitos e com INTERVALOS de aplicação. Só leitura. Por padrão só mostra o que está APROVADO.
-- Aplicação por MOTOR não prova a versão: a peça vem marcada com base = 'motor' e um aviso. Nada é deduzido pela descrição.
create function public.grafo_do_veiculo(p_versao uuid, p_ano int default null, p_apenas_aprovados boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_veiculo jsonb; v_motores jsonb; v_pecas jsonb;
begin
  select jsonb_build_object('versao_id', v.id, 'versao', v.nome_comercial, 'mercado', v.mercado, 'geracao', g.ordem, 'modelo', mo.nome, 'montadora', ma.nome)
    into v_veiculo
    from public.versoes v join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id join public.montadoras ma on ma.id = mo.montadora_id
    where v.id = p_versao;
  if v_veiculo is null then return jsonb_build_object('erro', 'Versão do veículo não encontrada.'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('motor_id', m.id, 'familia', f.nome, 'codigo', m.codigo, 'variante', m.variante, 'cilindrada_cc', m.cilindrada_cc,
      'sistema_emissoes', m.sistema_emissoes, 'periodo_inicio', vm.periodo_inicio, 'periodo_fim', vm.periodo_fim, 'status', vm.status) order by m.codigo, m.variante), '[]'::jsonb)
    into v_motores
    from public.versao_motor vm join public.motores m on m.id = vm.motor_id join public.familias_motor f on f.id = m.familia_id
    where vm.versao_id = p_versao and (not p_apenas_aprovados or vm.status = 'aprovado')
      and (p_ano is null or ((vm.periodo_inicio is null or vm.periodo_inicio <= p_ano) and (vm.periodo_fim is null or vm.periodo_fim >= p_ano)));

  select coalesce(jsonb_agg(x order by x->>'codigo'), '[]'::jsonb) into v_pecas from (
    select jsonb_build_object('peca_id', p.id, 'codigo', p.codigo, 'classe', p.classe, 'descricao', p.descricao, 'status_da_aplicacao', a.status,
        'base', case when a.versao_id is not null then 'versao' else 'motor' end,
        'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim, 'restricoes', a.restricoes, 'faixa_serie', a.faixa_serie,
        'fabricante', (select fp.nome from public.fabricantes_peca fp where fp.id = p.fabricante_id),
        'sistema_componente', (select t.nome from public.taxonomia_nos t where t.id = p.taxonomia_no_id),
        'aviso', case when a.versao_id is null then 'aplicação por motor: não prova a versão do veículo' when a.periodo_inicio is null then 'sem período de aplicação' end) as x
    from public.pecas_aplicacoes_tecnicas a join public.pecas_ref p on p.id = a.peca_id
    where (a.versao_id = p_versao or (a.versao_id is null and a.motor_id in (select vm.motor_id from public.versao_motor vm where vm.versao_id = p_versao)))
      and (not p_apenas_aprovados or a.status = 'aprovado')
      and (p_ano is null or a.periodo_inicio is null or ((a.periodo_inicio <= p_ano) and (a.periodo_fim is null or a.periodo_fim >= p_ano)))
  ) s;

  return jsonb_build_object('veiculo', v_veiculo, 'ano_consultado', p_ano, 'motores', v_motores, 'pecas', v_pecas,
    'aviso', 'Somente dado aprovado por padrão. Peça sem registro aqui significa NÃO CONFIRMADA, nunca incompatível.');
end $$;
revoke all on function public.grafo_do_veiculo(uuid, int, boolean) from public, anon, authenticated;
grant execute on function public.grafo_do_veiculo(uuid, int, boolean) to service_role;
