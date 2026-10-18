-- Sincronização do espelho do Bling a cada 15 min (somente leitura). Mesmo segredo de cron da renovação (Vault).
select cron.schedule('bling-sync', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-segredo', (select decrypted_secret from vault.decrypted_secrets where name = 'bling_cron_segredo')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000);
$job$);
