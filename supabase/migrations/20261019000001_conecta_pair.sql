-- Conecta Pair: pareamento (QR/link), sessões de dispositivo e Central de Aprovações.
-- PROPOSTA — NÃO APLICADA. Só aplicar em conecta-ia (ref dsfzhsrudriqkumtlqwj) com autorização explícita.
-- Desenho e decisões: docs/conecta-pair/ARQUITETURA.md. Testes: supabase/tests/conecta_pair.sql.
--
-- Princípios:
--  * O QR carrega SÓ um código aleatório de uso único (guardado como hash). Nunca senha, token ou credencial.
--  * O solicitante gera e guarda o token de acesso; o servidor só recebe o hash. Nada privilegiado trafega no QR nem no retorno.
--  * Quem aprova é o lojista autenticado (RPCs de aprovação rodam com o JWT do usuário: auth.uid()/auth.jwt()).
--  * Consumo do desafio e das aprovações é atômico (UPDATE condicional / FOR UPDATE); nada depende de "ler e depois gravar" no cliente.
--  * Sessão do Pair NÃO é JWT do Supabase: é conferida no banco a cada chamada, então a revogação vale na próxima chamada.
--  * Nenhum escopo permite aprovar, executar ou administrar; o agente só LÊ e PROPÕE.

-- ---------------------------------------------------------------------------------------------------------------
-- 0) Apoio
create function private.pair_sha256(p_texto text) returns text
language sql immutable strict set search_path = '' as $$ select encode(sha256(convert_to(p_texto, 'UTF8')), 'hex') $$;

create function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler'];
$$;

-- Autenticação recente do USUÁRIO (claim amr do Supabase Auth). Usada para operações sensíveis. Só faz sentido com JWT de usuário.
create function private.autenticacao_recente(p_segundos int) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(max((e ->> 'timestamp')::bigint), 0) >= extract(epoch from now())::bigint - p_segundos
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e;
$$;

create function private.pair_auditar(p_loja uuid, p_user uuid, p_acao text, p_tabela text, p_dados jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (p_loja, p_user, p_acao, p_tabela, p_dados);
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Dispositivos e sessões
create table public.pair_dispositivos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  usuario_id uuid not null,                              -- lojista que aprovou
  nome text not null check (length(btrim(nome)) between 1 and 80),
  tipo text not null check (tipo in ('navegador', 'computador', 'smartphone', 'agente_externo', 'agente_desktop')),
  capacidades text[] not null default '{}' check (cardinality(capacidades) <= 20), -- allowlist do agente desktop; vazio = nenhuma
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid
);
create index on public.pair_dispositivos (loja_id, revogado_em);

create table public.pair_sessoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  usuario_id uuid not null,
  dispositivo_id uuid not null references public.pair_dispositivos(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_anterior_hash text unique check (token_anterior_hash ~ '^[0-9a-f]{64}$'),
  rotacionado_em timestamptz,
  escopos text[] not null check (cardinality(escopos) between 1 and 12 and array_to_string(escopos, ',') !~ '(aprovar|executar|admin)'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,                        -- token de acesso curto (15 min), renovável até limite_ate
  limite_ate timestamptz not null,                       -- teto absoluto = duração aprovada pelo lojista
  ultimo_uso_em timestamptz,
  revogado_em timestamptz,
  revogado_por uuid,
  motivo_revogacao text
);
create index on public.pair_sessoes (loja_id, revogado_em);
create index on public.pair_sessoes (dispositivo_id);

-- Desafio de pareamento: uso único, curto. Nada aqui é segredo em claro: só hashes de valores aleatórios.
create table public.pair_desafios (
  id uuid primary key default gen_random_uuid(),
  codigo_hash text not null unique check (codigo_hash ~ '^[0-9a-f]{64}$'),       -- vai no QR (o código em si, nunca o hash)
  segredo_hash text not null check (segredo_hash ~ '^[0-9a-f]{64}$'),           -- só o solicitante conhece (consulta/resgate)
  verificacao_hash text not null check (verificacao_hash ~ '^[0-9a-f]{64}$'),   -- código curto exibido NA TELA do solicitante
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),        -- token de acesso que o solicitante gerou
  nome_dispositivo text not null check (length(btrim(nome_dispositivo)) between 1 and 80),
  tipo text not null check (tipo in ('navegador', 'computador', 'smartphone', 'agente_externo', 'agente_desktop')),
  escopos_solicitados text[] not null check (cardinality(escopos_solicitados) between 1 and 12 and array_to_string(escopos_solicitados, ',') !~ '(aprovar|executar|admin)'),
  capacidades_solicitadas text[] not null default '{}' check (cardinality(capacidades_solicitadas) <= 20),
  duracao_solicitada_min int not null check (duracao_solicitada_min between 5 and 480),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovado', 'resgatado', 'recusado', 'expirado', 'cancelado')),
  tentativas smallint not null default 0,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  loja_id uuid references public.lojas(id) on delete cascade,
  aprovado_por uuid,
  aprovado_em timestamptz,
  escopos_aprovados text[],
  capacidades_aprovadas text[],
  duracao_aprovada_min int,
  dispositivo_id uuid references public.pair_dispositivos(id) on delete set null,
  resgatado_em timestamptz
);
create index on public.pair_desafios (expira_em);

