-- Vocabulário que o interpretador de consultas usa para reconhecer veículo e peça. Vem do cadastro: nada é escrito de memória no código.
-- Só leitura, só service_role. Versões do mercado BR (o que o cliente brasileiro compra).
create function public.vocabulario_de_busca() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object('montadora', m.nome, 'modelo', mo.nome, 'categoria', mo.categoria,
        'versoes', coalesce((select jsonb_agg(distinct v.nome_comercial) from public.geracoes g join public.versoes v on v.geracao_id = g.id where g.modelo_id = mo.id and v.mercado = 'BR'), '[]'::jsonb))
        order by m.nome, mo.nome)
      from public.modelos mo join public.montadoras m on m.id = mo.montadora_id), '[]'::jsonb),
    'pecas', coalesce((select jsonb_agg(jsonb_build_object('slug', n.slug, 'nome', n.nome) order by n.nome) from public.taxonomia_nos n where n.perfil_ramo = 'autopecas'), '[]'::jsonb));
$$;
revoke all on function public.vocabulario_de_busca() from public, anon, authenticated;
grant execute on function public.vocabulario_de_busca() to service_role;
