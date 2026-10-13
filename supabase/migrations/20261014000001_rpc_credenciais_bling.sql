-- RPCs para o servidor ler/gravar credenciais do Bling (schema private não é exposto pela API).
-- Executáveis SOMENTE por service_role. Os valores já chegam cifrados (AES-256-GCM) do servidor.

create or replace function public.bling_salvar_credenciais(p_loja_id uuid, p_access text, p_refresh text, p_expira_em timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.bling_credenciais (loja_id, access_token_cifrado, refresh_token_cifrado, expira_em, atualizado_em)
  values (p_loja_id, p_access, p_refresh, p_expira_em, now())
  on conflict (loja_id) do update
    set access_token_cifrado = excluded.access_token_cifrado,
        refresh_token_cifrado = excluded.refresh_token_cifrado,
        expira_em = excluded.expira_em, atualizado_em = now();
  insert into public.bling_conexoes (loja_id, status, ultimo_erro, atualizado_em)
  values (p_loja_id, 'conectada', null, now())
  on conflict (loja_id) do update set status = 'conectada', ultimo_erro = null, atualizado_em = now();
end $$;

create or replace function public.bling_ler_credenciais(p_loja_id uuid)
returns table (access_token_cifrado text, refresh_token_cifrado text, expira_em timestamptz)
language sql security definer set search_path = '' as $$
  select c.access_token_cifrado, c.refresh_token_cifrado, c.expira_em
  from private.bling_credenciais c where c.loja_id = p_loja_id;
$$;

create or replace function public.bling_marcar_status(p_loja_id uuid, p_status public.status_conexao, p_erro text)
returns void language sql security definer set search_path = '' as $$
  update public.bling_conexoes set status = p_status, ultimo_erro = p_erro, atualizado_em = now() where loja_id = p_loja_id;
$$;

revoke all on function public.bling_salvar_credenciais(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.bling_ler_credenciais(uuid) from public, anon, authenticated;
revoke all on function public.bling_marcar_status(uuid, public.status_conexao, text) from public, anon, authenticated;
grant execute on function public.bling_salvar_credenciais(uuid, text, text, timestamptz) to service_role;
grant execute on function public.bling_ler_credenciais(uuid) to service_role;
grant execute on function public.bling_marcar_status(uuid, public.status_conexao, text) to service_role;
