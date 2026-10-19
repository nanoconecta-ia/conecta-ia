-- Camada de conhecimento automotivo (briefing do dono, 2026-10-19). Só ADIÇÕES, sem tocar no que existe.
-- Nada é preenchido aqui: papéis, regime de montagem, medidas e contraindicações só entram com FONTE e passam pela aprovação humana.
--
-- (1) Quem é quem: montadora de veículo ≠ fabricante de motor independente (ex.: motores usados em pesados, agrícola, linha amarela)
--     ≠ sistemista/fabricante de autopeça ≠ marca de lubrificante/filtro. Taxonomia de ATORES, separada da árvore funcional.
-- (2) Brasil: regime de montagem da versão (importado pronto, CKD/SKD, nacional) e propulsão, com fonte. A versão BR pode diferir da
--     original; a data que vale é a de homologação/importação/comercialização (eventos_veiculo).
-- (3) Bula técnica: medidas e especificações de chão de fábrica por peça (mm, espessura de junta, altura...), com fonte, e CONTRAINDICAÇÕES
--     de montagem. Sem a bula exigida para a família, a peça não é "pronta".
-- (4) Intercâmbio entre fabricantes (a mesma peça fabricada por vários) e filtros públicos da vitrine, só com dado aprovado.

-- ------------------------------------------------------------------ (1) papéis dos atores
alter table public.fabricantes_peca
  add column papel text check (papel in ('sistemista_autopeca', 'fabricante_motor', 'marca_lubrificante_filtro', 'outro')),
  add column segmentos text[] not null default '{}',
  add column papel_fonte_id uuid references public.fontes(id),
  add check (papel is null or papel_fonte_id is not null),                       -- classificar sem fonte não vale
  add check (segmentos <@ array['leve', 'pesado', 'agricola', 'linha_amarela', 'industrial', 'marinho', 'motocicleta']::text[]);
comment on column public.fabricantes_peca.papel is 'Fabricante de motor (que atende vários segmentos) NÃO é montadora de veículo: montadoras ficam em public.montadoras.';

-- ------------------------------------------------------------------ (2) versão no Brasil
alter table public.versoes
  add column regime_montagem text check (regime_montagem in ('importado_pronto', 'ckd', 'skd', 'nacional')),
  add column propulsao text check (propulsao in ('combustao', 'hibrido', 'eletrico')),
  add column diferencas_da_original text,                                        -- o que a versão BR muda em relação à original
  add column regime_fonte_id uuid references public.fontes(id),
  add check ((regime_montagem is null and diferencas_da_original is null) or regime_fonte_id is not null);

-- ------------------------------------------------------------------ (3) bula técnica
create table public.especificacoes_exigidas (
  id uuid primary key default gen_random_uuid(),
  taxonomia_no_id uuid not null references public.taxonomia_nos(id) on delete cascade,   -- família da peça
  nome text not null check (length(btrim(nome)) > 0),                            -- ex.: espessura, diâmetro, altura
  unidade text not null check (unidade in ('mm', 'cm', 'm', 'g', 'kg', 'nm', 'bar', 'l', 'graus', 'un')),
  origem text not null check (length(btrim(origem)) > 0),
  status text not null default 'proposta' check (status in ('proposta', 'aprovada', 'aposentada')),
  criado_em timestamptz not null default now()
);
create unique index especificacoes_exigidas_unica on public.especificacoes_exigidas (taxonomia_no_id, lower(nome));

create table public.peca_especificacoes (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas_ref(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  valor_num numeric,
  unidade text not null check (unidade in ('mm', 'cm', 'm', 'g', 'kg', 'nm', 'bar', 'l', 'graus', 'un')),
  tolerancia text,
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null and valor_num is not null))   -- medida sem fonte e sem valor não se aprova
);
create unique index peca_especificacoes_unica on public.peca_especificacoes (peca_id, lower(nome));

create table public.peca_contraindicacoes (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas_ref(id) on delete cascade,
  versao_id uuid references public.versoes(id),                                  -- quando vale só para uma versão
  motor_id uuid references public.motores(id),
  tipo text not null check (tipo in ('montagem', 'compatibilidade', 'torque', 'uso')),
  texto text not null check (length(btrim(texto)) > 0),
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null))
);
create index on public.peca_contraindicacoes (peca_id);

do $$ declare t text; begin
  foreach t in array array['especificacoes_exigidas', 'peca_especificacoes', 'peca_contraindicacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_ver', t);
  end loop;
end $$;

