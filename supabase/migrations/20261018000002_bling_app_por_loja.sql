-- Migração 21 (REVISADA — NÃO APLICADA): app do Bling por loja, com os achados da revisão corrigidos.
-- Reversão: ver docs/BLING_RECUPERACAO_E_REVERSAO.md (bloco ROLLBACK no fim deste arquivo).

-- 1) Quem pode administrar a integração: papel 'lojista' da loja ou super_admin com MFA (aal2). 'editor' NÃO.
create function private.administra_loja(p_loja uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios_loja u where u.loja_id = p_loja and u.user_id = p_user and u.papel = 'lojista');
$$;
-- Para o usuário logado (usa o JWT): lojista da loja, ou super_admin aal2.
create function public.pode_administrar_loja(p_loja_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.eh_super_admin() or private.administra_loja(p_loja_id, auth.uid());
$$;
-- Para o servidor reconferir no callback (sem JWT): só service_role.
create function public.bling_usuario_administra(p_loja_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.administra_loja(p_loja_id, p_user_id);
$$;

-- 2) App da loja. CNPJ esperado da conta Bling é obrigatório; chave de cifra identificada (rotação).
create table private.bling_apps (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  origem text not null default 'loja' check (origem in ('loja', 'central')),  -- 'central' reservado ao app SaaS (não implementado)
  client_id text not null check (length(btrim(client_id)) between 8 and 200),
  client_secret_cifrado text not null,
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  atualizado_em timestamptz not null default now()
);
alter table private.bling_apps enable row level security;
grant select, insert, update, delete on private.bling_apps to service_role;

-- Só apaga os tokens se o Client ID mudou (os tokens pertencem ao app); mudar só o secret preserva a conexão.
create function public.bling_salvar_app(p_loja_id uuid, p_client_id text, p_secret_cifrado text, p_cnpj text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_antigo text;
begin
  select client_id into v_antigo from private.bling_apps where loja_id = p_loja_id;
  insert into private.bling_apps (loja_id, client_id, client_secret_cifrado, cnpj, atualizado_em)
  values (p_loja_id, btrim(p_client_id), p_secret_cifrado, p_cnpj, now())
  on conflict (loja_id) do update
    set client_id = excluded.client_id, client_secret_cifrado = excluded.client_secret_cifrado, cnpj = excluded.cnpj, atualizado_em = now();
  if v_antigo is distinct from btrim(p_client_id) then
    delete from private.bling_credenciais where loja_id = p_loja_id;
    insert into public.bling_conexoes (loja_id, status, ultimo_erro, atualizado_em)
    values (p_loja_id, 'pendente', null, now())
    on conflict (loja_id) do update set status = 'pendente', ultimo_erro = null, atualizado_em = now();
  end if;
end $$;

create function public.bling_ler_app(p_loja_id uuid)
returns table (client_id text, client_secret_cifrado text, cnpj text)
language sql security definer set search_path = '' as $$
  select a.client_id, a.client_secret_cifrado, a.cnpj from private.bling_apps a where a.loja_id = p_loja_id;
$$;

create function public.bling_app_configurado(p_loja_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.pode_ver_loja(p_loja_id) and exists (select 1 from private.bling_apps a where a.loja_id = p_loja_id);
$$;

-- 3) State do OAuth de USO ÚNICO: nonce vinculado a loja e usuário, consumo atômico, expira.
create table private.bling_oauth_estados (
  nonce uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null,
  expira_em timestamptz not null,
  usado_em timestamptz
);
alter table private.bling_oauth_estados enable row level security;
grant select, insert, update, delete on private.bling_oauth_estados to service_role;

create function public.bling_estado_criar(p_loja_id uuid, p_user_id uuid, p_ttl_s int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  delete from private.bling_oauth_estados where expira_em < now() - interval '1 day';
  insert into private.bling_oauth_estados (loja_id, user_id, expira_em)
  values (p_loja_id, p_user_id, now() + make_interval(secs => least(greatest(p_ttl_s, 30), 900))) returning nonce into v;
  return v;
end $$;

create function public.bling_estado_consumir(p_nonce uuid)
returns table (loja_id uuid, user_id uuid)
language sql security definer set search_path = '' as $$
  update private.bling_oauth_estados set usado_em = now()
   where nonce = p_nonce and usado_em is null and expira_em > now()
  returning loja_id, user_id;
$$;

-- 4) Limite de tentativas (janela fixa) para operações sensíveis.
create table private.limite_chamadas (
  chave text not null, janela timestamptz not null, n int not null default 0, primary key (chave, janela)
);
alter table private.limite_chamadas enable row level security;
grant select, insert, update, delete on private.limite_chamadas to service_role;

create function public.limite_chamada(p_chave text, p_max int, p_janela_s int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_janela timestamptz; v_n int;
begin
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_s) * p_janela_s);
  insert into private.limite_chamadas (chave, janela, n) values (p_chave, v_janela, 1)
  on conflict (chave, janela) do update set n = private.limite_chamadas.n + 1 returning n into v_n;
  delete from private.limite_chamadas where janela < now() - interval '1 day';
  return v_n <= p_max;
end $$;

-- 5) Permissões
revoke all on function public.bling_salvar_app(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.bling_ler_app(uuid) from public, anon, authenticated;
revoke all on function public.bling_usuario_administra(uuid, uuid) from public, anon, authenticated;
revoke all on function public.bling_estado_criar(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.bling_estado_consumir(uuid) from public, anon, authenticated;
revoke all on function public.limite_chamada(text, int, int) from public, anon, authenticated;
revoke all on function public.bling_app_configurado(uuid) from public, anon;
revoke all on function public.pode_administrar_loja(uuid) from public, anon;
grant execute on function public.bling_salvar_app(uuid, text, text, text) to service_role;
grant execute on function public.bling_ler_app(uuid) to service_role;
grant execute on function public.bling_usuario_administra(uuid, uuid) to service_role;
grant execute on function public.bling_estado_criar(uuid, uuid, int) to service_role;
grant execute on function public.bling_estado_consumir(uuid) to service_role;
grant execute on function public.limite_chamada(text, int, int) to service_role;
grant execute on function public.bling_app_configurado(uuid) to authenticated, service_role;
grant execute on function public.pode_administrar_loja(uuid) to authenticated, service_role;

-- ROLLBACK (sem dados de produção na tabela até a primeira conexão; conferir antes):
-- drop function public.limite_chamada(text,int,int), public.bling_estado_consumir(uuid), public.bling_estado_criar(uuid,uuid,int),
--   public.bling_app_configurado(uuid), public.bling_ler_app(uuid), public.bling_salvar_app(uuid,text,text,text),
--   public.bling_usuario_administra(uuid,uuid), public.pode_administrar_loja(uuid), private.administra_loja(uuid,uuid);
-- drop table private.limite_chamadas, private.bling_oauth_estados, private.bling_apps;
-- e republicar as versões anteriores das funções (bling-conectar/bling-callback v2, bling-renovar v1).
