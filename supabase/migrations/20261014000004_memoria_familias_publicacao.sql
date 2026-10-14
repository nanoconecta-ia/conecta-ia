-- Migração 10: memória do Conecta.IA (famílias técnicas, equivalências entre marcas, modelos de cadastro,
-- entrada de produtos sem cadastro), taxonomia inicial de autopeças, publicação com portão por perfil
-- e vínculo conta-Bling -> loja (webhooks).
-- Regras: nada inventado (aprovado exige fonte+data); clone de produto equivalente entra como RASCUNHO e
-- a compatibilidade copiada fica "a confirmar"; dado fiscal só da nota e validado por contador.

-- 1) Segurança entre lojas: referência composta (produto sempre da mesma loja).
alter table public.produtos add constraint produtos_id_loja unique (id, loja_id);

-- 2) Famílias técnicas: peça + marca + linha (ex.: amortecedor dianteiro, Cofap, linha X).
create table public.familias_tecnicas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  marca_id uuid references public.marcas(id),          -- marca da peça (fabricante)
  linha text,                                           -- ex.: linha Premium; opcional
  nome text not null check (length(btrim(nome)) > 0),
  taxonomia_no_id uuid references public.taxonomia_nos(id),
  atributos jsonb not null default '{}',                -- especificações comuns (posição, suspensão, cilindrada...)
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now()
);
create unique index familias_unica on public.familias_tecnicas
  (loja_id, coalesce(marca_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(coalesce(linha, ''))), lower(btrim(nome)));
alter table public.produtos add column familia_id uuid references public.familias_tecnicas(id);

-- 3) Equivalências entre produtos de marcas diferentes (códigos cambiados). Sempre com fonte e data.
create table public.produto_equivalencias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null,
  equivalente_id uuid not null,
  tipo text not null check (tipo in ('similar', 'substituto', 'original')),
  fonte text,
  coletado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  foreign key (equivalente_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  check (produto_id <> equivalente_id),
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null)),
  unique (produto_id, equivalente_id, tipo)
);

-- 4) Memória: modelos de cadastro reaproveitáveis (por família/ramo) e entradas sem cadastro.
create table public.modelos_cadastro (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  perfil_ramo text not null references public.perfis_ramo(codigo),
  familia_id uuid references public.familias_tecnicas(id),
  nome text not null,
  definicao jsonb not null,                              -- campos pré-preenchidos do cadastro
  produto_origem_id uuid,
  usos int not null default 0,
  criado_em timestamptz not null default now(),
  foreign key (produto_origem_id, loja_id) references public.produtos(id, loja_id) on delete set null (produto_origem_id)
);

create table public.entradas_cadastro (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  origem text not null check (origem in ('descricao', 'nfe', 'manual')),
  chave_idempotencia text not null,                      -- ex.: chave da NF-e + item
  texto_bruto text,
  dados_nfe jsonb,                                       -- NCM, CEST, CFOP, EAN, código do fornecedor, descrição (da nota)
  modelo_id uuid references public.modelos_cadastro(id),
  produto_origem_id uuid,                                -- produto usado como base do clone
  proposta jsonb,
  faltando text[] not null default '{}',
  status text not null default 'recebida'
    check (status in ('recebida', 'proposta', 'aprovada', 'enviada_bling', 'rejeitada', 'falhou')),
  fiscal_validado_em timestamptz,                        -- validação do contador do cliente
  bling_id_criado text,
  aprovado_em timestamptz,
  aprovado_por uuid,
  criado_em timestamptz not null default now(),
  unique (loja_id, chave_idempotencia),
  foreign key (produto_origem_id, loja_id) references public.produtos(id, loja_id) on delete set null (produto_origem_id),
  -- dado fiscal vindo da nota só segue para o Bling depois da validação do contador
  check (status <> 'enviada_bling' or fiscal_validado_em is not null or dados_nfe is null),
  check (status not in ('aprovada', 'enviada_bling') or aprovado_em is not null)
);
create index on public.entradas_cadastro (loja_id, status);

-- 5) Taxonomia: status (proposto/aprovado) e árvore inicial de autopeças PROPOSTA (por sistema do veículo).
-- Marca/modelo/ano do veículo NÃO são categoria: são filtros (aplicação).
alter table public.taxonomia_nos add column status text not null default 'proposto' check (status in ('proposto', 'aprovado'));
drop policy taxonomia_ver on public.taxonomia_nos;
create policy taxonomia_lojista on public.taxonomia_nos for select to authenticated using (true);
create policy taxonomia_publica on public.taxonomia_nos for select to anon using (status = 'aprovado');