-- ponte da árvore de categorias da loja com a árvore funcional (ícone); nulo = ícone "outros"
alter table public.taxonomia_nos add column sistema_id uuid references public.sistemas_mecanicos(id);

-- ------------------------------------------------------------------ funções (leitura; só service_role)

-- Bula técnica de um SKU: o que falta para a peça ser publicada sem risco de compra errada, e as contraindicações aprovadas.
create function public.bula_tecnica_do_sku(p_loja uuid, p_sku text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_prod public.produtos; v_peca record; v_pecas jsonb := '[]'; v_falta jsonb; v_contra jsonb; v_specs jsonb;
begin
  select * into v_prod from public.produtos where loja_id = p_loja and sku = p_sku;
  if not found then return jsonb_build_object('erro', 'SKU não encontrado nesta loja.'); end if;
  for v_peca in
    select p.id, p.codigo, p.taxonomia_no_id from public.produto_pecas_ref pp join public.pecas_ref p on p.id = pp.peca_id
    where pp.loja_id = p_loja and pp.produto_id = v_prod.id and pp.status = 'aprovado' and pp.relacao = 'e_esta_peca'
  loop
    select coalesce(jsonb_agg(jsonb_build_object('nome', e.nome, 'valor', s.valor_num, 'unidade', s.unidade, 'tolerancia', s.tolerancia) order by e.nome), '[]')
      into v_specs from public.peca_especificacoes s join public.especificacoes_exigidas e on lower(e.nome) = lower(s.nome) and e.taxonomia_no_id = v_peca.taxonomia_no_id and e.status = 'aprovada'
      where s.peca_id = v_peca.id and s.status = 'aprovado';
    select coalesce(jsonb_agg(jsonb_build_object('nome', e.nome, 'unidade', e.unidade) order by e.nome), '[]')
      into v_falta from public.especificacoes_exigidas e
      where e.taxonomia_no_id = v_peca.taxonomia_no_id and e.status = 'aprovada'
        and not exists (select 1 from public.peca_especificacoes s where s.peca_id = v_peca.id and lower(s.nome) = lower(e.nome) and s.status = 'aprovado');
    select coalesce(jsonb_agg(jsonb_build_object('tipo', c.tipo, 'texto', c.texto, 'versao_id', c.versao_id, 'motor_id', c.motor_id) order by c.tipo), '[]')
      into v_contra from public.peca_contraindicacoes c where c.peca_id = v_peca.id and c.status = 'aprovado';
    v_pecas := v_pecas || jsonb_build_array(jsonb_build_object('codigo', v_peca.codigo, 'medidas', v_specs, 'medidas_faltando', v_falta, 'contraindicacoes', v_contra,
      'bula_completa', (jsonb_array_length(v_falta) = 0 and v_peca.taxonomia_no_id is not null)));
  end loop;
  return jsonb_build_object('sku', p_sku, 'pecas', v_pecas,
    'bula_completa', jsonb_array_length(v_pecas) > 0 and not exists (select 1 from jsonb_array_elements(v_pecas) x where (x->>'bula_completa')::boolean is not true),
    'aviso', 'Sem peça aprovada, sem categoria ou com medida exigida faltando, a bula NÃO está completa: não se inventa medida.');
end $$;

-- Intercâmbio: a mesma peça fabricada por outras marcas, só por relação DIRETA (sem transitividade), com o tipo de evidência.
create function public.intercambio_da_peca(p_codigo text, p_apenas_aprovados boolean default true) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')); v_itens jsonb;
begin
  if length(v) < 3 then return jsonb_build_object('erro', 'Informe o código da peça (mínimo 3 caracteres).'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('codigo', d.codigo, 'classe', d.classe, 'fabricante', f.nome, 'papel', f.papel, 'segmentos', f.segmentos,
      'relacao', r.tipo, 'evidencia', coalesce(r.evidencia_validacao, 'referência cruzada de fonte (não prova equivalência)'), 'restricoes', r.restricoes,
      'periodo_inicio', r.periodo_inicio, 'periodo_fim', r.periodo_fim, 'status', r.status) order by f.nome, d.codigo), '[]')
  into v_itens
  from public.pecas_ref o
  join public.ref_cruzada r on r.origem_peca_id = o.id and (not p_apenas_aprovados or r.status = 'aprovado')
  join public.pecas_ref d on d.id = r.destino_peca_id
  left join public.fabricantes_peca f on f.id = d.fabricante_id
  where upper(regexp_replace(o.codigo, '[^A-Za-z0-9]', '', 'g')) = v;
  return jsonb_build_object('codigo_normalizado', v, 'equivalentes', v_itens,
    'aviso', 'Só relações diretas. Equivalente não é idêntico: confira medidas e a bula técnica antes de ofertar.');
