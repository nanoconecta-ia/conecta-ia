-- Fase B do executor local (Nano.IA → Gateway MCP → agente Windows → PowerShell): FILA PERSISTENTE de tarefas.
-- Aplicada com autorização do proprietário (28/10/2026) no Supabase conecta-ia (versão 20261028065432). Reaproveita o Conecta Pair (pair_dispositivos 'agente_desktop' + pair_sessoes + pair_validar):
-- identidade, revogação, detecção de replay e isolamento por loja já existem; aqui entra só a fila.
-- Rollback no fim do arquivo.

create table public.exec_local_tarefas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  dispositivo_id uuid not null references public.pair_dispositivos(id) on delete cascade,
  capacidade text not null check (capacidade ~ '^windows\.[a-z_]+\.[a-z_]+$'),
  -- argv fixo do PowerShell: o banco recusa qualquer outra forma (defesa em profundidade; o agente também revalida)
  argv text[] not null check (
    cardinality(argv) = 6 and argv[1] = 'powershell.exe' and argv[2] = '-NoProfile' and argv[3] = '-NonInteractive'
    and argv[4] = '-NoLogo' and argv[5] = '-Command' and length(argv[6]) between 1 and 2000 and argv[6] !~ E'[\\r\\n\\x01-\\x08]'),
  timeout_ms int not null check (timeout_ms between 1000 and 60000),
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 8 and 100),
  agente text check (agente is null or length(agente) <= 60),            -- rótulo (claude/gemini/gpt...), só informativo
  estado text not null default 'NA_FILA' check (estado in ('NA_FILA', 'EM_EXECUCAO', 'CONCLUIDA', 'FALHOU', 'DESCONHECIDO', 'CANCELADA')),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  lease_ate timestamptz,
  concluido_em timestamptz,
  saida text check (octet_length(saida) <= 65536),            -- teto em BYTES (UTF-8), não em caracteres
  saida_truncada boolean not null default false,
  saida_bytes_originais int,
  saida_sha256 text check (saida_sha256 ~ '^[0-9a-f]{64}$'),
  erro text check (length(erro) <= 500)
);
create unique index exec_local_tarefas_idem on public.exec_local_tarefas (loja_id, idempotency_key) where idempotency_key is not null;
create index exec_local_tarefas_fila on public.exec_local_tarefas (dispositivo_id, criado_em) where estado in ('NA_FILA', 'EM_EXECUCAO');
alter table public.exec_local_tarefas enable row level security;     -- sem policy e sem grant: só pelas funções abaixo
revoke all on public.exec_local_tarefas from public, anon, authenticated;

-- Modelo autorizado POR CAPACIDADE (regex ancorada do corpo do -Command). O CHECK de estrutura do argv não basta: aqui o comando
-- precisa ser exatamente o da capacidade pedida. Gerado de capacidades.ts por scripts/exec-local/gerar_modelos_sql.mjs (teste de deriva confere).
create table public.exec_local_modelos (capacidade text primary key check (capacidade ~ '^windows\.[a-z_]+\.[a-z_]+$'), padrao text not null);
alter table public.exec_local_modelos enable row level security;
revoke all on public.exec_local_modelos from public, anon, authenticated;
insert into public.exec_local_modelos (capacidade, padrao) values
  ('windows.sistema.inventario', $pad$^Get\-CimInstance\ Win32_OperatingSystem\ \|\ Select\-Object\ Caption\,Version\,OSArchitecture\,TotalVisibleMemorySize\ \|\ ConvertTo\-Json\ \-Compress$$pad$),
  ('windows.ambiente.versoes', $pad$^\[pscustomobject\]\@\{Windows\=\[System\.Environment\]\:\:OSVersion\.VersionString\;\ PowerShell\=\$PSVersionTable\.PSVersion\.ToString\(\)\;\ Ferramentas\=\@\(Get\-Command\ node\ \-ErrorAction\ SilentlyContinue\ \|\ Select\-Object\ Name\,Version\,Source\)\}\ \|\ ConvertTo\-Json\ \-Compress$$pad$),
  ('windows.disco.livre', $pad$^Get\-PSDrive\ \-Name\ (?:[A-Za-z]:?)\ \|\ Select\-Object\ Name\,Used\,Free\ \|\ ConvertTo\-Json\ \-Compress$$pad$),
  ('windows.processo.existe', $pad$^Get\-Process\ \-Name\ (?:[A-Za-z0-9_.-]{1,40})\ \-ErrorAction\ SilentlyContinue\ \|\ Measure\-Object\ \|\ Select\-Object\ Count\ \|\ ConvertTo\-Json\ \-Compress$$pad$),
  ('windows.servico.estado', $pad$^Get\-Service\ \-Name\ (?:[A-Za-z0-9_.-]{1,40})\ \-ErrorAction\ SilentlyContinue\ \|\ Select\-Object\ Name\,Status\ \|\ ConvertTo\-Json\ \-Compress$$pad$);

