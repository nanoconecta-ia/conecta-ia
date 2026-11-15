-- Presença unificada do Agente QR. Atualizada exclusivamente ao reivindicar a fila de chat.
-- Evita status falsamente online quando somente o token/pareamento foi renovado.
begin;
alter table public.pair_sessoes add column if not exists chat_escuta_em timestamptz;
create or replace function public.chat_fila_reivindicar(p_sessao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; f public.chat_fila; v_texto text; v_hist jsonb;
begin
  -- Serializa reivindicações da mesma sessão, inclusive quando ainda não há linha entregue para bloquear.
  perform pg_advisory_xact_lock(hashtextextended('chat-fila-sessao:' || p_sessao::text, 0));
  s := private.chat_sessao_valida(p_sessao);
  if s.id is null then return jsonb_build_object('ok', false, 'motivo', 'sessao_sem_permissao'); end if;
  -- Presença: somente consumo real da fila, nunca simples renovação de token.
  update public.pair_sessoes set chat_escuta_em = now() where id = s.id
    and (chat_escuta_em is null or chat_escuta_em < now() - interval '10 seconds');
  update public.chat_fila set estado = 'expirada'
   where loja_id = s.loja_id and estado in ('pendente', 'entregue') and prazo_em <= now();
  if exists (select 1 from public.chat_fila where sessao_id = s.id and estado = 'entregue') then
    return jsonb_build_object('ok', true, 'vazio', true, 'ocupado', true);
  end if;
  select * into f from public.chat_fila
   where loja_id = s.loja_id and estado = 'pendente' and prazo_em > now()
   order by criado_em, id limit 1 for update skip locked;
  if f.id is null then return jsonb_build_object('ok', true, 'vazio', true); end if;
  update public.chat_fila set estado = 'entregue', sessao_id = s.id, entregue_em = now() where id = f.id;
  select conteudo into v_texto from public.mensagens where id = f.mensagem_id;
  select coalesce(jsonb_agg(jsonb_build_object('papel', h.papel, 'texto', h.conteudo, 'em', h.criada_em) order by h.criada_em), '[]'::jsonb)
    into v_hist
    from (select papel, conteudo, criada_em from public.mensagens
           where conversa_id = f.conversa_id and loja_id = s.loja_id and id <> f.mensagem_id and criada_em <= (select criada_em from public.mensagens where id = f.mensagem_id)
           order by criada_em desc limit 10) h;
  return jsonb_build_object('ok', true, 'vazio', false, 'fila_id', f.id, 'mensagem', v_texto, 'prazo_em', f.prazo_em, 'historico', v_hist);
end $$;
create or replace function public.chat_qr_disponivel(p_loja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_token timestamptz; v_janela timestamptz; v_escuta timestamptz;
begin
  if auth.uid() is null or not private.chat_vinculo(p_loja, auth.uid()) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select s.expira_em, s.limite_ate into v_token, v_janela
    from public.pair_sessoes s join public.pair_dispositivos d on d.id = s.dispositivo_id and d.revogado_em is null
   where s.loja_id = p_loja
     and s.revogado_em is null
     and s.limite_ate > now()
     and 'chat:responder' = any(s.escopos)
   order by s.expira_em desc, s.limite_ate desc
   limit 1;
  -- Pulso da fila somente de sessões realmente autorizadas e com token ativo.
  select max(s.chat_escuta_em) into v_escuta from public.pair_sessoes s join public.pair_dispositivos d on d.id = s.dispositivo_id and d.revogado_em is null
   where s.loja_id = p_loja and s.revogado_em is null
     and s.expira_em > now() and s.limite_ate > now()
     and 'chat:responder' = any(s.escopos);
  return jsonb_build_object(
    'disponivel', coalesce(v_token > now() and v_janela > now(), false),
    'ate', case when v_token > now() and v_janela > now() then least(v_token, v_janela) else null end,
    'online', coalesce(v_escuta >= now() - interval '75 seconds', false),
    'ultimo_sinal_em', v_escuta,
    'token_ate', v_token,
    'janela_ate', v_janela
  );
end $$;
commit;
