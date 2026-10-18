-- Fase 1 — PROPOSTA v2 (NÃO APLICADA; fora de supabase/migrations de propósito).
-- Revisada após as decisões D1–D5 do proprietário:
--   * só DUAS tabelas novas (conversas, mensagens); o registro do turno vive na mensagem do assistente
--     (a tabela agente_tarefas da v1 foi descartada — ver ARQUITETURA.md §3);
--   * retenção de conversas própria (padrão 180 dias, configurável por loja) separada da auditoria;
--   * cada usuário só vê as suas conversas; leitura de conversa alheia SÓ pela função administrativa,
--     com recurso explícito ligado, motivo e trilha em auditoria;
--   * exclusão controlada (LGPD) pelo titular; auditoria guarda só metadados, nunca o conteúdo.
-- Reversão: 20261020000001_fase1_conversas.rollback.sql
begin;

-- Configuração existente (sem tabela nova): retenção por loja.
alter table public.lojas add column chat_retencao_dias int not null default 180 check (chat_retencao_dias between 7 and 730);

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null,
  titulo text not null default 'Nova conversa' check (char_length(titulo) between 1 and 120),
  provedor_preferido text check (provedor_preferido in ('claude', 'gemini', 'compativel_openai')),
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  expira_em timestamptz not null,                    -- criada_em + lojas.chat_retencao_dias; renovada a cada mensagem
  unique (id, loja_id)                               -- alvo da chave composta: o banco impede cruzar lojas
);
create index conversas_usuario_idx on public.conversas (loja_id, user_id, atualizada_em desc);
create index conversas_expira_idx on public.conversas (expira_em);

-- Uma linha por mensagem. A linha do ASSISTENTE é também o registro do turno (provedor, modelo, prova de chamada, ferramentas).
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  conversa_id uuid not null,
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null check (char_length(conteudo) between 1 and 8000),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 8 and 120),   -- só em 'usuario'
  em_resposta_a uuid references public.mensagens(id) on delete cascade,                                     -- só em 'assistente'
  desfecho text check (desfecho in ('ok', 'aguarda_aprovacao', 'falhou')),                                  -- só em 'assistente'
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo) <= 60),                           -- nunca o corpo de erro do provedor
  provedor text check (provedor in ('claude', 'gemini', 'compativel_openai')),
  modelo text,
  resposta_id_provedor text,                         -- id devolvido pelo provedor: prova de chamada real
  simulado boolean not null default false,           -- true SOMENTE quando um fake de teste respondeu
  tokens int check (tokens is null or tokens >= 0),
  passos int check (passos is null or passos >= 0),
  chamadas jsonb not null default '[]' check (jsonb_typeof(chamadas) = 'array'),    -- ferramenta, origem, status, ms, hash da resposta (sem corpo, sem token)
  evidencias jsonb not null default '[]' check (jsonb_typeof(evidencias) = 'array'), -- cartões mostrados no chat
  criada_em timestamptz not null default now(),
  foreign key (conversa_id, loja_id) references public.conversas (id, loja_id) on delete cascade,
  check ((papel = 'usuario' and idempotency_key is not null and em_resposta_a is null and desfecho is null)
      or (papel = 'assistente' and idempotency_key is null and em_resposta_a is not null and desfecho is not null))
);
create index mensagens_conversa_idx on public.mensagens (conversa_id, criada_em);
create unique index mensagens_idem_uq on public.mensagens (loja_id, idempotency_key) where papel = 'usuario';
create unique index mensagens_uma_resposta_uq on public.mensagens (em_resposta_a) where em_resposta_a is not null;

-- Mensagens são append-only (a remoção só acontece por exclusão/expurgo controlados, via funções abaixo).
create function private.mensagens_imutaveis() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'mensagens são imutáveis' using errcode = '42501'; end $$;
create trigger mensagens_sem_update before update on public.mensagens
  for each row execute function private.mensagens_imutaveis();

-- ---------------------------------------------------------------------------------------------------------------
-- RLS: cada usuário vê SÓ as suas conversas (inclusive o lojista). Nenhuma escrita direta.
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
create policy conversas_donas on public.conversas for select to authenticated
  using (user_id = (select auth.uid()) and private.pode_ver_loja(loja_id));
create policy mensagens_donas on public.mensagens for select to authenticated
  using (conversa_id in (select id from public.conversas));
revoke all on public.conversas, public.mensagens from public, anon, authenticated;
grant select on public.conversas, public.mensagens to authenticated;
grant all on public.conversas, public.mensagens to service_role;

