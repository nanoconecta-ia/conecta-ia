-- Pipeline de indexação por produto: máquina de estados, histórico imutável, conflitos entre fontes e fila com recuo.
-- ENTRADA → NORMALIZADO → IDENTIFICADO → PESQUISADO → COMPARADO → (CONFLITO) → VALIDADO → ENRIQUECIDO → AGUARDANDO_APROVAÇÃO
--   → APROVADO → SINCRONIZANDO → SINCRONIZADO. Aprovar e rejeitar são ações HUMANAS (lojista); o agente nunca aprova.
-- Todas as funções só podem ser executadas pelo servidor (service_role); usuários logados apenas leem os itens da própria loja.
create table public.pipeline_transicoes (
  de text not null,
  para text not null,
  so_humano boolean not null default false,
  primary key (de, para)
);
insert into public.pipeline_transicoes (de, para, so_humano) values
  ('entrada', 'normalizado', false), ('normalizado', 'identificado', false), ('identificado', 'pesquisado', false),
  ('pesquisado', 'comparado', false), ('comparado', 'validado', false), ('comparado', 'conflito', false),
  ('conflito', 'comparado', true), ('conflito', 'rejeitado', true),
  ('validado', 'enriquecido', false), ('enriquecido', 'aguardando_aprovacao', false),
  ('aguardando_aprovacao', 'aprovado', true), ('aguardando_aprovacao', 'rejeitado', true),
  ('aprovado', 'sincronizando', false), ('sincronizando', 'sincronizado', false),
  ('falhou', 'entrada', true);

create table public.pipeline_itens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  sku text,
  estado text not null default 'entrada' check (estado in ('entrada', 'normalizado', 'identificado', 'pesquisado', 'comparado', 'conflito',
    'validado', 'enriquecido', 'aguardando_aprovacao', 'aprovado', 'sincronizando', 'sincronizado', 'rejeitado', 'falhou')),
  versao int not null default 1,
  entrada jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  tentativas int not null default 0 check (tentativas >= 0),
  proxima_tentativa timestamptz not null default now(),
  reservado_ate timestamptz,
  erro text,
  proposta_id uuid,                                  -- ligação lógica com a proposta versionada (sem FK: as tabelas de proposta são reconciliadas à parte)
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (loja_id, idempotency_key),
  unique (id, loja_id)
);
-- no máximo um item ATIVO por SKU e loja: impede cadastro duplicado em andamento
create unique index pipeline_itens_sku_ativo on public.pipeline_itens (loja_id, sku) where sku is not null and estado not in ('sincronizado', 'rejeitado', 'falhou');
create index on public.pipeline_itens (loja_id, estado, proxima_tentativa);

create table public.pipeline_historico (
  id bigint generated always as identity primary key,
  item_id uuid not null,
  loja_id uuid not null,
  de text,
  para text not null,
  ator text not null,
  por_humano boolean not null default false,
  motivo text,
  evidencias jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  foreign key (item_id, loja_id) references public.pipeline_itens (id, loja_id) on delete cascade
);
create index on public.pipeline_historico (item_id, id);

create function private.pipeline_historico_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;   -- permite a limpeza em cascata do item
  raise exception 'histórico do pipeline é imutável' using errcode = '42501';
end $$;
create trigger pipeline_historico_imutavel before update or delete on public.pipeline_historico
  for each row execute function private.pipeline_historico_imutavel();

create table public.pipeline_conflitos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  loja_id uuid not null,
  tipo text not null check (tipo in ('aplicacao', 'oem', 'gtin', 'medidas', 'bling_vs_enriquecimento', 'auditoria')),
  campo text not null,
  lado_a jsonb not null,                              -- {valor, fonte}
  lado_b jsonb not null,
  resolvido boolean not null default false,
  decisao text,
  decidido_por uuid,
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  foreign key (item_id, loja_id) references public.pipeline_itens (id, loja_id) on delete cascade,
  check (not resolvido or (decisao is not null and decidido_por is not null and decidido_em is not null))
);
create index on public.pipeline_conflitos (item_id) where not resolvido;

-- só o lojista decide (aprova, rejeita, resolve conflito)
create function private.pipeline_e_lojista(p_loja uuid, p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios_loja u where u.loja_id = p_loja and u.user_id = p_user and u.papel = 'lojista')
$$;

