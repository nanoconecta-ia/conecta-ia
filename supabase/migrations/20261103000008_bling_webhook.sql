-- Webhook do Bling -> espelho (RASCUNHO, NÃO aplicada). Aditiva: nenhuma tabela nova, nenhuma coluna nova.
-- Reaproveita public.sync_eventos (origem 'webhook'), public.sync_erros e public.bling_conexoes.bling_company_id.
-- Só service_role executa. O Bling continua sendo apenas LIDO; aqui só se grava no banco do Conecta.IA.
-- Desenho: docs/conector-ia/DESENHO_WEBHOOK_BLING.md

-- 1) Vínculo conta do Bling -> loja. Nunca troca um vínculo existente por outro (retorna false).
create or replace function public.bling_registrar_company(p_loja uuid, p_company text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_atual text;
begin
  if p_company is null or p_company !~ '^[A-Za-z0-9]{8,64}$' then return false; end if;
  select bling_company_id into v_atual from public.bling_conexoes where loja_id = p_loja;
  if not found then return false; end if;
  if v_atual is not null and v_atual <> p_company then return false; end if;
  if v_atual = p_company then return true; end if;
  update public.bling_conexoes set bling_company_id = p_company, atualizado_em = now() where loja_id = p_loja;
  return true;
exception when unique_violation then return false; -- a conta já pertence a outra loja
end $$;

-- 2) Enfileira um evento do webhook. Idempotente por (loja, eventId): duplicata devolve false.
create or replace function public.bling_evento_enfileirar(p_loja uuid, p_tipo text, p_bling_id text, p_versao timestamptz, p_chave text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if p_tipo not in ('produto', 'estoque', 'inativacao') or p_bling_id !~ '^[0-9]{1,20}$' or length(coalesce(p_chave, '')) not between 8 and 64 then return false; end if;
  insert into public.sync_eventos (loja_id, origem, tipo, bling_id, versao_origem, chave_idempotencia, payload)
  values (p_loja, 'webhook', p_tipo, p_bling_id, p_versao, p_chave, p_payload)
  on conflict (loja_id, chave_idempotencia) do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

-- 3) Reserva eventos pendentes (skip locked). Um evento 'processando' há mais de 5 min volta à fila (processador morreu).
create or replace function public.bling_eventos_reservar(p_limite int default 10)
returns table (id uuid, loja_id uuid, tipo text, bling_id text, versao_origem timestamptz, tentativas int, payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with c as (
    select e.id from public.sync_eventos e
    where e.origem = 'webhook'
      and ((e.status = 'pendente' and e.proxima_tentativa_em <= now())
        or (e.status = 'processando' and e.proxima_tentativa_em <= now() - interval '5 minutes'))
    order by e.criado_em
    limit greatest(1, least(coalesce(p_limite, 10), 50))
    for update skip locked)
  update public.sync_eventos e set status = 'processando', proxima_tentativa_em = now()
  from c where e.id = c.id
  returning e.id, e.loja_id, e.tipo, e.bling_id, e.versao_origem, e.tentativas, e.payload;
end $$;

-- 4) Conclui um evento: aplicado/ignorado; erro com nova tentativa (p_proxima) ou erro definitivo (p_proxima nulo).
create or replace function public.bling_evento_concluir(p_id uuid, p_status text, p_motivo text default null, p_proxima timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_loja uuid;
begin
  if p_status in ('aplicado', 'ignorado') then
    update public.sync_eventos set status = p_status::public.status_sync, processado_em = now() where id = p_id;
  elsif p_status = 'erro' and p_proxima is not null then
    update public.sync_eventos set status = 'pendente', tentativas = tentativas + 1, proxima_tentativa_em = p_proxima where id = p_id;
  elsif p_status = 'erro' then
    update public.sync_eventos set status = 'erro', tentativas = tentativas + 1, processado_em = now() where id = p_id returning loja_id into v_loja;
    if v_loja is not null then
      insert into public.sync_erros (loja_id, evento_id, mensagem) values (v_loja, p_id, left(coalesce(p_motivo, 'evento do webhook não aplicado'), 300));
    end if;
  else
    raise exception 'status inválido';
  end if;
end $$;

revoke all on function public.bling_registrar_company(uuid, text) from public, anon, authenticated;
revoke all on function public.bling_evento_enfileirar(uuid, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function public.bling_eventos_reservar(int) from public, anon, authenticated;
revoke all on function public.bling_evento_concluir(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.bling_registrar_company(uuid, text) to service_role;
grant execute on function public.bling_evento_enfileirar(uuid, text, text, timestamptz, text, jsonb) to service_role;
grant execute on function public.bling_eventos_reservar(int) to service_role;
grant execute on function public.bling_evento_concluir(uuid, text, text, timestamptz) to service_role;

-- 5) Rede de segurança do processador (a função também processa logo após receber o evento). Só se pg_cron existir.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('bling-webhook-fila', '* * * * *', $job$
      select net.http_post(
        url := 'https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-webhook',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-segredo', (select decrypted_secret from vault.decrypted_secrets where name = 'bling_cron_segredo')),
        body := '{}'::jsonb, timeout_milliseconds := 55000);
    $job$);
  end if;
end $$;
-- Reversão: select cron.unschedule('bling-webhook-fila'); drop function public.bling_evento_concluir(uuid,text,text,timestamptz),
--   public.bling_eventos_reservar(int), public.bling_evento_enfileirar(uuid,text,text,timestamptz,text,jsonb), public.bling_registrar_company(uuid,text);