-- ---------------------------------------------------------------------------------------------------------------
-- 2) Central de Aprovações (vinculada à VERSÃO exata da proposta)
create table public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  grupo_id uuid not null,                                -- todas as versões da mesma proposta
  versao int not null check (versao >= 1),
  tipo text not null check (tipo in ('produto_atualizacao', 'categoria_criacao', 'banner_publicacao', 'pagina_alteracao',
                                     'catalogo_publicacao', 'operacao_lote', 'campanha_alteracao', 'orcamento_alteracao')),
  ferramenta text not null check (length(btrim(ferramenta)) between 3 and 80),
  agente text not null check (length(btrim(agente)) between 1 and 80),
  solicitante_usuario uuid,
  solicitante_sessao uuid references public.pair_sessoes(id) on delete set null,
  solicitante_dispositivo uuid references public.pair_dispositivos(id) on delete set null,
  alvos jsonb not null check (jsonb_typeof(alvos) = 'array' and jsonb_array_length(alvos) <= 500),
  antes jsonb,
  depois jsonb,
  riscos text[] not null default '{}' check (cardinality(riscos) <= 20),
  risco text not null check (risco in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  hash_conteudo text not null,                           -- sem grupo/versão: detecta pedido duplicado
  hash_proposta text not null,                           -- com grupo/versão: é o que o aprovador "viu"
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'recusada', 'expirada', 'substituida',
                                                            'executando', 'executada', 'falhou', 'cancelada')),
  expira_em timestamptz not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 120),
  decidido_por uuid,
  decidido_em timestamptz,
  hash_visto text,
  motivo_decisao text check (length(motivo_decisao) <= 500),
  executado_em timestamptz,
  resultado jsonb,
  criado_em timestamptz not null default now(),
  unique (loja_id, idempotency_key),
  unique (grupo_id, versao)
);
create index on public.aprovacoes (loja_id, estado, expira_em);

-- Risco mínimo por tipo: o agente não consegue rebaixar o risco de uma publicação.
create function private.aprovacao_risco_minimo(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'catalogo_publicacao' then 'HIGH' when 'operacao_lote' then 'HIGH'
    when 'campanha_alteracao' then 'HIGH' when 'orcamento_alteracao' then 'HIGH'
    else 'MEDIUM' end;
$$;
create function private.risco_ordem(p text) returns int
language sql immutable set search_path = '' as $$ select case p when 'LOW' then 1 when 'MEDIUM' then 2 when 'HIGH' then 3 when 'CRITICAL' then 4 end $$;

create function private.aprovacao_hash_conteudo_de(p_loja uuid, p_tipo text, p_ferramenta text, p_agente text, p_alvos jsonb,
  p_antes jsonb, p_depois jsonb, p_riscos text[], p_risco text) returns text
language sql immutable set search_path = '' as $$
  select private.pair_sha256(jsonb_build_object(
    'loja', p_loja, 'tipo', p_tipo, 'ferramenta', p_ferramenta, 'agente', p_agente, 'alvos', p_alvos,
    'antes', coalesce(p_antes, 'null'::jsonb), 'depois', coalesce(p_depois, 'null'::jsonb),
    'riscos', to_jsonb(p_riscos), 'risco', p_risco)::text);
$$;
create function private.aprovacao_hash_conteudo(a public.aprovacoes) returns text
language sql immutable set search_path = '' as $$
  select private.aprovacao_hash_conteudo_de(a.loja_id, a.tipo, a.ferramenta, a.agente, a.alvos, a.antes, a.depois, a.riscos, a.risco);
$$;
create function private.aprovacao_hash_proposta(a public.aprovacoes) returns text
language sql immutable set search_path = '' as $$
  select private.pair_sha256(jsonb_build_object('grupo', a.grupo_id, 'versao', a.versao, 'conteudo', a.hash_conteudo)::text);
$$;

-- O hash é SEMPRE calculado no banco (ignora o que o cliente mandar) e o conteúdo é imutável depois de criado.
create function private.aprovacao_guarda() returns trigger language plpgsql set search_path = '' as $$
declare ok boolean;
begin
  if tg_op = 'INSERT' then
    if private.risco_ordem(new.risco) < private.risco_ordem(private.aprovacao_risco_minimo(new.tipo)) then
      new.risco := private.aprovacao_risco_minimo(new.tipo);
    end if;
    new.hash_conteudo := private.aprovacao_hash_conteudo(new);
    new.hash_proposta := private.aprovacao_hash_proposta(new);
    new.estado := 'pendente';
    return new;
  end if;
  if (new.loja_id, new.grupo_id, new.versao, new.tipo, new.ferramenta, new.agente, new.alvos, new.antes, new.depois, new.riscos,
      new.risco, new.hash_conteudo, new.hash_proposta, new.idempotency_key, new.expira_em, new.solicitante_usuario, new.criado_em)
     is distinct from
     (old.loja_id, old.grupo_id, old.versao, old.tipo, old.ferramenta, old.agente, old.alvos, old.antes, old.depois, old.riscos,
      old.risco, old.hash_conteudo, old.hash_proposta, old.idempotency_key, old.expira_em, old.solicitante_usuario, old.criado_em) then
    raise exception 'conteúdo da proposta é imutável: crie uma nova versão' using errcode = '42501';
  end if;
  if private.aprovacao_hash_conteudo(new) is distinct from new.hash_conteudo then
    raise exception 'proposta adulterada (hash não confere)' using errcode = '42501';
  end if;
  if new.estado is distinct from old.estado then
    ok := case old.estado
      when 'pendente'   then new.estado in ('aprovada', 'recusada', 'expirada', 'substituida', 'cancelada')
      when 'aprovada'   then new.estado in ('executando', 'expirada', 'substituida', 'cancelada')
      when 'executando' then new.estado in ('executada', 'falhou')
      else false end;
    if not ok then raise exception 'transição inválida: % -> %', old.estado, new.estado using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger aprovacao_guarda_ins before insert on public.aprovacoes for each row execute function private.aprovacao_guarda();
create trigger aprovacao_guarda_upd before update on public.aprovacoes for each row execute function private.aprovacao_guarda();

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Pareamento — lado do solicitante (sem login): chamado só pela Edge Function `pair` (service_role)
create function public.pair_iniciar(p_codigo_hash text, p_segredo_hash text, p_verificacao_hash text, p_token_hash text,
  p_nome text, p_tipo text, p_escopos text[], p_capacidades text[], p_duracao_min int, p_ttl_s int default 120)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_exp timestamptz; v_ttl int := least(greatest(coalesce(p_ttl_s, 120), 30), 120); c text;
begin
  if p_escopos is null or cardinality(p_escopos) = 0 or not (p_escopos <@ private.pair_escopos_validos()) then
    raise exception 'escopo inválido' using errcode = '22023';
  end if;
  if p_tipo <> 'agente_desktop' and cardinality(coalesce(p_capacidades, '{}')) > 0 then
    raise exception 'capacidades só existem para agente_desktop' using errcode = '22023';
  end if;
  foreach c in array coalesce(p_capacidades, '{}') loop
    if c !~ '^[a-z0-9_.:-]{3,60}$' then raise exception 'capacidade inválida' using errcode = '22023'; end if;
  end loop;
  v_exp := now() + make_interval(secs => v_ttl);
  delete from public.pair_desafios where expira_em < now() - interval '1 day' and estado <> 'resgatado'; -- limpeza oportunista
  insert into public.pair_desafios (codigo_hash, segredo_hash, verificacao_hash, token_hash, nome_dispositivo, tipo,
      escopos_solicitados, capacidades_solicitadas, duracao_solicitada_min, expira_em)
  values (p_codigo_hash, p_segredo_hash, p_verificacao_hash, p_token_hash, btrim(p_nome), p_tipo,
      p_escopos, coalesce(p_capacidades, '{}'), p_duracao_min, v_exp)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'expira_em', v_exp);