end $$;

-- Filtros da vitrine: categorias (com ícone), montadoras e fabricantes dos produtos PUBLICADOS com estoque, só com ligação aprovada.
create function public.filtros_da_vitrine(p_loja uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cat jsonb; v_mont jsonb; v_fab jsonb;
begin
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]') into v_cat from (
    select jsonb_build_object('slug', n.slug, 'nome', n.nome, 'icone', coalesce(public.icone_do_sistema(n.sistema_id), 'outros'), 'total', count(*)) x
    from public.produtos pr join public.taxonomia_nos n on n.id = pr.taxonomia_no_id
    where pr.loja_id = p_loja and pr.publicado and coalesce(pr.estoque, 0) > 0
    group by n.id, n.slug, n.nome, n.sistema_id) t;
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]') into v_mont from (
    select jsonb_build_object('nome', m.nome, 'total', count(distinct pr.id)) x
    from public.produtos pr
    join public.produto_pecas_ref pp on pp.produto_id = pr.id and pp.loja_id = p_loja and pp.status = 'aprovado' and pp.relacao = 'e_esta_peca'
    join public.pecas_aplicacoes_tecnicas a on a.peca_id = pp.peca_id and a.status = 'aprovado' and a.versao_id is not null
    join public.versoes v on v.id = a.versao_id join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id join public.montadoras m on m.id = mo.montadora_id
    where pr.loja_id = p_loja and pr.publicado and coalesce(pr.estoque, 0) > 0
    group by m.id, m.nome) t;
  select coalesce(jsonb_agg(x order by x->>'nome'), '[]') into v_fab from (
    select jsonb_build_object('nome', f.nome, 'total', count(distinct pr.id)) x
    from public.produtos pr
    join public.produto_pecas_ref pp on pp.produto_id = pr.id and pp.loja_id = p_loja and pp.status = 'aprovado' and pp.relacao = 'e_esta_peca'
    join public.pecas_ref p on p.id = pp.peca_id join public.fabricantes_peca f on f.id = p.fabricante_id
    where pr.loja_id = p_loja and pr.publicado and coalesce(pr.estoque, 0) > 0
    group by f.id, f.nome) t;
  return jsonb_build_object('categorias', v_cat, 'montadoras', v_mont, 'fabricantes', v_fab);
end $$;

-- Bloco de aplicações de um produto PUBLICADO: montadora ▸ modelo ▸ versão, com período e regime de montagem.
create function public.aplicacoes_publicas_do_produto(p_loja uuid, p_sku text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_itens jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('montadora', m.nome, 'modelo', mo.nome, 'versao', v.nome_comercial, 'mercado', v.mercado,
      'periodo_inicio', a.periodo_inicio, 'periodo_fim', a.periodo_fim, 'restricoes', a.restricoes, 'regime_montagem', v.regime_montagem, 'propulsao', v.propulsao)
      order by m.nome, mo.nome, v.nome_comercial), '[]')
  into v_itens
  from public.produtos pr
  join public.produto_pecas_ref pp on pp.produto_id = pr.id and pp.loja_id = p_loja and pp.status = 'aprovado' and pp.relacao = 'e_esta_peca'
  join public.pecas_aplicacoes_tecnicas a on a.peca_id = pp.peca_id and a.status = 'aprovado' and a.versao_id is not null
  join public.versoes v on v.id = a.versao_id join public.geracoes g on g.id = v.geracao_id join public.modelos mo on mo.id = g.modelo_id join public.montadoras m on m.id = mo.montadora_id
  where pr.loja_id = p_loja and pr.sku = p_sku and pr.publicado;
  return jsonb_build_object('sku', p_sku, 'aplicacoes', v_itens,
    'aviso', 'Só aplicações aprovadas por VERSÃO. Ausência de linha significa não confirmado, não incompatível.');
end $$;

revoke all on function public.bula_tecnica_do_sku(uuid, text), public.intercambio_da_peca(text, boolean), public.filtros_da_vitrine(uuid), public.aplicacoes_publicas_do_produto(uuid, text) from public, anon, authenticated;
grant execute on function public.bula_tecnica_do_sku(uuid, text), public.intercambio_da_peca(text, boolean), public.filtros_da_vitrine(uuid), public.aplicacoes_publicas_do_produto(uuid, text) to service_role;