do $$
declare
  arvore jsonb := '{
    "motor": ["Motor", ["bielas","Bielas"], ["pistoes-aneis","Pistões e anéis"], ["juntas-retentores","Juntas e retentores"], ["correias-tensores","Correias e tensores"], ["bomba-oleo","Bombas de óleo"], ["cabecote-valvulas","Cabeçote e válvulas"]],
    "alimentacao-injecao": ["Alimentação e injeção", ["bicos-injetores","Bicos injetores"], ["bombas-combustivel","Bombas de combustível"]],
    "arrefecimento": ["Arrefecimento", ["bombas-agua","Bombas d''água"], ["radiadores","Radiadores"], ["valvulas-termostaticas","Válvulas termostáticas"]],
    "eletrica-ignicao": ["Elétrica e ignição", ["velas","Velas"], ["sensores","Sensores"], ["baterias","Baterias"]],
    "freios": ["Freios", ["pastilhas","Pastilhas"], ["discos","Discos"], ["lonas-tambores","Lonas e tambores"], ["cilindros-flexiveis","Cilindros e flexíveis"]],
    "suspensao-direcao": ["Suspensão e direção", ["amortecedores","Amortecedores"], ["molas","Molas"], ["buchas-batentes","Buchas e batentes"], ["pivos-terminais","Pivôs e terminais"], ["barras-estabilizadoras","Barras estabilizadoras"]],
    "embreagem-transmissao": ["Embreagem e transmissão", ["kits-embreagem","Kits de embreagem"], ["rolamentos","Rolamentos"]],
    "escapamento": ["Escapamento", ["silenciosos","Silenciosos"], ["catalisadores","Catalisadores"]],
    "filtros": ["Filtros", ["filtro-oleo","Filtros de óleo"], ["filtro-ar","Filtros de ar"], ["filtro-combustivel","Filtros de combustível"], ["filtro-cabine","Filtros de cabine"]],
    "iluminacao": ["Iluminação", ["farois-lanternas","Faróis e lanternas"], ["lampadas","Lâmpadas"]],
    "carroceria-acabamento": ["Carroceria e acabamento", ["retrovisores","Retrovisores"], ["paralamas-parachoques","Para-lamas e para-choques"]],
    "lubrificantes-fluidos": ["Lubrificantes e fluidos", ["oleos-motor","Óleos de motor"], ["fluidos-freio-arrefecimento","Fluidos de freio e arrefecimento"]]
  }';
  k text; v jsonb; pai uuid; filho jsonb; ord int := 0;
begin
  for k, v in select * from jsonb_each(arvore) loop
    ord := ord + 1;
    insert into public.taxonomia_nos (perfil_ramo, nome, slug, ordem) values ('autopecas', v->>0, k, ord) returning id into pai;
    for filho in select * from jsonb_array_elements(v) offset 1 loop
      insert into public.taxonomia_nos (perfil_ramo, pai_id, nome, slug) values ('autopecas', pai, filho->>1, filho->>0);
    end loop;
  end loop;
end $$;

-- 6) RLS e grants (lojista lê a própria loja; escrita só no servidor).
alter table public.familias_tecnicas enable row level security;
alter table public.produto_equivalencias enable row level security;
alter table public.modelos_cadastro enable row level security;
alter table public.entradas_cadastro enable row level security;
create policy familias_ver on public.familias_tecnicas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy equiv_ver on public.produto_equivalencias for select to authenticated using (private.pode_ver_loja(loja_id));
create policy modelos_ver on public.modelos_cadastro for select to authenticated using (private.pode_ver_loja(loja_id));
create policy entradas_ver on public.entradas_cadastro for select to authenticated using (private.pode_ver_loja(loja_id));
grant select on public.familias_tecnicas, public.produto_equivalencias, public.modelos_cadastro, public.entradas_cadastro to authenticated;
grant select, insert, update, delete on public.familias_tecnicas, public.produto_equivalencias,
  public.modelos_cadastro, public.entradas_cadastro to service_role;

-- 7) Vínculo conta do Bling -> loja (webhook traz companyId).
alter table public.bling_conexoes add column bling_company_id text unique;
create function public.loja_por_bling_company(p_company text) returns uuid
language sql stable security definer set search_path = '' as $$
  select loja_id from public.bling_conexoes where bling_company_id = p_company;
$$;

