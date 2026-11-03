-- APLICAÇÃO MANUAL no SQL Editor (projeto conecta-ia, ref dsfzhsrudriqkumtlqwj). CONFIRA O REF NA BARRA DO PAINEL ANTES.
-- ORDEM: só depois de contexto e contexto-registrar (já aplicadas). Recria 1 função de escopos (create or replace, sem DROP) e cria 1 função nova só do service_role.
-- Numa transação: se algo falhar, nada é aplicado. Reversão: docs/conector-ia/CONTEXTO_EXTENSAO_REVERSAO.sql
begin;
set local lock_timeout = '5s';
do $$ begin if to_regclass('public.contexto_sessoes') is null then raise exception 'aplique antes a migração contexto_sessoes'; end if; end $$;

-- Ponte ERP: a extensão (sessão de pareamento) informa o produto aberto na tela do Bling. Sem alterar produto nem ERP.
-- 1) escopo novo 'contexto:registrar' (somente para o conecta-gateway); 2) função só do service_role que grava o contexto como a pessoa que aprovou a sessão.
create or replace function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'bling:consultar', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler', 'contexto:registrar', 'mcp:leitura', 'mcp:propor'];
$$;

create function public.contexto_registrar_extensao(p_loja uuid, p_user uuid, p_sku text, p_acao text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal text := 'u:' || p_user::text;
  v_prod uuid;
  v_row public.contexto_sessoes%rowtype;
begin
  if p_loja is null or p_user is null or p_acao not in ('aberto', 'fechado') or p_sku is null or char_length(btrim(p_sku)) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'erro', 'evento_invalido'); end if;
  -- a pessoa que aprovou a sessão precisa pertencer à loja (defesa em profundidade)
  if not exists (select 1 from public.usuarios_loja where loja_id = p_loja and user_id = p_user) then return jsonb_build_object('ok', false, 'erro', 'sem_acesso'); end if;
  select id into v_prod from public.produtos where loja_id = p_loja and sku = btrim(p_sku) limit 1;
  if v_prod is null then return jsonb_build_object('ok', false, 'erro', 'produto_nao_encontrado'); end if;

  insert into public.contexto_sessoes (loja_id, principal, origem) values (p_loja, v_principal, 'bling-ui') on conflict (loja_id, principal) do nothing;
  select * into v_row from public.contexto_sessoes where loja_id = p_loja and principal = v_principal for update;
  if v_row.expira_em <= now() then v_row.versao := 0; end if;
  if p_acao = 'fechado' then
    -- fecha só se o produto fechado ainda é o ativo (evita apagar o contexto de outro produto aberto em seguida)
    if v_row.produto_ativo_id is distinct from v_prod then return jsonb_build_object('ok', true, 'versao', v_row.versao, 'ignorado', true); end if;
    update public.contexto_sessoes set origem = 'bling-ui', produto_ativo_id = null, produtos_selecionados = '{}', versao = v_row.versao + 1, ultimo_evento_id = null,
      atualizado_em = now(), expira_em = now() + interval '30 minutes' where loja_id = p_loja and principal = v_principal;
  else
    update public.contexto_sessoes set origem = 'bling-ui', produto_ativo_id = v_prod, produtos_selecionados = array[v_prod], versao = v_row.versao + 1, ultimo_evento_id = null,
      atualizado_em = now(), expira_em = now() + interval '30 minutes' where loja_id = p_loja and principal = v_principal;
  end if;
  return jsonb_build_object('ok', true, 'versao', v_row.versao + 1);
end $$;
revoke all on function public.contexto_registrar_extensao(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.contexto_registrar_extensao(uuid, uuid, text, text) to service_role;

do $$ begin
  if not ('contexto:registrar' = any(private.pair_escopos_validos())) then raise exception 'escopo não registrado'; end if;
  if has_function_privilege('anon', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute') or has_function_privilege('authenticated', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute') then raise exception 'navegador não pode executar'; end if;
  if not has_function_privilege('service_role', 'public.contexto_registrar_extensao(uuid,uuid,text,text)', 'execute') then raise exception 'service_role deve executar'; end if;
  if exists (select 1 from public.pair_sessoes where not (escopos <@ private.pair_escopos_validos())) then raise exception 'há sessão com escopo fora da lista'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name) values ('20261103000006', 'contexto_extensao') on conflict (version) do nothing;
select 'OK' as resultado;
commit;
