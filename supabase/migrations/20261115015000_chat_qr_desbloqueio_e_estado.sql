-- PR #378: libera o turno ao responder e limita o bloqueio ao prazo real da fila.
-- Disponibilidade de QR consultada no servidor, sem conceder SELECT em pair_sessoes ao navegador.
begin;

create or replace function public.chat_qr_disponivel(p_loja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ate timestamptz;
begin
  if auth.uid() is null or not private.chat_vinculo(p_loja, auth.uid()) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select max(s.limite_ate) into v_ate
    from public.pair_sessoes s
   where s.loja_id = p_loja
     and s.revogado_em is null
     and s.limite_ate > now()
     and 'chat:responder' = any(s.escopos);
  return jsonb_build_object('disponivel', v_ate is not null, 'ate', v_ate);
end $$;
revoke all on function public.chat_qr_disponivel(uuid) from public, anon, authenticated;
grant execute on function public.chat_qr_disponivel(uuid) to authenticated, service_role;

create or replace function public.chat_fila_enfileirar(p_loja uuid, p_mensagem uuid, p_prazo_s int default 90) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conversa uuid; v_id uuid; v_prazo timestamptz;
begin
  if p_prazo_s is null or p_prazo_s < 30 or p_prazo_s > 300 then return jsonb_build_object('ok', false, 'motivo', 'prazo_invalido'); end if;
  select m.conversa_id into v_conversa from public.mensagens m where m.id = p_mensagem and m.loja_id = p_loja and m.papel = 'usuario';
  if v_conversa is null then return jsonb_build_object('ok', false, 'motivo', 'mensagem_invalida'); end if;
  insert into public.chat_fila (loja_id, conversa_id, mensagem_id, prazo_em)
  values (p_loja, v_conversa, p_mensagem, now() + make_interval(secs => p_prazo_s))
  on conflict (mensagem_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.chat_fila where mensagem_id = p_mensagem; end if;
  select prazo_em into v_prazo from public.chat_fila where id = v_id;
  -- chat_iniciar reserva 15 minutos para provedores externos; na fila QR a reserva dura no máximo 90s.
  update public.conversas
     set turno_ate = v_prazo
   where id = v_conversa and loja_id = p_loja and turno_pergunta = p_mensagem and turno_ate > v_prazo;
  return jsonb_build_object('ok', true, 'fila_id', v_id);
end $$;

create or replace function public.chat_fila_responder(p_sessao uuid, p_fila uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; f public.chat_fila; m public.mensagens; v_resp uuid;
begin
  s := private.chat_sessao_valida(p_sessao);
  if s.id is null then return jsonb_build_object('ok', false, 'motivo', 'sessao_sem_permissao'); end if;
  if p_texto is null or char_length(btrim(p_texto)) < 1 or char_length(p_texto) > 8000 then return jsonb_build_object('ok', false, 'motivo', 'texto_invalido'); end if;
  select * into f from public.chat_fila where id = p_fila and loja_id = s.loja_id for update;
  if f.id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada'); end if;
  if f.estado <> 'entregue' or f.sessao_id is distinct from s.id then return jsonb_build_object('ok', false, 'motivo', 'estado_' || f.estado); end if;
  if f.prazo_em <= now() then
    update public.chat_fila set estado = 'expirada' where id = f.id;
    return jsonb_build_object('ok', false, 'motivo', 'prazo_vencido');
  end if;
  select * into m from public.mensagens where id = f.mensagem_id;
  begin
    insert into public.mensagens (loja_id, user_id, conversa_id, papel, conteudo, em_resposta_a, metadados)
    values (m.loja_id, m.user_id, m.conversa_id, 'assistente', p_texto, m.id,
            jsonb_build_object('origem', 'agente_qr', 'sessao_id', s.id, 'dispositivo_id', s.dispositivo_id))
    returning id into v_resp;
  exception when unique_violation then
    update public.chat_fila set estado = 'fallback' where id = f.id;
    return jsonb_build_object('ok', false, 'motivo', 'ja_respondida');
  end;
  update public.chat_fila set estado = 'respondida', resposta_id = v_resp, respondida_em = now() where id = f.id;
  -- Sem esse passo o usuário fica 15 minutos impossibilitado de fazer nova pergunta.
  update public.conversas
     set turno_token = null, turno_pergunta = null, turno_ate = null, atualizada_em = now()
   where id = f.conversa_id and loja_id = f.loja_id and turno_pergunta = f.mensagem_id;
  return jsonb_build_object('ok', true, 'resposta_id', v_resp);
end $$;

revoke all on function public.chat_fila_enfileirar(uuid,uuid,int), public.chat_fila_responder(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.chat_fila_enfileirar(uuid,uuid,int), public.chat_fila_responder(uuid,uuid,text) to service_role;
commit;
