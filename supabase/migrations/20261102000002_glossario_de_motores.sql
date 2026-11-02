-- Glossário de motores para a resolução de entidades do Nano (PR #242). SÓ LEITURA, só service_role, como vocabulario_de_busca.
-- Vem do cadastro de genealogia técnica (motores x versao_motor): nada é escrito de memória no código. Cada termo carrega o status do cadastro
-- (a_confirmar/aprovado) e é usado só como TERMO CANDIDATO de busca; o código nunca trata dois códigos como equivalentes.
-- NÃO APLICADA em produção: depende de aprovação do dono. Reversão: drop function public.glossario_de_motores();
create function public.glossario_de_motores() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('termos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', mt.codigo,
      'cilindrada', case when mt.cilindrada_cc is null then null else round(mt.cilindrada_cc / 1000.0, 1)::text end,
      'status', mt.status,
      'aplicacoes', coalesce((
        select jsonb_agg(jsonb_build_object('montadora', ma.nome, 'modelo', mo.nome, 'de', vm.periodo_inicio, 'ate', vm.periodo_fim))
        from public.versao_motor vm
        join public.versoes v on v.id = vm.versao_id
        join public.geracoes g on g.id = v.geracao_id
        join public.modelos mo on mo.id = g.modelo_id
        join public.montadoras ma on ma.id = mo.montadora_id
        where vm.motor_id = mt.id), '[]'::jsonb)
    ) order by mt.codigo)
    from public.motores mt), '[]'::jsonb));
$$;
revoke all on function public.glossario_de_motores() from public, anon, authenticated;
grant execute on function public.glossario_de_motores() to service_role;
