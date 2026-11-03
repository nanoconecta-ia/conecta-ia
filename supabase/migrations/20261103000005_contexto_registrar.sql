-- RASCUNHO PARA APROVAÇÃO. NÃO APLICAR antes do aval do dono. Depende de 20261103000003_contexto_sessoes.
-- Contexto Vivo: única porta de ESCRITA do contexto pelo painel. A identidade (usuário, loja) vem do servidor (auth.uid + pode_ver_loja);
-- o cliente só diz a ação, os produtos e a versão que viu. Mesmas regras do módulo _shared/contexto/contexto.ts (referência testada).
create function public.contexto_registrar(p_loja uuid, p_evento uuid, p_acao text, p_origem text, p_ativo uuid, p_selecionados uuid[], p_versao_base integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_principal text;
  v_row public.contexto_sessoes%rowtype;
  v_ids uuid[] := coalesce(p_selecionados, '{}');
  v_ativo uuid := p_ativo;
  v_validos integer;
  v_todos uuid[];
begin
  if v_user is null or p_loja is null or not private.pode_ver_loja(p_loja) then return jsonb_build_object('ok', false, 'erro', 'sem_acesso'); end if;
  if p_evento is null or p_acao not in ('produto.selecionado', 'produto.aberto', 'produto.fechado', 'selecao.limpa')
     or p_origem not in ('conecta-ui', 'bling-ui') or p_versao_base is null or p_versao_base < 0 then
    return jsonb_build_object('ok', false, 'erro', 'evento_invalido'); end if;
  if cardinality(v_ids) > 100 then return jsonb_build_object('ok', false, 'erro', 'selecao_excessiva'); end if;
  if (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids) or array_position(v_ids, null) is not null then return jsonb_build_object('ok', false, 'erro', 'selecao_duplicada'); end if;
  if p_acao = 'selecao.limpa' then v_ids := '{}'; v_ativo := null; end if;
  if p_acao = 'produto.fechado' then v_ativo := null; end if;
  if p_acao = 'produto.aberto' and v_ativo is null then return jsonb_build_object('ok', false, 'erro', 'produto_ativo_ausente'); end if;

  v_principal := 'u:' || v_user::text;
  insert into public.contexto_sessoes (loja_id, principal, origem) values (p_loja, v_principal, p_origem) on conflict (loja_id, principal) do nothing;
  select * into v_row from public.contexto_sessoes where loja_id = p_loja and principal = v_principal for update;

  if v_row.expira_em <= now() then
    update public.contexto_sessoes set produto_ativo_id = null, produtos_selecionados = '{}', versao = 0, ultimo_evento_id = null, origem = p_origem,
      atualizado_em = now(), expira_em = now() + interval '30 minutes' where loja_id = p_loja and principal = v_principal;
    return jsonb_build_object('ok', false, 'erro', 'contexto_expirado', 'versao', 0);
  end if;
  if v_row.ultimo_evento_id = p_evento then return jsonb_build_object('ok', true, 'duplicado', true, 'versao', v_row.versao); end if;
  if p_versao_base <> v_row.versao then return jsonb_build_object('ok', false, 'erro', 'versao_conflito', 'versao', v_row.versao); end if;

  v_todos := case when v_ativo is null then v_ids else array_append(v_ids, v_ativo) end;
  select count(distinct id) into v_validos from public.produtos where loja_id = p_loja and id = any(v_todos);
  if v_validos <> (select count(distinct x) from unnest(v_todos) x) then return jsonb_build_object('ok', false, 'erro', 'produto_fora_da_loja'); end if;

  update public.contexto_sessoes set origem = p_origem, produto_ativo_id = v_ativo, produtos_selecionados = v_ids, versao = v_row.versao + 1, ultimo_evento_id = p_evento,
    atualizado_em = now(), expira_em = now() + interval '30 minutes' where loja_id = p_loja and principal = v_principal;
  return jsonb_build_object('ok', true, 'versao', v_row.versao + 1);
end $$;
revoke all on function public.contexto_registrar(uuid, uuid, text, text, uuid, uuid[], integer) from public, anon;
grant execute on function public.contexto_registrar(uuid, uuid, text, text, uuid, uuid[], integer) to authenticated;
