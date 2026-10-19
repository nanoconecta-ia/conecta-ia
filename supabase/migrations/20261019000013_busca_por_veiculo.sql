-- Busca por veículo, 100% gratuita e offline: (1) compartilhamento de componentes entre montadoras parceiras como HIPÓTESE a verificar,
-- (2) catálogo da loja filtrado pelo veículo. Leitura de chassi/placa ficou FORA deste plano (depende de base pública/Detran): branch plano/leitura-por-chassi.
-- Nada aqui consulta serviço externo, raspa site nem usa dado pessoal do dono do veículo.

-- (1) Onde mais uma peça PODERIA servir porque a versão compartilha o motor com uma versão onde ela está aprovada.
-- Compartilhar motor, câmbio ou plataforma entre parceiras (ex.: Hyundai e Kia) é pista, NUNCA prova: o resultado é sempre "hipotese".
create function public.candidatas_por_compartilhamento(p_codigo text, p_apenas_aprovados boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_norm text := upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g')); v_res jsonb;
begin
  if length(v_norm) < 5 then return jsonb_build_object('erro', 'Informe o código completo (mínimo 5 caracteres).'); end if;
  with pecas as (select id from public.pecas_ref where upper(regexp_replace(codigo, '[^0-9A-Za-z]', '', 'g')) = v_norm and (not p_apenas_aprovados or status = 'aprovado')),
  base as (select a.versao_id, a.motor_id from public.pecas_aplicacoes_tecnicas a join pecas p on p.id = a.peca_id where a.status = 'aprovado'),
  motores_base as (
    select motor_id from base where motor_id is not null
    union select vm.motor_id from base b join public.versao_motor vm on vm.versao_id = b.versao_id and vm.status = 'aprovado' where b.versao_id is not null),
  cand as (
    select distinct vm.versao_id, vm.motor_id, vm.periodo_inicio, vm.periodo_fim from public.versao_motor vm join motores_base mb on mb.motor_id = vm.motor_id
    where vm.status = 'aprovado' and vm.versao_id not in (select versao_id from base where versao_id is not null))
  select coalesce(jsonb_agg(jsonb_build_object(
      'situacao', 'hipotese',
      'veiculo', jsonb_build_object('versao_id', v.id, 'montadora', ma.nome, 'modelo', mo.nome, 'geracao', g.ordem, 'versao', v.nome_comercial, 'mercado', v.mercado),
      'motor_compartilhado', (select jsonb_build_object('familia', f.nome, 'codigo', m.codigo, 'variante', m.variante) from public.motores m join public.familias_motor f on f.id = m.familia_id where m.id = c.motor_id),
      'periodo_do_motor', jsonb_build_object('inicio', c.periodo_inicio, 'fim', c.periodo_fim),
      'alianca_entre_montadoras', exists (select 1 from public.relacoes_tecnicas r where r.tipo in ('aliança_industrial', 'aquisição') and r.status = 'aprovado'
        and ((r.origem_tabela = 'montadoras' and r.destino_tabela = 'montadoras') and (r.origem_id = ma.id or r.destino_id = ma.id))),
      'prova_necessaria', 'catálogo oficial, ensaio ou documento para ESTA versão: compartilhar o motor não prova que a peça serve (suportes, flanges, chicotes e conexões mudam)',
      'virar_anuncio', false) order by ma.nome, mo.nome), '[]'::jsonb)
  into v_res
  from cand c join public.versoes v on v.id = c.versao_id join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id join public.montadoras ma on ma.id = mo.montadora_id;
  return jsonb_build_object('codigo_normalizado', v_norm, 'candidatas', v_res, 'aviso', 'Hipóteses a verificar. Nenhuma vira aplicação, anúncio ou "serve" sem fonte própria da versão.');
end $$;

-- (3) O que a loja vende e serve neste veículo e ano: SÓ aplicação aprovada, produto publicado e ligado à peça aprovada. Base "motor" vem avisada.
create function public.pecas_da_loja_para_veiculo(p_loja uuid, p_versao uuid, p_ano int default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_graf jsonb; v_itens jsonb;
begin
  v_graf := public.grafo_do_veiculo(p_versao, p_ano, true);
  if v_graf ? 'erro' then return v_graf; end if;
  select coalesce(jsonb_agg(jsonb_build_object('sku', pr.sku, 'nome', pr.nome, 'preco', pr.preco, 'estoque', pr.estoque, 'peca', g->>'codigo', 'base', g->>'base',
      'periodo_inicio', g->'periodo_inicio', 'periodo_fim', g->'periodo_fim', 'restricoes', g->'restricoes', 'aviso', g->>'aviso') order by pr.nome), '[]'::jsonb)
  into v_itens
  from jsonb_array_elements(v_graf->'pecas') g
  join public.pecas_ref p on p.id = (g->>'peca_id')::uuid
  join public.produto_pecas_ref pp on pp.peca_id = p.id and pp.loja_id = p_loja and pp.status = 'aprovado' and pp.relacao = 'e_esta_peca'
  join public.produtos pr on pr.id = pp.produto_id and pr.loja_id = p_loja and pr.publicado and coalesce(pr.estoque, 0) > 0;
  return jsonb_build_object('veiculo', v_graf->'veiculo', 'ano_consultado', p_ano, 'produtos', v_itens,
    'aviso', 'Mostra só o que tem aplicação aprovada para esta versão. Ausência significa NÃO CONFIRMADO para o veículo: ofereça o atendente.');
end $$;

revoke all on function public.candidatas_por_compartilhamento(text, boolean), public.pecas_da_loja_para_veiculo(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.candidatas_por_compartilhamento(text, boolean), public.pecas_da_loja_para_veiculo(uuid, uuid, int) to service_role;