end $$;

-- Consulta/resgate (polling do solicitante). Resgata UMA vez; repetir devolve o mesmo resultado (perda de conexão), nunca um novo token.
create function public.pair_consultar(p_codigo_hash text, p_segredo_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.pair_desafios; v_disp uuid; v_sessao public.pair_sessoes;
begin
  select * into d from public.pair_desafios where codigo_hash = p_codigo_hash and segredo_hash = p_segredo_hash for update;
  if not found then return jsonb_build_object('estado', 'invalido'); end if;

  if d.estado = 'resgatado' then
    select * into v_sessao from public.pair_sessoes where dispositivo_id = d.dispositivo_id order by criado_em limit 1;
    return jsonb_build_object('estado', 'resgatado', 'loja_id', d.loja_id, 'escopos', d.escopos_aprovados,
      'dispositivo_id', d.dispositivo_id, 'limite_ate', v_sessao.limite_ate, 'revogada', v_sessao.revogado_em is not null);
  end if;
  if d.estado in ('recusado', 'cancelado', 'expirado') then return jsonb_build_object('estado', d.estado); end if;
  if d.expira_em <= now() then
    update public.pair_desafios set estado = 'expirado' where id = d.id;
    return jsonb_build_object('estado', 'expirado');
  end if;
  if d.estado = 'pendente' then return jsonb_build_object('estado', 'pendente', 'expira_em', d.expira_em); end if;

  -- estado = 'aprovado': consumo atômico (a linha está travada por FOR UPDATE; o UPDATE condicional é a garantia final)
  update public.pair_desafios set estado = 'resgatado', resgatado_em = now()
   where id = d.id and estado = 'aprovado' and expira_em > now();
  if not found then return jsonb_build_object('estado', 'expirado'); end if;
  insert into public.pair_dispositivos (loja_id, usuario_id, nome, tipo, capacidades)
  values (d.loja_id, d.aprovado_por, d.nome_dispositivo, d.tipo, coalesce(d.capacidades_aprovadas, '{}'))
  returning id into v_disp;
  insert into public.pair_sessoes (loja_id, usuario_id, dispositivo_id, token_hash, escopos, expira_em, limite_ate)
  values (d.loja_id, d.aprovado_por, v_disp, d.token_hash, d.escopos_aprovados,
          least(now() + interval '15 minutes', now() + make_interval(mins => d.duracao_aprovada_min)),
          now() + make_interval(mins => d.duracao_aprovada_min))
  returning * into v_sessao;
  update public.pair_desafios set dispositivo_id = v_disp where id = d.id;
  perform private.pair_auditar(d.loja_id, d.aprovado_por, 'pair.sessao_criada', 'pair_sessoes',
    jsonb_build_object('sessao_id', v_sessao.id, 'dispositivo_id', v_disp, 'tipo', d.tipo, 'escopos', d.escopos_aprovados, 'limite_ate', v_sessao.limite_ate));
  return jsonb_build_object('estado', 'resgatado', 'loja_id', d.loja_id, 'escopos', d.escopos_aprovados, 'dispositivo_id', v_disp,
    'sessao_expira_em', v_sessao.expira_em, 'limite_ate', v_sessao.limite_ate);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) Pareamento — lado do aprovador (lojista autenticado; roda com o JWT do usuário)
