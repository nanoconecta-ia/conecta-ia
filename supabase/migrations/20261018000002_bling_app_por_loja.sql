-- Migração 21: o app (Client ID/Secret) do Bling passa a ser POR LOJA (SaaS). O lojista cola as duas chaves no painel;
-- o servidor guarda o secret cifrado (AES-256-GCM) e usa na conexão e na renovação. Nunca volta ao navegador.
create table private.bling_apps (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  client_id text not null check (length(btrim(client_id)) between 8 and 200),
  client_secret_cifrado text not null,
  atualizado_em timestamptz not null default now()
);
alter table private.bling_apps enable row level security;
grant select, insert, update, delete on private.bling_apps to service_role;

-- Trocar de app invalida os tokens antigos (pertencem ao app anterior): volta a "pendente" até reautorizar.
create function public.bling_salvar_app(p_loja_id uuid, p_client_id text, p_secret_cifrado text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.bling_apps (loja_id, client_id, client_secret_cifrado, atualizado_em)
  values (p_loja_id, btrim(p_client_id), p_secret_cifrado, now())
  on conflict (loja_id) do update
    set client_id = excluded.client_id, client_secret_cifrado = excluded.client_secret_cifrado, atualizado_em = now();
  delete from private.bling_credenciais where loja_id = p_loja_id;
  insert into public.bling_conexoes (loja_id, status, ultimo_erro, atualizado_em)
  values (p_loja_id, 'pendente', null, now())
  on conflict (loja_id) do update set status = 'pendente', ultimo_erro = null, atualizado_em = now();
end $$;

create function public.bling_ler_app(p_loja_id uuid)
returns table (client_id text, client_secret_cifrado text)
language sql security definer set search_path = '' as $$
  select a.client_id, a.client_secret_cifrado from private.bling_apps a where a.loja_id = p_loja_id;
$$;

-- O painel só precisa saber SE existe (nunca o valor). Respeita o acesso à loja.
create function public.bling_app_configurado(p_loja_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pode_ver_loja(p_loja_id) and exists (select 1 from private.bling_apps a where a.loja_id = p_loja_id);
$$;

revoke all on function public.bling_salvar_app(uuid, text, text) from public, anon, authenticated;
revoke all on function public.bling_ler_app(uuid) from public, anon, authenticated;
revoke all on function public.bling_app_configurado(uuid) from public, anon;
grant execute on function public.bling_salvar_app(uuid, text, text) to service_role;
grant execute on function public.bling_ler_app(uuid) to service_role;
grant execute on function public.bling_app_configurado(uuid) to authenticated, service_role;
