-- Migração 18: genealogia técnica (picapes, vans e utilitários diesel leves) e grafo de referências cruzadas.
-- Catálogo GLOBAL (sem loja_id): leitura para quem está logado; escrita só pelo servidor (service_role).
-- Regras: nenhum dado sem fonte quando aprovado; data de evento nunca sem evidência; sem equivalência transitiva;
-- classe da peça (genuína / OEM / OES / aftermarket / referência cruzada) exige a evidência da sua classe.

-- 1) Fontes (toda afirmação aponta para uma).
create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('catalogo_montadora', 'epc', 'doc_fabricante_componente', 'boletim_servico',
    'homologacao', 'doc_importador', 'base_licenciada', 'associacao_padrao', 'catalogo_comercial', 'outra')),
  titulo text not null check (length(btrim(titulo)) > 0),
  url text,
  documento text,
  versao text,
  publicada_em date,
  mercado text,
  condicoes_uso text,
  licenciada boolean not null default false,
  coletada_em timestamptz not null default now(),
  check (url is not null or documento is not null)
);

-- 2) Árvore do veículo: montadora → plataforma → modelo → geração → versão (por mercado).
create table public.montadoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pais_origem text,
  unique (nome)
);
create table public.plataformas (
  id uuid primary key default gen_random_uuid(),
  montadora_id uuid not null references public.montadoras(id) on delete restrict,
  nome text not null,
  unique (montadora_id, nome)
);
create table public.modelos (
  id uuid primary key default gen_random_uuid(),
  montadora_id uuid not null references public.montadoras(id) on delete restrict,
  plataforma_id uuid references public.plataformas(id),
  nome text not null,
  categoria text not null check (categoria in ('picape', 'van', 'furgao', 'utilitario', 'suv')),
  unique (montadora_id, nome)
);
create table public.geracoes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references public.modelos(id) on delete restrict,
  ordem int not null check (ordem > 0),
  codigo_interno text,                       -- código de projeto/chassi da geração, se documentado
  descricao text,
  unique (modelo_id, ordem)
);
create table public.versoes (
  id uuid primary key default gen_random_uuid(),
  geracao_id uuid not null references public.geracoes(id) on delete restrict,
  mercado text not null check (length(btrim(mercado)) > 0),        -- 'BR', 'mundial', 'EU'...
  nome_comercial text not null,                                    -- o nome muda por país
  carroceria text,
  tracao text,
  transmissao text,
  unique (geracao_id, mercado, nome_comercial)
);

-- 3) Eventos: lançamento mundial, fabricação, importação, homologação e comercialização são fatos DISTINTOS.
create table public.eventos_veiculo (
  id uuid primary key default gen_random_uuid(),
  geracao_id uuid references public.geracoes(id) on delete cascade,
  versao_id uuid references public.versoes(id) on delete cascade,
  tipo text not null check (tipo in ('lancamento_mundial', 'inicio_fabricacao', 'fim_fabricacao', 'inicio_montagem_nacional',
    'fim_montagem_nacional', 'inicio_importacao', 'fim_importacao', 'homologacao', 'inicio_comercializacao_br',
    'fim_comercializacao_br', 'mudanca_emissoes', 'revisao_engenharia')),
  mercado text,
  data_evento date,
  precisao text check (precisao in ('dia', 'mes', 'ano')),
  descricao text,
  fonte_id uuid references public.fontes(id),
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (geracao_id is not null or versao_id is not null),
  check (data_evento is null or (precisao is not null and fonte_id is not null)),   -- data só com evidência
  check (status <> 'aprovado' or fonte_id is not null)
);
create index on public.eventos_veiculo (geracao_id);
create index on public.eventos_veiculo (versao_id);

create table public.homologacoes (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.versoes(id) on delete cascade,
  tipo_documento text not null,
  autoridade_emissora text not null,
  numero text not null,                       -- nunca inventado
  mercado text not null,
  valido_de date,
  valido_ate date,
  fonte_id uuid not null references public.fontes(id),
  check (valido_ate is null or valido_de is null or valido_ate >= valido_de),
  unique (versao_id, autoridade_emissora, numero)
);

