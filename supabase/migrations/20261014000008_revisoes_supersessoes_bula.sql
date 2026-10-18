-- Migração 14: aplicação com código OEM da montadora de origem, revisões da peça (mesmo código, peças diferentes),
-- supersessões de código entre/dentro de montadoras e bula técnica obrigatória na página de autopeças.
-- Regras: nada de aplicação sem código OEM + fonte; mecânico precisa ver contraindicações e medidas.

-- 1) Aplicação veicular: montadora e código de origem, faixa de série e restrição de uso.
alter table public.produto_aplicacoes
  add column montadora_origem_id uuid references public.marcas(id),   -- onde o veículo nasce
  add column codigo_oem text,                                         -- código original dessa montadora
  add column serie_inicial text,                                      -- chassi/série/motor (faixa de validade)
  add column serie_final text,
  add column restricao text,                                          -- ex.: "somente motor com número de série >= X"
  add column contraindicacao text;                                    -- ex.: "não usar em ..."
alter table public.produto_aplicacoes
  add constraint aplicacao_aprovada_com_oem check (
    status <> 'aprovado' or (codigo_oem is not null and btrim(codigo_oem) <> '' and montadora_origem_id is not null));

-- 2) Revisões da peça: o mesmo código pode designar formatos/medidas diferentes ao longo do tempo.
create table public.produto_revisoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null,
  codigo text not null check (length(btrim(codigo)) > 0),
  o_que_mudou text not null check (length(btrim(o_que_mudou)) > 0),
  medidas jsonb not null default '{}',
  ano_inicial int check (ano_inicial between 1950 and 2100),
  ano_final int check (ano_final between 1950 and 2100),
  serie_inicial text,
  serie_final text,
  fonte text,
  coletado_em timestamptz,
  confianca numeric(3,2) check (confianca between 0 and 1),
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  check (ano_final is null or ano_inicial is null or ano_final >= ano_inicial),
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null))
);
create index on public.produto_revisoes (loja_id, produto_id);

-- 3) Supersessões: código antigo -> novo (montadora que absorve outra ou renumera peças).
create table public.codigo_supersessoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  montadora_id uuid references public.marcas(id),
  codigo_antigo text not null check (length(btrim(codigo_antigo)) > 0),
  codigo_novo text not null check (length(btrim(codigo_novo)) > 0),
  mudou_formato boolean,                               -- null = desconhecido (não presumir)
  data_efeito date,
  fonte text,
  coletado_em timestamptz,
  status public.status_enriquecimento not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  check (codigo_antigo <> codigo_novo),
  check (status <> 'aprovado' or (fonte is not null and coletado_em is not null)),
  unique (loja_id, montadora_id, codigo_antigo, codigo_novo)
);

-- 4) Bula técnica do produto (obrigatória para publicar peça de autopeças).
create table public.produto_bula (
  produto_id uuid primary key,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  medidas_peca jsonb not null default '{}',
  contraindicacoes text[] not null default '{}',
  alertas_codigo text[] not null default '{}',          -- mesmo código, peças diferentes
  texto_md text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovada')),
  aprovada_em timestamptz,
  aprovada_por text,
  atualizado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  check (status <> 'aprovada' or (aprovada_em is not null and medidas_peca <> '{}'::jsonb))
);

alter table public.produto_revisoes enable row level security;
alter table public.codigo_supersessoes enable row level security;
alter table public.produto_bula enable row level security;
create policy revisoes_ver on public.produto_revisoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy supersessoes_ver on public.codigo_supersessoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy bula_ver on public.produto_bula for select to authenticated using (private.pode_ver_loja(loja_id));
create policy revisoes_publicas on public.produto_revisoes for select to anon
  using (status = 'aprovado' and private.loja_ativa(loja_id)
         and exists (select 1 from public.produtos p where p.id = produto_id and p.publicado));
create policy supersessoes_publicas on public.codigo_supersessoes for select to anon
  using (status = 'aprovado' and private.loja_ativa(loja_id));
create policy bula_publica on public.produto_bula for select to anon
  using (status = 'aprovada' and private.loja_ativa(loja_id)
         and exists (select 1 from public.produtos p where p.id = produto_id and p.publicado));
grant select on public.produto_revisoes, public.codigo_supersessoes, public.produto_bula to authenticated;
grant select on public.produto_revisoes, public.codigo_supersessoes to anon;
grant select (produto_id, loja_id, medidas_peca, contraindicacoes, alertas_codigo, texto_md, status, atualizado_em)
  on public.produto_bula to anon;
grant select, insert, update, delete on public.produto_revisoes, public.codigo_supersessoes, public.produto_bula to service_role;

-- 5) Portão de publicação passa a exigir a bula técnica aprovada nas autopeças.
update public.perfis_ramo set campos_obrigatorios = array_append(campos_obrigatorios, 'bula_tecnica')
  where codigo = 'autopecas' and not ('bula_tecnica' = any (campos_obrigatorios));

create or replace function public.publicar_produto(p_produto uuid, p_publicar boolean, p_user uuid default null)
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
        when 'bula_tecnica' then exists (select 1 from public.produto_bula b where b.produto_id = p.id and b.status = 'aprovada')
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
