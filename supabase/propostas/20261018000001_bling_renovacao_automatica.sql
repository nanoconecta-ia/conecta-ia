-- PROPOSTA — NÃO APLICADA. Renovação automática do token do Bling (reserva + cron a cada 30 min).
-- Aplicar só com aprovação explícita; depois mover para supabase/migrations/.
-- Parte 1 (reserva e RPCs) é testada localmente em tests/bling_renovacao.sql.
-- Parte 2 (Vault + pg_cron + pg_net) só roda no Supabase: pg_cron e pg_net ainda não estão instaladas.

-- ===== PARTE 1: reserva e RPCs =====
alter table private.bling_credenciais
  add column renovando_ate timestamptz,
  add column renovando_por text;

-- Reserva atômica: só uma instância renova por vez (o refresh_token roda a cada renovação).
create function public.bling_reservar_renovacao(p_loja_id uuid, p_por text, p_ttl_s int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  update private.bling_credenciais
     set renovando_ate = now() + make_interval(secs => greatest(p_ttl_s, 1)), renovando_por = p_por
   where loja_id = p_loja_id and (renovando_ate is null or renovando_ate < now());
  get diagnostics v = row_count;
  return v = 1;
end $$;

create function public.bling_liberar_renovacao(p_loja_id uuid, p_por text)
returns void language sql security definer set search_path = '' as $$
  update private.bling_credenciais set renovando_ate = null, renovando_por = null
   where loja_id = p_loja_id and renovando_por = p_por;
$$;

-- Lojas conectadas cujo token vence dentro da janela e que não estão sendo renovadas.
create function public.bling_lojas_para_renovar(p_janela_min int)
returns table (loja_id uuid) language sql security definer set search_path = '' as $$
  select c.loja_id
    from private.bling_credenciais c
    join public.bling_conexoes k on k.loja_id = c.loja_id
   where k.status = 'conectada'
     and c.expira_em < now() + make_interval(mins => greatest(p_janela_min, 1))
     and (c.renovando_ate is null or c.renovando_ate < now());
$$;

-- Salvar credenciais passa a liberar a reserva (fim da renovação ou nova autorização).
create or replace function public.bling_salvar_credenciais(p_loja_id uuid, p_access text, p_refresh text, p_expira_em timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.bling_credenciais (loja_id, access_token_cifrado, refresh_token_cifrado, expira_em, atualizado_em)
  values (p_loja_id, p_access, p_refresh, p_expira_em, now())
  on conflict (loja_id) do update
    set access_token_cifrado = excluded.access_token_cifrado,
        refresh_token_cifrado = excluded.refresh_token_cifrado,
        expira_em = excluded.expira_em, atualizado_em = now(),
        renovando_ate = null, renovando_por = null;
  insert into public.bling_conexoes (loja_id, status, ultimo_erro, atualizado_em)
  values (p_loja_id, 'conectada', null, now())
  on conflict (loja_id) do update set status = 'conectada', ultimo_erro = null, atualizado_em = now();
end $$;

revoke all on function public.bling_reservar_renovacao(uuid, text, int) from public, anon, authenticated;
revoke all on function public.bling_liberar_renovacao(uuid, text) from public, anon, authenticated;
revoke all on function public.bling_lojas_para_renovar(int) from public, anon, authenticated;
grant execute on function public.bling_reservar_renovacao(uuid, text, int) to service_role;
grant execute on function public.bling_liberar_renovacao(uuid, text) to service_role;
grant execute on function public.bling_lojas_para_renovar(int) to service_role;

-- ===== PARTE 2: segredo do cron no Vault + agendamento (só no Supabase) =====
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Segredo gerado pelo próprio banco: nenhum humano nem IA o vê.
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'bling_cron_segredo',
                           'Segredo do cron bling-renovar')
 where not exists (select 1 from vault.decrypted_secrets where name = 'bling_cron_segredo');

create function public.bling_cron_segredo()
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'bling_cron_segredo';
$$;
revoke all on function public.bling_cron_segredo() from public, anon, authenticated;
grant execute on function public.bling_cron_segredo() to service_role;

select cron.schedule('bling-renovar', '*/30 * * * *', $cron$
  select net.http_post(
    url := 'https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-renovar',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-segredo', (select decrypted_secret from vault.decrypted_secrets where name = 'bling_cron_segredo')),
    body := '{}'::jsonb);
$cron$);

-- ===== ROLLBACK =====
-- select cron.unschedule('bling-renovar');
-- drop function public.bling_cron_segredo();
-- delete from vault.secrets where name = 'bling_cron_segredo';
-- drop function public.bling_lojas_para_renovar(int), public.bling_liberar_renovacao(uuid, text), public.bling_reservar_renovacao(uuid, text, int);
-- alter table private.bling_credenciais drop column renovando_ate, drop column renovando_por;
-- (restaurar bling_salvar_credenciais da migração 20261014000001)