create function public.pair_detalhe(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.pair_desafios; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select * into d from public.pair_desafios where codigo_hash = private.pair_sha256(p_codigo);
  if not found or d.estado <> 'pendente' or d.expira_em <= now() then return null; end if;
  return jsonb_build_object(
    'nome', d.nome_dispositivo, 'tipo', d.tipo, 'escopos', d.escopos_solicitados, 'capacidades', d.capacidades_solicitadas,
    'duracao_min', d.duracao_solicitada_min, 'expira_em', d.expira_em,
    'lojas', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) order by l.nome)
                         from public.lojas l where private.administra_loja(l.id, uid)), '[]'::jsonb));
end $$;

create function public.pair_aprovar(p_codigo text, p_loja uuid, p_verificacao text, p_escopos text[], p_duracao_min int, p_capacidades text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.pair_desafios; uid uuid := auth.uid(); v_cap text[] := coalesce(p_capacidades, '{}');
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if not private.administra_loja(p_loja, uid) then raise exception 'sem permissão nesta loja' using errcode = '42501'; end if;
  select * into d from public.pair_desafios where codigo_hash = private.pair_sha256(p_codigo) for update; -- serializa aprovadores concorrentes
  if not found then return jsonb_build_object('ok', false, 'motivo', 'desafio_invalido'); end if;
  if d.estado <> 'pendente' then return jsonb_build_object('ok', false, 'motivo', 'desafio_ja_usado'); end if;
  if d.expira_em <= now() then
    update public.pair_desafios set estado = 'expirado' where id = d.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  if private.pair_sha256(coalesce(p_verificacao, '')) <> d.verificacao_hash then
    update public.pair_desafios set tentativas = tentativas + 1, estado = case when tentativas + 1 >= 5 then 'recusado' else estado end where id = d.id;
    perform private.pair_auditar(p_loja, uid, 'pair.verificacao_incorreta', 'pair_desafios', jsonb_build_object('desafio_id', d.id));
    return jsonb_build_object('ok', false, 'motivo', 'verificacao_incorreta', 'restantes', greatest(4 - d.tentativas, 0));
  end if;
  if p_escopos is null or cardinality(p_escopos) = 0 or not (p_escopos <@ d.escopos_solicitados) or not (p_escopos <@ private.pair_escopos_validos()) then
    return jsonb_build_object('ok', false, 'motivo', 'escopo_alem_do_solicitado');
  end if;
  if p_duracao_min is null or p_duracao_min < 5 or p_duracao_min > d.duracao_solicitada_min then
    return jsonb_build_object('ok', false, 'motivo', 'duracao_invalida');
  end if;
  if not (v_cap <@ d.capacidades_solicitadas) then return jsonb_build_object('ok', false, 'motivo', 'capacidade_alem_da_solicitada'); end if;
  if d.tipo = 'agente_desktop' and not private.autenticacao_recente(300) then
    return jsonb_build_object('ok', false, 'motivo', 'reconfirmacao_necessaria'); -- agente desktop exige login recente
  end if;
  update public.pair_desafios set estado = 'aprovado', loja_id = p_loja, aprovado_por = uid, aprovado_em = now(),
         escopos_aprovados = p_escopos, capacidades_aprovadas = v_cap, duracao_aprovada_min = p_duracao_min
   where id = d.id and estado = 'pendente';
  perform private.pair_auditar(p_loja, uid, 'pair.aprovado', 'pair_desafios',
    jsonb_build_object('desafio_id', d.id, 'dispositivo', d.nome_dispositivo, 'tipo', d.tipo, 'escopos', p_escopos, 'duracao_min', p_duracao_min));
  return jsonb_build_object('ok', true);
end $$;

create function public.pair_recusar(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.pair_desafios; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if not exists (select 1 from public.usuarios_loja where user_id = uid and papel = 'lojista') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  update public.pair_desafios set estado = 'recusado' where codigo_hash = private.pair_sha256(p_codigo) and estado = 'pendente' returning * into d;
  if not found then return jsonb_build_object('ok', false); end if;
  perform private.pair_auditar(null, uid, 'pair.recusado', 'pair_desafios', jsonb_build_object('desafio_id', d.id, 'dispositivo', d.nome_dispositivo));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5) Sessões: validar a cada chamada, renovar (rotação) e revogar
create function public.pair_validar(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; d public.pair_dispositivos; v_ativa boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into s from public.pair_sessoes where token_hash = p_token_hash or token_anterior_hash = p_token_hash;
  if not found then return null; end if;
  if s.token_hash <> p_token_hash then
    -- token anterior: tolerado só por 60 s após a rotação (resposta perdida). Depois disso é replay => revoga a sessão inteira.
    if s.rotacionado_em is null or now() - s.rotacionado_em > interval '60 seconds' then
      update public.pair_sessoes set revogado_em = now(), motivo_revogacao = 'replay_token_anterior' where id = s.id and revogado_em is null;
      perform private.pair_auditar(s.loja_id, s.usuario_id, 'pair.replay_detectado', 'pair_sessoes', jsonb_build_object('sessao_id', s.id, 'dispositivo_id', s.dispositivo_id));
      return null;
    end if;
  end if;
  select * into d from public.pair_dispositivos where id = s.dispositivo_id;
  select ativa into v_ativa from public.lojas where id = s.loja_id;
  if s.revogado_em is not null or d.revogado_em is not null or s.expira_em <= now() or s.limite_ate <= now()
     or coalesce(v_ativa, false) = false or not private.administra_loja(s.loja_id, s.usuario_id) then
    return null; -- inclui: o usuário que aprovou perdeu o papel de lojista
  end if;
  update public.pair_sessoes set ultimo_uso_em = now() where id = s.id and (ultimo_uso_em is null or ultimo_uso_em < now() - interval '30 seconds');
  update public.pair_dispositivos set ultimo_uso_em = now() where id = d.id and (ultimo_uso_em is null or ultimo_uso_em < now() - interval '30 seconds');
  return jsonb_build_object('sessao_id', s.id, 'loja_id', s.loja_id, 'usuario_id', s.usuario_id, 'dispositivo_id', d.id,
    'tipo', d.tipo, 'escopos', s.escopos, 'capacidades', d.capacidades, 'expira_em', s.expira_em, 'atual', s.token_hash = p_token_hash);
end $$;

-- O solicitante gera o token novo e manda só o hash. Só o token ATUAL e ainda válido renova.
create function public.pair_renovar(p_token_hash text, p_novo_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; s public.pair_sessoes;
begin
  if p_novo_hash is null or p_novo_hash !~ '^[0-9a-f]{64}$' or p_novo_hash = p_token_hash then
    return jsonb_build_object('ok', false, 'motivo', 'token_novo_invalido');
  end if;
  v := public.pair_validar(p_token_hash);
  if v is null or (v ->> 'atual')::boolean is not true then return jsonb_build_object('ok', false, 'motivo', 'token_invalido'); end if;
  update public.pair_sessoes set token_anterior_hash = token_hash, token_hash = p_novo_hash, rotacionado_em = now(),
         expira_em = least(now() + interval '15 minutes', limite_ate)
   where id = (v ->> 'sessao_id')::uuid and token_hash = p_token_hash and revogado_em is null returning * into s;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'token_invalido'); end if;
  return jsonb_build_object('ok', true, 'expira_em', s.expira_em, 'limite_ate', s.limite_ate);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'motivo', 'token_novo_invalido');
end $$;

create function private.pair_pode_revogar(p_loja uuid, p_dono uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select p_uid is not null and (p_uid = p_dono or private.administra_loja(p_loja, p_uid)) $$;

create function public.pair_revogar_dispositivo(p_dispositivo uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.pair_dispositivos; uid uuid := auth.uid(); n int;
begin
  select * into d from public.pair_dispositivos where id = p_dispositivo;
  if not found or not private.pair_pode_revogar(d.loja_id, d.usuario_id, uid) then raise exception 'dispositivo não encontrado' using errcode = '42501'; end if;
  update public.pair_dispositivos set revogado_em = coalesce(revogado_em, now()), revogado_por = coalesce(revogado_por, uid) where id = d.id;
  update public.pair_sessoes set revogado_em = now(), revogado_por = uid, motivo_revogacao = coalesce(left(p_motivo, 200), 'revogado_pelo_lojista')
   where dispositivo_id = d.id and revogado_em is null;
  get diagnostics n = row_count;
  perform private.pair_auditar(d.loja_id, uid, 'pair.dispositivo_revogado', 'pair_dispositivos', jsonb_build_object('dispositivo_id', d.id, 'sessoes_encerradas', n));
  return jsonb_build_object('ok', true, 'sessoes_encerradas', n);
end $$;

create function public.pair_revogar_sessao(p_sessao uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; uid uuid := auth.uid();
begin
  select * into s from public.pair_sessoes where id = p_sessao;
  if not found or not private.pair_pode_revogar(s.loja_id, s.usuario_id, uid) then raise exception 'sessão não encontrada' using errcode = '42501'; end if;
  update public.pair_sessoes set revogado_em = coalesce(revogado_em, now()), revogado_por = coalesce(revogado_por, uid),
         motivo_revogacao = coalesce(motivo_revogacao, left(p_motivo, 200), 'revogado_pelo_lojista') where id = s.id;
  perform private.pair_auditar(s.loja_id, uid, 'pair.sessao_revogada', 'pair_sessoes', jsonb_build_object('sessao_id', s.id, 'dispositivo_id', s.dispositivo_id));
  return jsonb_build_object('ok', true);
end $$;

-- Botão de interrupção da loja: encerra TODAS as sessões de dispositivo.
create function public.pair_revogar_todos(p_loja uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or not private.administra_loja(p_loja, uid) then raise exception 'sem permissão nesta loja' using errcode = '42501'; end if;
  update public.pair_dispositivos set revogado_em = coalesce(revogado_em, now()), revogado_por = coalesce(revogado_por, uid) where loja_id = p_loja;
  update public.pair_sessoes set revogado_em = now(), revogado_por = uid, motivo_revogacao = 'interrupcao_total' where loja_id = p_loja and revogado_em is null;
  get diagnostics n = row_count;
  perform private.pair_auditar(p_loja, uid, 'pair.interrupcao_total', 'pair_sessoes', jsonb_build_object('sessoes_encerradas', n));
  return jsonb_build_object('ok', true, 'sessoes_encerradas', n);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6) Aprovações: propor (servidor, a pedido do agente), decidir (lojista) e consumir (executor)
create function public.aprovacao_propor(p_loja uuid, p_tipo text, p_ferramenta text, p_agente text, p_sessao uuid, p_dispositivo uuid,
  p_usuario uuid, p_alvos jsonb, p_antes jsonb, p_depois jsonb, p_riscos text[], p_risco text, p_idempotency_key text,
  p_ttl_min int default 60, p_grupo uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.aprovacoes; novo public.aprovacoes; ult public.aprovacoes; item jsonb; v_grupo uuid; v_versao int := 1;
begin
  if jsonb_typeof(p_alvos) <> 'array' then raise exception 'alvos deve ser uma lista' using errcode = '22023'; end if;
  for item in select * from jsonb_array_elements(p_alvos) loop
    if jsonb_typeof(item) <> 'object' or (item ->> 'tabela') not in ('produtos', 'categorias', 'banners', 'paginas', 'catalogo', 'campanhas', 'orcamentos') then
      raise exception 'alvo inválido' using errcode = '22023';
    end if;
    if item ->> 'tabela' = 'produtos' and not private.produto_da_loja(p_loja, (item ->> 'id')::uuid) then
      raise exception 'produto não pertence à loja' using errcode = '42501';
    end if;
  end loop;

  if p_grupo is not null then
    perform pg_advisory_xact_lock(hashtextextended('aprovacao:' || p_grupo::text, 0)); -- versões simultâneas da mesma proposta entram em fila
    select * into ult from public.aprovacoes where grupo_id = p_grupo and loja_id = p_loja order by versao desc limit 1 for update;
    if not found then raise exception 'proposta original não encontrada' using errcode = '42501'; end if;
    v_grupo := p_grupo; v_versao := ult.versao + 1;
  else
    v_grupo := gen_random_uuid();
  end if;

  insert into public.aprovacoes (loja_id, grupo_id, versao, tipo, ferramenta, agente, solicitante_usuario, solicitante_sessao, solicitante_dispositivo,
      alvos, antes, depois, riscos, risco, hash_conteudo, hash_proposta, expira_em, idempotency_key)
  values (p_loja, v_grupo, v_versao, p_tipo, p_ferramenta, p_agente, p_usuario, p_sessao, p_dispositivo,
      p_alvos, p_antes, p_depois, coalesce(p_riscos, '{}'), p_risco, '', '', now() + make_interval(mins => least(greatest(coalesce(p_ttl_min, 60), 5), 1440)), p_idempotency_key)
  on conflict (loja_id, idempotency_key) do nothing
  returning * into novo;

  if not found then -- pedido duplicado: mesma chave
    select * into a from public.aprovacoes where loja_id = p_loja and idempotency_key = p_idempotency_key;
    -- compara o conteúdo que seria criado agora (com o risco já elevado ao mínimo do tipo) com o já registrado
    if private.aprovacao_hash_conteudo_de(p_loja, p_tipo, p_ferramenta, p_agente, p_alvos, p_antes, p_depois, coalesce(p_riscos, '{}'),
         case when private.risco_ordem(p_risco) < private.risco_ordem(private.aprovacao_risco_minimo(p_tipo)) then private.aprovacao_risco_minimo(p_tipo) else p_risco end)
       is distinct from a.hash_conteudo then
      raise exception 'idempotency_key reutilizada com conteúdo diferente' using errcode = '23505';
    end if;
    return jsonb_build_object('id', a.id, 'grupo_id', a.grupo_id, 'versao', a.versao, 'hash_proposta', a.hash_proposta, 'estado', a.estado,
                              'expira_em', a.expira_em, 'duplicado', true);
  end if;

  -- Nova versão invalida as anteriores ainda não executadas: alteração posterior exige nova aprovação.
  if p_grupo is not null then
    update public.aprovacoes set estado = 'substituida' where grupo_id = v_grupo and versao < v_versao and estado in ('pendente', 'aprovada');
  end if;
  insert into public.notificacoes (loja_id, chave, tipo, severidade, titulo, corpo)
  values (p_loja, 'aprovacao:' || novo.id, 'aprovacao', case when novo.risco in ('HIGH', 'CRITICAL') then 'atencao' else 'info' end,
          'Aprovação pendente: ' || novo.tipo, novo.agente || ' pediu para usar ' || novo.ferramenta || '.')
  on conflict (loja_id, chave) do nothing;
  perform private.pair_auditar(p_loja, p_usuario, 'aprovacao.proposta', 'aprovacoes',
    jsonb_build_object('aprovacao_id', novo.id, 'versao', novo.versao, 'tipo', novo.tipo, 'ferramenta', novo.ferramenta, 'agente', novo.agente,
                       'risco', novo.risco, 'sessao_id', p_sessao, 'dispositivo_id', p_dispositivo));
  return jsonb_build_object('id', novo.id, 'grupo_id', novo.grupo_id, 'versao', novo.versao, 'hash_proposta', novo.hash_proposta,
                            'estado', novo.estado, 'expira_em', novo.expira_em, 'risco', novo.risco, 'duplicado', false);
end $$;

-- O aprovador manda o hash que VIU. Se a proposta mudou (nova versão, adulteração), a decisão é recusada.
create function public.aprovacao_decidir(p_id uuid, p_hash_visto text, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.aprovacoes; uid uuid := auth.uid(); v_novo text;
begin
  if uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  if p_decisao not in ('aprovar', 'recusar') then raise exception 'decisão inválida' using errcode = '22023'; end if;
  select * into a from public.aprovacoes where id = p_id for update;
  if not found or not private.administra_loja(a.loja_id, uid) then raise exception 'aprovação não encontrada' using errcode = '42501'; end if; -- mesma resposta: sem oráculo entre lojas
  if a.estado = 'pendente' and a.expira_em <= now() then
    update public.aprovacoes set estado = 'expirada' where id = a.id;
    return jsonb_build_object('ok', false, 'motivo', 'expirada');
  end if;
  if a.estado <> 'pendente' then return jsonb_build_object('ok', false, 'motivo', 'estado_' || a.estado); end if;
  if p_hash_visto is distinct from a.hash_proposta then
    perform private.pair_auditar(a.loja_id, uid, 'aprovacao.hash_divergente', 'aprovacoes', jsonb_build_object('aprovacao_id', a.id));
    return jsonb_build_object('ok', false, 'motivo', 'proposta_alterada');
  end if;
  if p_decisao = 'aprovar' and a.risco in ('HIGH', 'CRITICAL') and not private.autenticacao_recente(300) then
    return jsonb_build_object('ok', false, 'motivo', 'reconfirmacao_necessaria');
  end if;
  v_novo := case p_decisao when 'aprovar' then 'aprovada' else 'recusada' end;
  update public.aprovacoes set estado = v_novo, decidido_por = uid, decidido_em = now(), hash_visto = p_hash_visto, motivo_decisao = left(p_motivo, 500)
   where id = a.id and estado = 'pendente';
  perform private.pair_auditar(a.loja_id, uid, 'aprovacao.' || v_novo, 'aprovacoes',
    jsonb_build_object('aprovacao_id', a.id, 'versao', a.versao, 'ferramenta', a.ferramenta, 'risco', a.risco, 'hash', a.hash_proposta));
  return jsonb_build_object('ok', true, 'estado', v_novo);
end $$;

-- Executor: reivindica a aprovação UMA vez (aprovada -> executando) conferindo versão exata e prazo.
create function public.aprovacao_consumir(p_id uuid, p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.aprovacoes;
begin
  update public.aprovacoes set estado = 'executando', executado_em = now()
   where id = p_id and estado = 'aprovada' and hash_proposta = p_hash and expira_em > now() returning * into a;
  if found then
    perform private.pair_auditar(a.loja_id, a.decidido_por, 'aprovacao.execucao_iniciada', 'aprovacoes', jsonb_build_object('aprovacao_id', a.id, 'ferramenta', a.ferramenta));
    return jsonb_build_object('ok', true, 'ferramenta', a.ferramenta, 'alvos', a.alvos, 'depois', a.depois, 'loja_id', a.loja_id);
  end if;
  select * into a from public.aprovacoes where id = p_id;
  return jsonb_build_object('ok', false, 'motivo', case when not found then 'inexistente' when a.hash_proposta <> p_hash then 'versao_diferente'
    when a.estado = 'aprovada' then 'expirada' else 'estado_' || a.estado end);
end $$;

create function public.aprovacao_concluir(p_id uuid, p_ok boolean, p_resultado jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.aprovacoes;
begin
  update public.aprovacoes set estado = case when p_ok then 'executada' else 'falhou' end, resultado = p_resultado
   where id = p_id and estado = 'executando' returning * into a;
  if not found then return jsonb_build_object('ok', false); end if;
  perform private.pair_auditar(a.loja_id, a.decidido_por, 'aprovacao.' || a.estado, 'aprovacoes', jsonb_build_object('aprovacao_id', a.id, 'ferramenta', a.ferramenta));
  return jsonb_build_object('ok', true, 'estado', a.estado);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7) Permissões e RLS
alter table public.pair_dispositivos enable row level security;
alter table public.pair_sessoes enable row level security;
alter table public.pair_desafios enable row level security;   -- sem policy e sem grant: só as funções acima
alter table public.aprovacoes enable row level security;

revoke all on public.pair_dispositivos, public.pair_sessoes, public.pair_desafios, public.aprovacoes from anon, authenticated;
grant select on public.pair_dispositivos to authenticated;
grant select (id, loja_id, usuario_id, dispositivo_id, escopos, criado_em, expira_em, limite_ate, ultimo_uso_em, revogado_em, motivo_revogacao) on public.pair_sessoes to authenticated; -- sem hashes
grant select on public.aprovacoes to authenticated;
grant select, insert, update, delete on public.pair_dispositivos, public.pair_sessoes, public.pair_desafios, public.aprovacoes to service_role;

create policy pair_disp_ver on public.pair_dispositivos for select to authenticated
  using (usuario_id = auth.uid() or private.administra_loja(loja_id, auth.uid()));
create policy pair_sess_ver on public.pair_sessoes for select to authenticated
  using (usuario_id = auth.uid() or private.administra_loja(loja_id, auth.uid()));
create policy aprovacoes_ver on public.aprovacoes for select to authenticated using (private.pode_ver_loja(loja_id));

revoke all on function public.pair_iniciar(text, text, text, text, text, text, text[], text[], int, int) from public, anon, authenticated;
revoke all on function public.pair_consultar(text, text) from public, anon, authenticated;
revoke all on function public.pair_validar(text) from public, anon, authenticated;
revoke all on function public.pair_renovar(text, text) from public, anon, authenticated;
revoke all on function public.aprovacao_propor(uuid, text, text, text, uuid, uuid, uuid, jsonb, jsonb, jsonb, text[], text, text, int, uuid) from public, anon, authenticated;
revoke all on function public.aprovacao_consumir(uuid, text) from public, anon, authenticated;
revoke all on function public.aprovacao_concluir(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.pair_iniciar(text, text, text, text, text, text, text[], text[], int, int) to service_role;
grant execute on function public.pair_consultar(text, text) to service_role;
grant execute on function public.pair_validar(text) to service_role;
grant execute on function public.pair_renovar(text, text) to service_role;
grant execute on function public.aprovacao_propor(uuid, text, text, text, uuid, uuid, uuid, jsonb, jsonb, jsonb, text[], text, text, int, uuid) to service_role;
grant execute on function public.aprovacao_consumir(uuid, text) to service_role;
grant execute on function public.aprovacao_concluir(uuid, boolean, jsonb) to service_role;

-- Lado do usuário (JWT): só authenticated
revoke all on function public.pair_detalhe(text) from public, anon;
revoke all on function public.pair_aprovar(text, uuid, text, text[], int, text[]) from public, anon;
revoke all on function public.pair_recusar(text) from public, anon;
revoke all on function public.pair_revogar_dispositivo(uuid, text) from public, anon;
revoke all on function public.pair_revogar_sessao(uuid, text) from public, anon;
revoke all on function public.pair_revogar_todos(uuid) from public, anon;
revoke all on function public.aprovacao_decidir(uuid, text, text, text) from public, anon;
grant execute on function public.pair_detalhe(text), public.pair_aprovar(text, uuid, text, text[], int, text[]), public.pair_recusar(text),
  public.pair_revogar_dispositivo(uuid, text), public.pair_revogar_sessao(uuid, text), public.pair_revogar_todos(uuid),
  public.aprovacao_decidir(uuid, text, text, text) to authenticated;

-- ROLLBACK (sem dados em produção antes do primeiro pareamento; conferir antes):
-- drop function public.aprovacao_concluir(uuid,boolean,jsonb), public.aprovacao_consumir(uuid,text), public.aprovacao_decidir(uuid,text,text,text),
--   public.aprovacao_propor(uuid,text,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb,text[],text,text,int,uuid), public.pair_revogar_todos(uuid),
--   public.pair_revogar_sessao(uuid,text), public.pair_revogar_dispositivo(uuid,text), private.pair_pode_revogar(uuid,uuid,uuid),
--   public.pair_renovar(text,text), public.pair_validar(text), public.pair_recusar(text), public.pair_aprovar(text,uuid,text,text[],int,text[]),
--   public.pair_detalhe(text), public.pair_consultar(text,text), public.pair_iniciar(text,text,text,text,text,text,text[],text[],int,int);
-- drop table public.aprovacoes, public.pair_desafios, public.pair_sessoes, public.pair_dispositivos;
-- drop function private.aprovacao_guarda(), private.aprovacao_hash_proposta(public.aprovacoes), private.aprovacao_hash_conteudo(public.aprovacoes),
--   private.aprovacao_hash_conteudo_de(uuid,text,text,text,jsonb,jsonb,jsonb,text[],text), private.risco_ordem(text), private.aprovacao_risco_minimo(text), private.pair_auditar(uuid,uuid,text,text,jsonb),
--   private.autenticacao_recente(int), private.pair_escopos_validos(), private.pair_sha256(text);