-- Corta em no máximo p_max BYTES sem partir um caractere UTF-8 (sempre remove caracteres inteiros).
create function private.exec_local_cortar_bytes(p_texto text, p_max int) returns text language plpgsql immutable set search_path = '' as $$
declare v text := coalesce(p_texto, ''); n int := length(v);
begin
  while octet_length(v) > p_max loop
    n := n - greatest(1, ceil((octet_length(v) - p_max) / 4.0)::int);   -- cada caractere tem de 1 a 4 bytes: nunca passa do ponto
    v := left(v, n);
  end loop;
  return v;
end $$;

-- Limpeza de estados vencidos: dispositivo revogado cancela o que está na fila; NA_FILA velha (>2 min) cancela;
-- EM_EXECUCAO com lease vencida vira DESCONHECIDO (nunca volta para a fila sozinha: não repetir às cegas).
create function private.exec_local_expirar(p_loja uuid) returns void language sql security definer set search_path = '' as $$
  update public.exec_local_tarefas t set estado = 'CANCELADA', concluido_em = now(), erro = 'dispositivo_revogado'
   where t.loja_id = p_loja and t.estado = 'NA_FILA' and exists (select 1 from public.pair_dispositivos d where d.id = t.dispositivo_id and d.revogado_em is not null);
  update public.exec_local_tarefas set estado = 'CANCELADA', concluido_em = now(), erro = 'expirou_na_fila'
   where loja_id = p_loja and estado = 'NA_FILA' and criado_em < now() - interval '2 minutes';
  update public.exec_local_tarefas set estado = 'DESCONHECIDO', concluido_em = now(), erro = 'lease_vencida_resultado_nao_confirmado'
   where loja_id = p_loja and estado = 'EM_EXECUCAO' and lease_ate < now();
$$;

create function public.exec_local_enfileirar(p_loja uuid, p_dispositivo uuid, p_capacidade text, p_argv text[], p_timeout_ms int,
                                              p_idem text default null, p_agente text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.pair_dispositivos; v_id uuid; v_fila int;
begin
  select * into d from public.pair_dispositivos where id = p_dispositivo and loja_id = p_loja;
  if not found or d.tipo <> 'agente_desktop' or d.revogado_em is not null then raise exception 'dispositivo inválido para a loja' using errcode = '42501'; end if;
  if p_capacidade is null or not (p_capacidade = any (d.capacidades)) then raise exception 'capacidade fora da lista do dispositivo' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_dispositivo::text, 0));   -- serializa enfileiramentos do dispositivo: limite de 20 e idempotência sem corrida
  if not exists (select 1 from public.exec_local_modelos m where m.capacidade = p_capacidade and p_argv[6] ~ m.padrao) then
    raise exception 'comando não corresponde ao modelo autorizado da capacidade' using errcode = '42501';
  end if;
  perform private.exec_local_expirar(p_loja);
  if p_idem is not null then
    select id into v_id from public.exec_local_tarefas where loja_id = p_loja and idempotency_key = p_idem;
    if found then return v_id; end if;
  end if;
  select count(*) into v_fila from public.exec_local_tarefas where dispositivo_id = p_dispositivo and estado in ('NA_FILA', 'EM_EXECUCAO');
  if v_fila >= 20 then raise exception 'fila do dispositivo cheia' using errcode = '54000'; end if;
  insert into public.exec_local_tarefas (loja_id, dispositivo_id, capacidade, argv, timeout_ms, idempotency_key, agente)
  values (p_loja, p_dispositivo, p_capacidade, p_argv, p_timeout_ms, p_idem, p_agente) returning id into v_id;
  perform private.pair_auditar(p_loja, null, 'exec_local.enfileirada', 'exec_local_tarefas',
    jsonb_build_object('tarefa_id', v_id, 'dispositivo_id', p_dispositivo, 'capacidade', p_capacidade, 'agente', p_agente));
  return v_id;
end $$;

