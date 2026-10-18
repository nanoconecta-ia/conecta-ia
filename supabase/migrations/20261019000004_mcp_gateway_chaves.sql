-- Gateway MCP do Conector IA: endurece loja_mcp_chaves (Fase 1, PROPOSTA: não aplicar em produção sem aprovação específica).
-- Chave por loja, escopos mínimos, expiração obrigatória e revogação. O token aparece UMA vez; só o hash fica no banco.
-- Nenhum escopo de aprovar/executar existe: cliente externo (GPT, Gemini, Claude) nunca aprova nem escreve no ERP.
alter table public.loja_mcp_chaves
  add column prefixo text,
  add column cliente text check (cliente is null or char_length(cliente) <= 60),
  add column criada_por uuid,
  add column expira_em timestamptz,
  add column revogada_por uuid;
alter table public.loja_mcp_chaves add constraint loja_mcp_chaves_escopos_validos
  check (cardinality(escopos) > 0 and escopos <@ array['leitura', 'propor', 'simular']);
grant select (prefixo, cliente, criada_por, expira_em, revogada_por) on public.loja_mcp_chaves to authenticated;

create function public.mcp_chave_criar(p_loja uuid, p_user uuid, p_nome text, p_cliente text, p_hash text, p_prefixo text, p_escopos text[], p_expira_em timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao: só o lojista cria chave' using errcode = '42501'; end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'hash_invalido' using errcode = '22023'; end if;
  if p_expira_em is null or p_expira_em <= now() or p_expira_em > now() + interval '365 days' then raise exception 'expiracao_invalida: use de 1 minuto a 365 dias' using errcode = '22023'; end if;
  if (select count(*) from public.loja_mcp_chaves where loja_id = p_loja and revogada_em is null and expira_em > now()) >= 10 then raise exception 'limite_de_chaves_ativas' using errcode = '54000'; end if;
  insert into public.loja_mcp_chaves (loja_id, nome, cliente, hash_chave, prefixo, escopos, criada_por, expira_em)
  values (p_loja, left(p_nome, 80), left(p_cliente, 60), p_hash, p_prefixo, p_escopos, p_user, p_expira_em) returning id into v_id;
  perform private.auditar(p_loja, p_user, 'mcp.chave.criada', 'loja_mcp_chaves', null, jsonb_build_object('id', v_id, 'escopos', p_escopos, 'expira_em', p_expira_em));
  return v_id;
end $$;

-- Valida pelo hash: não revogada, não expirada, loja ativa. Atualiza o último uso. Zero linhas = recusar.
create function public.mcp_chave_validar(p_hash text) returns table (chave_id uuid, loja_id uuid, escopos text[], criada_por uuid, nome text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    update public.loja_mcp_chaves k set ultimo_uso_em = now()
    from public.lojas l
    where k.hash_chave = p_hash and k.revogada_em is null and k.expira_em > now() and l.id = k.loja_id and l.ativa
    returning k.id, k.loja_id, k.escopos, k.criada_por, k.nome;
end $$;

create function public.mcp_chave_revogar(p_loja uuid, p_chave uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not private.eh_membro(p_loja, p_user, true) then raise exception 'sem_permissao: só o lojista revoga' using errcode = '42501'; end if;
  update public.loja_mcp_chaves set revogada_em = now(), revogada_por = p_user where id = p_chave and loja_id = p_loja and revogada_em is null;
  get diagnostics v_n = row_count;
  if v_n = 1 then perform private.auditar(p_loja, p_user, 'mcp.chave.revogada', 'loja_mcp_chaves', null, jsonb_build_object('id', p_chave)); end if;
  return v_n = 1;
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('mcp_chave_criar', 'mcp_chave_validar', 'mcp_chave_revogar') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
