-- Ponte chat do Nano <-> agente conectado pelo QR (desenho: docs/conecta-pair/PONTE-CHAT-NANO-QR.md). Passo 1: escopo e fila.
-- O agente só recebe mensagem da loja da SUA sessão, só com o escopo chat:responder e só dentro do prazo.
-- Nada aqui chama IA, publica, aprova ou grava no ERP. Funções só para o service_role (o gateway).
begin;

-- 1) escopo novo (lista fechada; o rótulo para o lojista fica em _shared/pair/escopos.ts)
create or replace function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'bling:consultar', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler', 'contexto:registrar', 'mcp:leitura', 'mcp:propor',
               'chat:responder'];
$$;

-- 2) fila: uma linha por mensagem do lojista enviada para o agente
create table public.chat_fila (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  mensagem_id uuid not null unique references public.mensagens(id) on delete cascade,
  estado text not null default 'pendente' check (estado in ('pendente', 'entregue', 'respondida', 'expirada', 'fallback')),
  sessao_id uuid references public.pair_sessoes(id) on delete set null,
  resposta_id uuid references public.mensagens(id) on delete set null,
  prazo_em timestamptz not null,
  criado_em timestamptz not null default now(),
  entregue_em timestamptz,
  respondida_em timestamptz,
  check (prazo_em > criado_em),
  check ((estado = 'respondida') = (resposta_id is not null and respondida_em is not null)),
  check (estado = 'pendente' or estado in ('expirada', 'fallback') or (sessao_id is not null and entregue_em is not null))
);
-- Defesa adicional: nenhuma sessão mantém duas entregas ativas, inclusive sob concorrência.
create unique index chat_fila_uma_entrega_sessao_idx on public.chat_fila (sessao_id) where estado = 'entregue';
create index chat_fila_pendentes_idx on public.chat_fila (loja_id, estado, criado_em);

alter table public.chat_fila enable row level security;
create policy chat_fila_loja on public.chat_fila for select to authenticated using (private.pode_ver_loja(loja_id));
revoke all on public.chat_fila from public, anon, authenticated;
grant select on public.chat_fila to authenticated;
grant all on public.chat_fila to service_role;

-- sessão viva com o escopo, ou null
create function private.chat_sessao_valida(p_sessao uuid) returns public.pair_sessoes
language sql stable security definer set search_path = '' as $$
  select s.* from public.pair_sessoes s
   where s.id = p_sessao and s.revogado_em is null and s.limite_ate > now() and 'chat:responder' = any(s.escopos)
$$;
revoke all on function private.chat_sessao_valida(uuid) from public, anon, authenticated;

-- 3) enfileirar (chamado pelo servidor do chat quando o lojista escolheu o agente do QR)
create function public.chat_fila_enfileirar(p_loja uuid, p_mensagem uuid, p_prazo_s int default 90) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_conversa uuid; v_id uuid;
begin
  if p_prazo_s is null or p_prazo_s < 30 or p_prazo_s > 300 then return jsonb_build_object('ok', false, 'motivo', 'prazo_invalido'); end if;
  select m.conversa_id into v_conversa from public.mensagens m where m.id = p_mensagem and m.loja_id = p_loja and m.papel = 'usuario';
  if v_conversa is null then return jsonb_build_object('ok', false, 'motivo', 'mensagem_invalida'); end if;
  insert into public.chat_fila (loja_id, conversa_id, mensagem_id, prazo_em)
  values (p_loja, v_conversa, p_mensagem, now() + make_interval(secs => p_prazo_s))
  on conflict (mensagem_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.chat_fila where mensagem_id = p_mensagem; end if;
  return jsonb_build_object('ok', true, 'fila_id', v_id);
end $$;

-- 4) o agente pega a próxima mensagem da loja da sessão (uma entrega por vez; vencidas viram expirada)
create function public.chat_fila_reivindicar(p_sessao uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.pair_sessoes; f public.chat_fila; v_texto text; v_hist jsonb;
begin
  -- Serializa reivindicações da mesma sessão, inclusive quando ainda não há linha entregue para bloquear.
  perform pg_advisory_xact_lock(hashtextextended('chat-fila-sessao:' || p_sessao::text, 0));
  s := private.chat_sessao_valida(p_sessao);
  if s.id is null then return jsonb_build_object('ok', false, 'motivo', 'sessao_sem_permissao'); end if;
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

-- 5) o agente responde (só quem pegou, só no prazo, só uma resposta por mensagem)
create function public.chat_fila_responder(p_sessao uuid, p_fila uuid, p_texto text) returns jsonb
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
  return jsonb_build_object('ok', true, 'resposta_id', v_resp);
end $$;

revoke all on function public.chat_fila_enfileirar(uuid, uuid, int), public.chat_fila_reivindicar(uuid), public.chat_fila_responder(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.chat_fila_enfileirar(uuid, uuid, int), public.chat_fila_reivindicar(uuid), public.chat_fila_responder(uuid, uuid, text) to service_role;
grant execute on function private.chat_sessao_valida(uuid) to service_role;

commit;
-- ROLLBACK (manual, só com autorização): drop function public.chat_fila_responder(uuid,uuid,text), public.chat_fila_reivindicar(uuid), public.chat_fila_enfileirar(uuid,uuid,int), private.chat_sessao_valida(uuid);
--   drop table public.chat_fila; e recriar private.pair_escopos_validos() sem 'chat:responder'.