-- Agente: devolve null (sessão inválida/revogada), '{}' (nada na fila) ou a próxima tarefa (já marcada EM_EXECUCAO com lease).
create function public.exec_local_puxar(p_token_hash text, p_sal_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s jsonb; t public.exec_local_tarefas;
begin
  s := public.pair_validar(p_token_hash, p_sal_hash);
  if s is null or s ->> 'tipo' <> 'agente_desktop' then return null; end if;
  perform private.exec_local_expirar((s ->> 'loja_id')::uuid);
  select * into t from public.exec_local_tarefas where dispositivo_id = (s ->> 'dispositivo_id')::uuid and estado = 'NA_FILA'
   order by criado_em limit 1 for update skip locked;
  if not found then return '{}'::jsonb; end if;
  update public.exec_local_tarefas set estado = 'EM_EXECUCAO', iniciado_em = now(), lease_ate = now() + make_interval(secs => t.timeout_ms / 1000.0 + 10) where id = t.id;
  return jsonb_build_object('job_id', t.id, 'capacidade', t.capacidade, 'argv', to_jsonb(t.argv), 'timeout_ms', t.timeout_ms);
end $$;

-- Agente devolve o resultado. Só vale para tarefa DO PRÓPRIO dispositivo, EM_EXECUCAO e dentro da lease. Devolve o estado final ou 'ignorado'.
create function public.exec_local_resultado(p_token_hash text, p_sal_hash text, p_tarefa uuid, p_ok boolean, p_saida text, p_erro text) returns text
language plpgsql security definer set search_path = '' as $$
declare s jsonb; t public.exec_local_tarefas; v_saida text := private.exec_local_cortar_bytes(p_saida, 65536); v_estado text;
begin
  s := public.pair_validar(p_token_hash, p_sal_hash);
  if s is null or s ->> 'tipo' <> 'agente_desktop' then return null; end if;
  select * into t from public.exec_local_tarefas where id = p_tarefa and dispositivo_id = (s ->> 'dispositivo_id')::uuid for update;
  if not found or t.estado <> 'EM_EXECUCAO' or t.lease_ate < now() then return 'ignorado'; end if;
  v_estado := case when p_ok then 'CONCLUIDA' else 'FALHOU' end;
  update public.exec_local_tarefas set estado = v_estado, concluido_em = now(),
    saida = case when p_ok then v_saida end, saida_sha256 = case when p_ok then encode(sha256(convert_to(v_saida, 'UTF8')), 'hex') end,   -- hash do valor EXATO persistido
    saida_truncada = p_ok and octet_length(coalesce(p_saida, '')) > octet_length(v_saida), saida_bytes_originais = case when p_ok then octet_length(coalesce(p_saida, '')) end,
    erro = case when p_ok then null else left(coalesce(p_erro, 'falha'), 500) end where id = t.id;
  perform private.pair_auditar(t.loja_id, null, 'exec_local.' || lower(v_estado), 'exec_local_tarefas',
    jsonb_build_object('tarefa_id', t.id, 'dispositivo_id', t.dispositivo_id, 'capacidade', t.capacidade));
  return v_estado;
end $$;

-- Gateway: lê o estado de uma tarefa DA PRÓPRIA loja (outra loja => null).
create function public.exec_local_estado(p_loja uuid, p_tarefa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.exec_local_tarefas;
begin
  perform private.exec_local_expirar(p_loja);
  select * into t from public.exec_local_tarefas where id = p_tarefa and loja_id = p_loja;
  if not found then return null; end if;
  return jsonb_build_object('estado', t.estado, 'dispositivo_id', t.dispositivo_id, 'capacidade', t.capacidade, 'saida', t.saida,
    'sha256', t.saida_sha256, 'truncada', t.saida_truncada, 'bytes_originais', t.saida_bytes_originais, 'erro', t.erro, 'concluido_em', t.concluido_em);
end $$;

create function public.exec_local_cancelar(p_loja uuid, p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.exec_local_tarefas set estado = 'CANCELADA', concluido_em = now(), erro = 'cancelada_pelo_gateway'
   where id = p_tarefa and loja_id = p_loja and estado = 'NA_FILA';
  get diagnostics n = row_count; return n = 1;
end $$;

revoke all on function private.exec_local_expirar(uuid), private.exec_local_cortar_bytes(text, int) from public, anon, authenticated, service_role;
revoke all on function public.exec_local_enfileirar(uuid, uuid, text, text[], int, text, text), public.exec_local_puxar(text, text),
  public.exec_local_resultado(text, text, uuid, boolean, text, text), public.exec_local_estado(uuid, uuid), public.exec_local_cancelar(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.exec_local_enfileirar(uuid, uuid, text, text[], int, text, text), public.exec_local_puxar(text, text),
  public.exec_local_resultado(text, text, uuid, boolean, text, text), public.exec_local_estado(uuid, uuid), public.exec_local_cancelar(uuid, uuid)
  to service_role;

-- ROLLBACK (sem perda de dado do produto; só a fila de tarefas):
--   drop function public.exec_local_cancelar(uuid, uuid), public.exec_local_estado(uuid, uuid), public.exec_local_resultado(text, text, uuid, boolean, text, text),
--     public.exec_local_puxar(text, text), public.exec_local_enfileirar(uuid, uuid, text, text[], int, text, text), private.exec_local_expirar(uuid);
--   drop function private.exec_local_cortar_bytes(text, int);
--   drop table public.exec_local_tarefas, public.exec_local_modelos;