create function public.pipeline_criar(p_loja uuid, p_sku text, p_produto uuid, p_entrada jsonb, p_idem text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_produto is not null and not exists (select 1 from public.produtos where id = p_produto and loja_id = p_loja) then
    raise exception 'produto não pertence à loja' using errcode = '42501';
  end if;
  select id into v_id from public.pipeline_itens where loja_id = p_loja and idempotency_key = p_idem;
  if v_id is not null then return v_id; end if;
  select id into v_id from public.pipeline_itens where loja_id = p_loja and sku = p_sku and estado not in ('sincronizado', 'rejeitado', 'falhou');
  if v_id is not null then return v_id; end if;                        -- já existe item ativo para este SKU: não duplica
  insert into public.pipeline_itens (loja_id, produto_id, sku, entrada, idempotency_key) values (p_loja, p_produto, nullif(btrim(p_sku), ''), coalesce(p_entrada, '{}'::jsonb), p_idem)
    returning id into v_id;
  insert into public.pipeline_historico (item_id, loja_id, de, para, ator) values (v_id, p_loja, null, 'entrada', 'sistema');
  return v_id;
end $$;

create function public.pipeline_avancar(p_loja uuid, p_item uuid, p_para text, p_versao_esperada int, p_ator text, p_user uuid default null,
  p_motivo text default null, p_evidencias jsonb default '[]'::jsonb, p_resultado jsonb default null, p_proposta uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.pipeline_itens; t public.pipeline_transicoes; v_humano boolean := p_user is not null;
begin
  select * into v from public.pipeline_itens where id = p_item and loja_id = p_loja for update;
  if not found then raise exception 'item inexistente nesta loja' using errcode = 'P0002'; end if;
  if v.versao <> p_versao_esperada then raise exception 'versão desatualizada (esperada %, atual %)', p_versao_esperada, v.versao using errcode = '40001'; end if;
  select * into t from public.pipeline_transicoes where de = v.estado and para = p_para;
  if not found then raise exception 'transição não permitida: % → %', v.estado, p_para using errcode = '22023'; end if;
  if t.so_humano and not (v_humano and private.pipeline_e_lojista(p_loja, p_user)) then
    raise exception 'esta transição exige decisão do lojista' using errcode = '42501';
  end if;
  if p_para = 'conflito' and not exists (select 1 from public.pipeline_conflitos where item_id = p_item and not resolvido) then
    raise exception 'sem conflito aberto' using errcode = '22023';
  end if;
  if p_para = 'validado' and exists (select 1 from public.pipeline_conflitos where item_id = p_item and not resolvido) then
    raise exception 'há conflito não resolvido' using errcode = '22023';
  end if;
  if p_para in ('enriquecido', 'sincronizado') and (jsonb_typeof(p_evidencias) <> 'array' or jsonb_array_length(p_evidencias) = 0) then
    raise exception 'evidências obrigatórias para %', p_para using errcode = '22023';
  end if;
  if p_para = 'sincronizando' and coalesce(p_proposta, v.proposta_id) is null then
    raise exception 'sincronizar exige uma proposta aprovada' using errcode = '22023';
  end if;
  update public.pipeline_itens set estado = p_para, versao = versao + 1, tentativas = 0, reservado_ate = null, erro = null, atualizado_em = now(),
    proxima_tentativa = now(), resultado = case when p_resultado is null then resultado else resultado || p_resultado end,
    proposta_id = coalesce(p_proposta, proposta_id)
    where id = p_item returning * into v;
  insert into public.pipeline_historico (item_id, loja_id, de, para, ator, por_humano, motivo, evidencias)
    values (p_item, p_loja, t.de, p_para, p_ator, v_humano, p_motivo, coalesce(p_evidencias, '[]'::jsonb));
  return jsonb_build_object('estado', v.estado, 'versao', v.versao);
end $$;

create function public.pipeline_registrar_conflito(p_loja uuid, p_item uuid, p_tipo text, p_campo text, p_a jsonb, p_b jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.pipeline_itens where id = p_item and loja_id = p_loja) then raise exception 'item inexistente nesta loja' using errcode = 'P0002'; end if;
  insert into public.pipeline_conflitos (item_id, loja_id, tipo, campo, lado_a, lado_b) values (p_item, p_loja, p_tipo, p_campo, p_a, p_b) returning id into v_id;
  return v_id;
end $$;

create function public.pipeline_resolver_conflito(p_loja uuid, p_conflito uuid, p_user uuid, p_decisao text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pipeline_e_lojista(p_loja, p_user) then raise exception 'só o lojista resolve conflitos' using errcode = '42501'; end if;
  if p_decisao is null or char_length(btrim(p_decisao)) < 3 then raise exception 'decisão obrigatória' using errcode = '22023'; end if;
  update public.pipeline_conflitos set resolvido = true, decisao = p_decisao, decidido_por = p_user, decidido_em = now()
    where id = p_conflito and loja_id = p_loja and not resolvido;
  if not found then raise exception 'conflito inexistente ou já resolvido' using errcode = 'P0002'; end if;
end $$;

-- fila: reserva itens vencidos com limite de simultâneos por loja; falha com recuo exponencial (10s·2^n, teto 1h) e para na 5ª tentativa
create function public.pipeline_reservar(p_loja uuid, p_limite int default 10, p_lease_s int default 120, p_max_simultaneos int default 5)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare v_ativos int; v_vagas int;
begin
  select count(*) into v_ativos from public.pipeline_itens where loja_id = p_loja and reservado_ate > now();
  v_vagas := least(greatest(p_limite, 0), greatest(p_max_simultaneos - v_ativos, 0));
  if v_vagas = 0 then return; end if;
  return query
    with c as (
      select id from public.pipeline_itens
      where loja_id = p_loja and estado not in ('sincronizado', 'rejeitado', 'falhou', 'aguardando_aprovacao', 'conflito')
        and proxima_tentativa <= now() and (reservado_ate is null or reservado_ate <= now())
      order by proxima_tentativa, criado_em limit v_vagas for update skip locked)
    update public.pipeline_itens i set reservado_ate = now() + make_interval(secs => p_lease_s) from c where i.id = c.id returning i.id;
end $$;

create function public.pipeline_falhar(p_loja uuid, p_item uuid, p_erro text, p_max_tentativas int default 5)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.pipeline_itens;
begin
  update public.pipeline_itens set tentativas = tentativas + 1, erro = left(coalesce(p_erro, 'erro'), 500), reservado_ate = null, atualizado_em = now(),
    proxima_tentativa = now() + make_interval(secs => least(10 * power(2, tentativas)::int, 3600))
    where id = p_item and loja_id = p_loja returning * into v;
  if not found then raise exception 'item inexistente nesta loja' using errcode = 'P0002'; end if;
  if v.tentativas >= p_max_tentativas then
    insert into public.pipeline_historico (item_id, loja_id, de, para, ator, motivo) values (p_item, p_loja, v.estado, 'falhou', 'sistema', 'tentativas esgotadas: ' || coalesce(v.erro, ''));
    update public.pipeline_itens set estado = 'falhou', versao = versao + 1 where id = p_item;
    return jsonb_build_object('estado', 'falhou', 'tentativas', v.tentativas);
  end if;
  return jsonb_build_object('estado', v.estado, 'tentativas', v.tentativas, 'proxima_tentativa', v.proxima_tentativa);
end $$;

create function public.pipeline_obter(p_loja uuid, p_item uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(i) || jsonb_build_object('conflitos_abertos', (select count(*) from public.pipeline_conflitos c where c.item_id = i.id and not c.resolvido))
  from public.pipeline_itens i where i.id = p_item and i.loja_id = p_loja
$$;

alter table public.pipeline_transicoes enable row level security;
alter table public.pipeline_itens enable row level security;
alter table public.pipeline_historico enable row level security;
alter table public.pipeline_conflitos enable row level security;
revoke all on public.pipeline_transicoes, public.pipeline_itens, public.pipeline_historico, public.pipeline_conflitos from anon, authenticated;
grant select, insert, update, delete on public.pipeline_transicoes, public.pipeline_itens, public.pipeline_historico, public.pipeline_conflitos to service_role;
grant select on public.pipeline_itens, public.pipeline_historico, public.pipeline_conflitos to authenticated;
create policy pipeline_itens_ver on public.pipeline_itens for select to authenticated using (private.pode_ver_loja(loja_id));
create policy pipeline_historico_ver on public.pipeline_historico for select to authenticated using (private.pode_ver_loja(loja_id));
create policy pipeline_conflitos_ver on public.pipeline_conflitos for select to authenticated using (private.pode_ver_loja(loja_id));
revoke all on function public.pipeline_criar(uuid, text, uuid, jsonb, text), public.pipeline_avancar(uuid, uuid, text, int, text, uuid, text, jsonb, jsonb, uuid),
  public.pipeline_registrar_conflito(uuid, uuid, text, text, jsonb, jsonb), public.pipeline_resolver_conflito(uuid, uuid, uuid, text),
  public.pipeline_reservar(uuid, int, int, int), public.pipeline_falhar(uuid, uuid, text, int), public.pipeline_obter(uuid, uuid), private.pipeline_e_lojista(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pipeline_criar(uuid, text, uuid, jsonb, text), public.pipeline_avancar(uuid, uuid, text, int, text, uuid, text, jsonb, jsonb, uuid),
  public.pipeline_registrar_conflito(uuid, uuid, text, text, jsonb, jsonb), public.pipeline_resolver_conflito(uuid, uuid, uuid, text),
  public.pipeline_reservar(uuid, int, int, int), public.pipeline_falhar(uuid, uuid, text, int), public.pipeline_obter(uuid, uuid) to service_role;