-- 4) Motores: identidade própria. Mesma família NÃO prova peça intercambiável.
create table public.familias_motor (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,                  -- 'D4CB', '4D56', '1KD-FTV'
  fabricante text,
  desenvolvedor text,
  observacao text
);
create table public.motores (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias_motor(id) on delete restrict,
  codigo text not null,
  variante text not null default '',
  geracao text,
  cilindrada_cc int check (cilindrada_cc > 0),
  combustivel text not null default 'diesel',
  aspiracao text,
  sistema_injecao text,
  sistema_emissoes text,
  potencia_kw numeric(7,2),
  torque_nm numeric(7,2),
  producao_inicio int check (producao_inicio between 1900 and 2100),
  producao_fim int check (producao_fim between 1900 and 2100),
  faixa_serie text,                           -- faixas de número de série relevantes, se documentadas
  boletins text[] not null default '{}',
  fonte_id uuid references public.fontes(id),
  status public.status_enriquecimento not null default 'a_confirmar',
  check (producao_fim is null or producao_inicio is null or producao_fim >= producao_inicio),
  check (status <> 'aprovado' or fonte_id is not null),
  unique (familia_id, codigo, variante)
);
create table public.versao_motor (
  versao_id uuid not null references public.versoes(id) on delete cascade,
  motor_id uuid not null references public.motores(id) on delete restrict,
  periodo_inicio int check (periodo_inicio between 1900 and 2100),
  periodo_fim int check (periodo_fim between 1900 and 2100),
  fonte_id uuid references public.fontes(id),
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  primary key (versao_id, motor_id),
  check (status <> 'aprovado' or fonte_id is not null)
);

-- 5) Relações explícitas (não só hierarquia): plataforma/motor/componente compartilhado, mudança de nome, aquisição.
create table public.relacoes_tecnicas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('plataforma_compartilhada', 'motor_compartilhado', 'componente_compartilhado',
    'mesmo_veiculo_outro_nome', 'derivado_de', 'aliança_industrial', 'aquisição')),
  origem_tabela text not null check (origem_tabela in ('montadoras', 'plataformas', 'modelos', 'geracoes', 'versoes', 'motores', 'pecas_ref')),
  origem_id uuid not null,
  destino_tabela text not null check (destino_tabela in ('montadoras', 'plataformas', 'modelos', 'geracoes', 'versoes', 'motores', 'pecas_ref')),
  destino_id uuid not null,
  observacao text,
  fonte_id uuid references public.fontes(id),
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  check (not (origem_tabela = destino_tabela and origem_id = destino_id)),
  check (status <> 'aprovado' or fonte_id is not null)
);

-- 6) Peças: fabricantes, fornecimento original (com evidência) e catálogo de referências por CLASSE.
create table public.fabricantes_peca (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pais text,
  unique (nome)
);

create table public.fornecedores_oem (
  id uuid primary key default gen_random_uuid(),
  fabricante_id uuid not null references public.fabricantes_peca(id) on delete restrict,
  montadora_id uuid not null references public.montadoras(id) on delete restrict,
  taxonomia_no_id uuid references public.taxonomia_nos(id),   -- por categoria de componente: nunca por marca inteira
  motor_id uuid references public.motores(id),
  tipo text not null check (tipo in ('primeiro_equipamento', 'oes')),
  periodo_inicio int check (periodo_inicio between 1900 and 2100),
  periodo_fim int check (periodo_fim between 1900 and 2100),
  fonte_id uuid not null references public.fontes(id),       -- sem evidência não existe a relação
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio)
);
create unique index fornecedores_oem_unico on public.fornecedores_oem
  (fabricante_id, montadora_id, coalesce(taxonomia_no_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(motor_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo);

create table public.pecas_ref (
  id uuid primary key default gen_random_uuid(),
  classe text not null check (classe in ('genuina', 'oem_primeiro_equipamento', 'oes', 'aftermarket_equivalente')),
  fabricante_id uuid references public.fabricantes_peca(id),   -- quem fabrica (todas, menos genuína pura)
  montadora_id uuid references public.montadoras(id),          -- dona do código (genuína) ou cliente OEM/OES
  codigo text not null check (length(btrim(codigo)) > 0),
  descricao text,
  taxonomia_no_id uuid references public.taxonomia_nos(id),
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (classe <> 'genuina' or montadora_id is not null),
  check (classe = 'genuina' or fabricante_id is not null),
  check (classe not in ('oem_primeiro_equipamento', 'oes') or montadora_id is not null),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null))
);
create unique index pecas_ref_unica on public.pecas_ref
  (classe, coalesce(fabricante_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(montadora_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(btrim(codigo)));
create index on public.pecas_ref (upper(btrim(codigo)));

-- OEM/OES só se aprova com fornecimento original documentado (marca fornecer uma peça ≠ fornecer todas).
create function private.exige_fornecedor_oem() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.status = 'aprovado' and new.classe in ('oem_primeiro_equipamento', 'oes') then
    if not exists (
      select 1 from public.fornecedores_oem f
      where f.fabricante_id = new.fabricante_id and f.montadora_id = new.montadora_id
        and f.status = 'aprovado'
        and f.tipo = case new.classe when 'oes' then 'oes' else 'primeiro_equipamento' end
        and (f.taxonomia_no_id is null or new.taxonomia_no_id is null or f.taxonomia_no_id = new.taxonomia_no_id)
    ) then
      raise exception 'peça % não pode ser aprovada como %: falta fornecimento original aprovado e documentado', new.codigo, new.classe
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.exige_fornecedor_oem() from public;
create trigger pecas_ref_exige_fornecedor before insert or update on public.pecas_ref
  for each row execute function private.exige_fornecedor_oem();

-- Onde a peça se aplica tecnicamente (versão ou motor), com restrições e período.
create table public.pecas_aplicacoes_tecnicas (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas_ref(id) on delete cascade,
  versao_id uuid references public.versoes(id),
  motor_id uuid references public.motores(id),
  mercado text,
  periodo_inicio int check (periodo_inicio between 1900 and 2100),
  periodo_fim int check (periodo_fim between 1900 and 2100),
  faixa_serie text,
  restricoes text,
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  check (versao_id is not null or motor_id is not null),
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null))
);
create index on public.pecas_aplicacoes_tecnicas (peca_id);

