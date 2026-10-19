-- Razão de custos do pipeline e orçamento mensal por loja. O custo é registrado por capacidade e tarefa (API, tokens, USD, duração, fonte).
-- A reserva é ATÔMICA: duas execuções em paralelo não estouram o limite juntas. Funções só para o servidor (service_role).
create table public.pipeline_orcamentos (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  mes date not null check (mes = date_trunc('month', mes)::date),
  limite_usd numeric(12,4) not null check (limite_usd >= 0),
  primary key (loja_id, mes)
);

create table public.pipeline_custos (
  id bigint generated always as identity primary key,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  item_id uuid,
  mes date not null default date_trunc('month', now())::date,
  capacidade text not null check (capacidade in ('identificador', 'pesquisador', 'taxonomista', 'compatibilidade', 'enriquecedor', 'auditor', 'orquestrador')),
  tipo text not null check (tipo in ('deterministica', 'api', 'llm')),
  fonte text,                                          -- conector, provedor ou modelo (nunca mostrado ao cliente final)
  chamadas int not null default 0 check (chamadas >= 0),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  usd numeric(12,6) not null default 0 check (usd >= 0),
  duracao_ms int check (duracao_ms >= 0),
  estado text not null default 'confirmado' check (estado in ('reservado', 'confirmado')),
  criado_em timestamptz not null default now(),
  foreign key (item_id, loja_id) references public.pipeline_itens (id, loja_id) on delete set null (item_id)
);
create index on public.pipeline_custos (loja_id, mes);

-- reserva atômica: devolve o id do custo reservado, ou null se estourar o orçamento do mês (nada é gravado)
create function public.pipeline_custo_tentar(p_loja uuid, p_item uuid, p_capacidade text, p_tipo text, p_fonte text, p_usd_estimado numeric)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_mes date := date_trunc('month', now())::date; v_limite numeric; v_gasto numeric; v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('pipeline_orcamento:' || p_loja::text || v_mes::text, 0));
  select limite_usd into v_limite from public.pipeline_orcamentos where loja_id = p_loja and mes = v_mes;
  if v_limite is null then return null; end if;                        -- sem orçamento definido: nada que custe é autorizado
  select coalesce(sum(usd), 0) into v_gasto from public.pipeline_custos where loja_id = p_loja and mes = v_mes;
  if v_gasto + p_usd_estimado > v_limite then return null; end if;
  insert into public.pipeline_custos (loja_id, item_id, mes, capacidade, tipo, fonte, usd, estado) values (p_loja, p_item, v_mes, p_capacidade, p_tipo, p_fonte, p_usd_estimado, 'reservado')
    returning id into v_id;
  return v_id;
end $$;

create function public.pipeline_custo_confirmar(p_loja uuid, p_custo bigint, p_usd_real numeric, p_chamadas int, p_tokens_in bigint, p_tokens_out bigint, p_duracao_ms int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.pipeline_custos set usd = p_usd_real, chamadas = p_chamadas, tokens_in = p_tokens_in, tokens_out = p_tokens_out, duracao_ms = p_duracao_ms, estado = 'confirmado'
    where id = p_custo and loja_id = p_loja and estado = 'reservado';
  if not found then raise exception 'reserva de custo inexistente nesta loja' using errcode = 'P0002'; end if;
end $$;

-- custo sem reserva (determinístico: normalmente 0 USD, mas registra tempo e capacidade para auditoria)
create function public.pipeline_custo_registrar(p_loja uuid, p_item uuid, p_capacidade text, p_tipo text, p_fonte text, p_duracao_ms int)
returns bigint language sql security definer set search_path = '' as $$
  insert into public.pipeline_custos (loja_id, item_id, capacidade, tipo, fonte, duracao_ms) values (p_loja, p_item, p_capacidade, p_tipo, p_fonte, p_duracao_ms) returning id
$$;

create function public.pipeline_orcamento_estado(p_loja uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('limite_usd', o.limite_usd, 'gasto_usd', coalesce((select sum(usd) from public.pipeline_custos c where c.loja_id = o.loja_id and c.mes = o.mes), 0),
    'restante_usd', o.limite_usd - coalesce((select sum(usd) from public.pipeline_custos c where c.loja_id = o.loja_id and c.mes = o.mes), 0))
  from public.pipeline_orcamentos o where o.loja_id = p_loja and o.mes = date_trunc('month', now())::date
$$;

alter table public.pipeline_orcamentos enable row level security;
alter table public.pipeline_custos enable row level security;
revoke all on public.pipeline_orcamentos, public.pipeline_custos from anon, authenticated;
grant select, insert, update, delete on public.pipeline_orcamentos, public.pipeline_custos to service_role;
grant select on public.pipeline_custos to authenticated;
create policy pipeline_custos_ver on public.pipeline_custos for select to authenticated using (private.pode_ver_loja(loja_id));
revoke all on function public.pipeline_custo_tentar(uuid, uuid, text, text, text, numeric), public.pipeline_custo_confirmar(uuid, bigint, numeric, int, bigint, bigint, int),
  public.pipeline_custo_registrar(uuid, uuid, text, text, text, int), public.pipeline_orcamento_estado(uuid) from public, anon, authenticated;
grant execute on function public.pipeline_custo_tentar(uuid, uuid, text, text, text, numeric), public.pipeline_custo_confirmar(uuid, bigint, numeric, int, bigint, bigint, int),
  public.pipeline_custo_registrar(uuid, uuid, text, text, text, int), public.pipeline_orcamento_estado(uuid) to service_role;