-- Recursos por loja (tabelas existentes), todos desligados por padrão.
insert into public.recursos_plataforma (codigo, grupo, nome, descricao, disponivel, ativo_padrao) values
  ('chat_persistente', 'assistente', 'Chat com histórico', 'Guarda as conversas do assistente e o registro de cada resposta.', true, false),
  ('chat_consulta_bling', 'assistente', 'Consulta ao Bling no chat', 'O assistente consulta um produto no Bling na hora (somente leitura).', true, false),
  ('chat_leitura_administrativa', 'assistente', 'Leitura administrativa de conversas', 'Permite ao lojista consultar conversas de outros usuários da loja, com motivo e registro em auditoria.', true, false)
on conflict (codigo) do nothing;

create function private.recurso_ativo(p_loja uuid, p_recurso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select lr.ativo from public.loja_recursos lr where lr.loja_id = p_loja and lr.recurso = p_recurso),
                  (select rp.ativo_padrao from public.recursos_plataforma rp where rp.codigo = p_recurso), false);
$$;
revoke all on function private.recurso_ativo(uuid, text) from public, anon, authenticated;
grant execute on function private.recurso_ativo(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Operações do servidor (service_role). A função assistente já autenticou o usuário; aqui confere-se o vínculo.
-- Devolve a resposta já gravada quando a MESMA chave de idempotência é reenviada (evita pagar o provedor duas vezes).
create function public.chat_iniciar(p_loja uuid, p_user uuid, p_conversa uuid, p_texto text, p_idem text, p_provedor text)
returns table (conversa_id uuid, mensagem_id uuid, reutilizada boolean, resposta_id uuid, resposta text, desfecho text)
language plpgsql security definer set search_path = '' as $$
declare v_conv uuid := p_conversa; v_m uuid; v_c0 uuid; v_dias int; v_r record;
begin
  if not exists (select 1 from public.usuarios_loja where loja_id = p_loja and user_id = p_user) then
    raise exception 'sem vínculo com a loja' using errcode = '42501';
  end if;
  if not private.recurso_ativo(p_loja, 'chat_persistente') then
    raise exception 'chat persistente desligado nesta loja' using errcode = '55000';
  end if;
  select m.id, m.conversa_id into v_m, v_c0 from public.mensagens m
   where m.loja_id = p_loja and m.papel = 'usuario' and m.idempotency_key = p_idem
     and exists (select 1 from public.conversas c where c.id = m.conversa_id and c.user_id = p_user);
  if found then
    select a.id, a.conteudo, a.desfecho into v_r from public.mensagens a where a.em_resposta_a = v_m;
    return query select v_c0, v_m, true, v_r.id, v_r.conteudo, v_r.desfecho; return;
  end if;
  select chat_retencao_dias into v_dias from public.lojas where id = p_loja;
  if v_conv is null then
    insert into public.conversas (loja_id, user_id, titulo, provedor_preferido, expira_em)
    values (p_loja, p_user, left(regexp_replace(p_texto, '\s+', ' ', 'g'), 60), p_provedor, now() + make_interval(days => v_dias)) returning id into v_conv;
  elsif not exists (select 1 from public.conversas c where c.id = v_conv and c.loja_id = p_loja and c.user_id = p_user and c.expira_em > now()) then
    raise exception 'conversa inexistente' using errcode = 'P0002';
  end if;
  insert into public.mensagens (loja_id, conversa_id, papel, conteudo, idempotency_key)
  values (p_loja, v_conv, 'usuario', p_texto, p_idem) returning id into v_m;
  update public.conversas set atualizada_em = now(), expira_em = now() + make_interval(days => v_dias),
         provedor_preferido = coalesce(p_provedor, provedor_preferido) where id = v_conv;
  return query select v_conv, v_m, false, null::uuid, null::text, null::text;
end $$;

create function public.chat_responder(p_pergunta uuid, p_resposta text, p_desfecho text, p_provedor text, p_modelo text, p_tokens int, p_passos int,
  p_chamadas jsonb, p_evidencias jsonb, p_resposta_id text, p_simulado boolean, p_erro text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_q public.mensagens; v_id uuid;
begin
  select * into v_q from public.mensagens where id = p_pergunta and papel = 'usuario';
  if not found then raise exception 'pergunta inexistente' using errcode = 'P0002'; end if;
  insert into public.mensagens (loja_id, conversa_id, papel, conteudo, em_resposta_a, desfecho, erro_codigo, provedor, modelo, resposta_id_provedor,
                                simulado, tokens, passos, chamadas, evidencias)
  values (v_q.loja_id, v_q.conversa_id, 'assistente', left(p_resposta, 8000), p_pergunta, p_desfecho, left(p_erro, 60), p_provedor, p_modelo, p_resposta_id,
          coalesce(p_simulado, false), p_tokens, p_passos, coalesce(p_chamadas, '[]'), coalesce(p_evidencias, '[]'))
  returning id into v_id;                                  -- índice único: uma só resposta por pergunta
  return v_id;
end $$;

-- Exclusão controlada (LGPD): o titular apaga a PRÓPRIA conversa. Auditoria guarda só metadados.
create function public.chat_excluir(p_conversa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_c public.conversas; v_n int;
begin
  select * into v_c from public.conversas where id = p_conversa;
  if not found or v_c.user_id <> (select auth.uid()) then return false; end if;
  select count(*) into v_n from public.mensagens where conversa_id = p_conversa;
  delete from public.conversas where id = p_conversa;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois)
  values (v_c.loja_id, v_c.user_id, 'conversa.excluida', 'conversas', jsonb_build_object('conversa_id', p_conversa, 'mensagens', v_n, 'por', 'titular'));
  return true;
end $$;

-- Expurgo por prazo (rotina futura, só service_role). Auditoria registra contagens, nunca conteúdo.
create function public.chat_expurgar() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  with apagadas as (delete from public.conversas where expira_em <= now() returning loja_id, id)
  select count(*) into v_n from apagadas;
  if v_n > 0 then
    insert into public.auditoria (acao, tabela, depois) values ('conversa.expurgo_prazo', 'conversas', jsonb_build_object('conversas', v_n));
  end if;
  return v_n;
end $$;

-- Retenção por loja: quem administra a loja ajusta (7 a 730 dias); a mudança é auditada.
create function public.chat_definir_retencao(p_loja uuid, p_dias int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_antes int;
begin
  if not private.administra_loja(p_loja, (select auth.uid())) or p_dias not between 7 and 730 then return false; end if;
  select chat_retencao_dias into v_antes from public.lojas where id = p_loja;
  update public.lojas set chat_retencao_dias = p_dias where id = p_loja;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p_loja, (select auth.uid()), 'chat.retencao_alterada', 'lojas', jsonb_build_object('dias', v_antes), jsonb_build_object('dias', p_dias));
  return true;
end $$;

-- Leitura administrativa de conversa ALHEIA da mesma loja (D3): recurso ligado + quem administra + motivo + trilha.
create function public.chat_ler_como_administrador(p_conversa uuid, p_motivo text)
returns table (mensagem_id uuid, papel text, conteudo text, criada_em timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_c public.conversas; v_n int;
begin
  select * into v_c from public.conversas where id = p_conversa;
  if not found
     or not private.administra_loja(v_c.loja_id, (select auth.uid()))
     or not private.recurso_ativo(v_c.loja_id, 'chat_leitura_administrativa')
     or char_length(btrim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'leitura administrativa não permitida' using errcode = '42501';
  end if;
  select count(*) into v_n from public.mensagens where conversa_id = p_conversa;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois)
  values (v_c.loja_id, (select auth.uid()), 'conversa.leitura_administrativa', 'conversas',
          jsonb_build_object('conversa_id', p_conversa, 'dono', v_c.user_id, 'motivo', left(btrim(p_motivo), 300), 'mensagens', v_n));
  return query select m.id, m.papel, m.conteudo, m.criada_em from public.mensagens m where m.conversa_id = p_conversa order by m.criada_em;
end $$;

revoke all on function public.chat_iniciar(uuid, uuid, uuid, text, text, text),
  public.chat_responder(uuid, text, text, text, text, int, int, jsonb, jsonb, text, boolean, text),
  public.chat_excluir(uuid), public.chat_expurgar(), public.chat_definir_retencao(uuid, int),
  public.chat_ler_como_administrador(uuid, text) from public, anon, authenticated;
grant execute on function public.chat_iniciar(uuid, uuid, uuid, text, text, text),
  public.chat_responder(uuid, text, text, text, text, int, int, jsonb, jsonb, text, boolean, text), public.chat_expurgar() to service_role;
grant execute on function public.chat_excluir(uuid), public.chat_definir_retencao(uuid, int),
  public.chat_ler_como_administrador(uuid, text) to authenticated, service_role;

commit;