-- 7) Grafo de referências cruzadas. Aresta direta, sem fecho transitivo: A→B e B→C NÃO geram A→C.
create table public.ref_cruzada (
  id uuid primary key default gen_random_uuid(),
  origem_peca_id uuid not null references public.pecas_ref(id) on delete cascade,
  destino_peca_id uuid not null references public.pecas_ref(id) on delete cascade,
  tipo text not null check (tipo in ('referencia_cruzada', 'equivalente_validado', 'substituicao_engenharia', 'substituto_homologado')),
  mercado text,
  periodo_inicio int check (periodo_inicio between 1900 and 2100),
  periodo_fim int check (periodo_fim between 1900 and 2100),
  restricoes text,
  evidencia_validacao text,                    -- como a equivalência/substituição foi comprovada
  revisao_engenharia text,
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (origem_peca_id <> destino_peca_id),
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null)),
  check (status <> 'aprovado' or tipo = 'referencia_cruzada' or evidencia_validacao is not null)
);
create unique index ref_cruzada_unica on public.ref_cruzada (origem_peca_id, destino_peca_id, tipo, coalesce(mercado, ''));
create index on public.ref_cruzada (origem_peca_id);
create index on public.ref_cruzada (destino_peca_id);

-- Última ponte: peça de referência ↔ SKU do lojista (por loja).
create table public.produto_pecas_ref (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  peca_id uuid not null references public.pecas_ref(id) on delete restrict,
  relacao text not null check (relacao in ('e_esta_peca', 'equivalente_declarado', 'referencia_cruzada')),
  fonte_id uuid references public.fontes(id),
  verificado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (status <> 'aprovado' or (fonte_id is not null and verificado_em is not null)),
  unique (produto_id, peca_id, relacao)
);
create index on public.produto_pecas_ref (loja_id, produto_id);

-- 8) RLS e grants. Catálogo global: leitura para logados; vitrine pública (anon) não enxerga nada daqui.
do $$
declare t text;
begin
  foreach t in array array['fontes', 'montadoras', 'plataformas', 'modelos', 'geracoes', 'versoes', 'eventos_veiculo',
    'homologacoes', 'familias_motor', 'motores', 'versao_motor', 'relacoes_tecnicas', 'fabricantes_peca',
    'fornecedores_oem', 'pecas_ref', 'pecas_aplicacoes_tecnicas', 'ref_cruzada', 'produto_pecas_ref']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    if t <> 'produto_pecas_ref' then
      execute format('grant select on public.%I to authenticated', t);
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_ver', t);
    end if;
  end loop;
end $$;

grant select on public.produto_pecas_ref to authenticated;
create policy produto_pecas_ref_ver on public.produto_pecas_ref for select to authenticated
  using (private.pode_ver_loja(loja_id));