-- 8) Publicação com portão por perfil de ramo (fecha em caso de campo desconhecido).
create function public.publicar_produto(p_produto uuid, p_publicar boolean, p_user uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.produtos%rowtype;
  exigidos text[];
  campo text;
  faltando text[] := '{}';
  ok boolean;
begin
  select * into p from public.produtos where id = p_produto;
  if not found then raise exception 'produto inexistente'; end if;

  if p_publicar then
    select r.campos_obrigatorios into exigidos
      from public.lojas l join public.perfis_ramo r on r.codigo = l.perfil_ramo where l.id = p.loja_id;
    foreach campo in array coalesce(exigidos, '{}') loop
      ok := case campo
        when 'nome' then coalesce(btrim(p.nome), '') <> ''
        when 'sku' then coalesce(btrim(p.sku), '') <> ''
        when 'preco' then coalesce(p.preco, 0) > 0
        when 'categoria' then exists (select 1 from public.taxonomia_nos n where n.id = p.taxonomia_no_id and n.status = 'aprovado')
        when 'imagem_principal' then exists (select 1 from public.produto_imagens i
            where i.produto_id = p.id and i.principal and i.aprovada and i.removida_em is null)
        when 'marca_peca' then exists (select 1 from public.produto_codigos c join public.marcas m on m.id = c.marca_id
            where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado' and m.tipo = 'peca' and m.status = 'aprovado')
        when 'codigo_fabricante' then exists (select 1 from public.produto_codigos c
            where c.produto_id = p.id and c.tipo = 'fabricante' and c.status = 'aprovado')
        else false
      end;
      if not ok then faltando := faltando || campo; end if;
    end loop;
    if array_length(faltando, 1) is not null then
      return jsonb_build_object('ok', false, 'faltando', to_jsonb(faltando));
    end if;
  end if;

  update public.produtos set publicado = p_publicar where id = p.id;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p.loja_id, p_user, case when p_publicar then 'publicar' else 'despublicar' end, 'produtos',
          jsonb_build_object('id', p.id, 'publicado', p.publicado), jsonb_build_object('id', p.id, 'publicado', p_publicar));
  return jsonb_build_object('ok', true, 'faltando', '[]'::jsonb);
end $$;

-- 9) Clone de cadastro de produto equivalente -> ENTRADA (rascunho). Só muda nome, SKU e marca;
-- a compatibilidade copiada nasce "a_confirmar" e exige cruzamento antes de aprovar.
create function public.clonar_para_entrada(p_loja uuid, p_origem uuid, p_sku text, p_nome text, p_marca_id uuid, p_chave text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  o public.produtos%rowtype;
  fam public.familias_tecnicas%rowtype;
  apl jsonb;
  nova uuid;
begin
  select * into o from public.produtos where id = p_origem and loja_id = p_loja;
  if not found then raise exception 'produto de origem não pertence à loja'; end if;
  if exists (select 1 from public.produtos where loja_id = p_loja and sku = p_sku) then
    raise exception 'SKU já existe na loja';
  end if;
  select id into nova from public.entradas_cadastro where loja_id = p_loja and chave_idempotencia = p_chave;
  if found then return nova; end if;
  if o.familia_id is not null then select * into fam from public.familias_tecnicas where id = o.familia_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'marca_veiculo_id', a.marca_veiculo_id, 'modelo', a.modelo, 'motorizacao', a.motorizacao,
      'ano_inicial', a.ano_inicial, 'ano_final', a.ano_final, 'derivado_de', p_origem, 'status', 'a_confirmar')), '[]')
    into apl from public.produto_aplicacoes a where a.produto_id = p_origem and a.status = 'aprovado';
  insert into public.entradas_cadastro (loja_id, origem, chave_idempotencia, produto_origem_id, status, proposta, faltando)
  values (p_loja, 'manual', p_chave, p_origem, 'proposta',
    jsonb_build_object('clone_de', p_origem, 'sku', p_sku, 'nome', p_nome, 'marca_id', p_marca_id,
      'familia_modelo', o.familia_id, 'atributos', coalesce(fam.atributos, '{}'::jsonb),
      'taxonomia_no_id', o.taxonomia_no_id, 'aplicacoes', apl,
      'textos', jsonb_build_object('descricao_curta', o.descricao_curta, 'descricao_complementar', o.descricao_complementar),
      'avisos', jsonb_build_array('compatibilidade copiada de produto equivalente: confirmar por catálogo/cruzamento antes de aprovar',
                                  'revisar textos: podem citar a marca do produto de origem')),
    array['codigo_fabricante', 'imagem_principal', 'cruzamento_equivalencia'])
  returning id into nova;
  return nova;
end $$;

-- Funções só do servidor.
revoke all on function public.loja_por_bling_company(text) from public, anon, authenticated;
revoke all on function public.publicar_produto(uuid, boolean, uuid) from public, anon, authenticated;
revoke all on function public.clonar_para_entrada(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.loja_por_bling_company(text) to service_role;
grant execute on function public.publicar_produto(uuid, boolean, uuid) to service_role;
grant execute on function public.clonar_para_entrada(uuid, uuid, text, text, uuid, text) to service_role;
