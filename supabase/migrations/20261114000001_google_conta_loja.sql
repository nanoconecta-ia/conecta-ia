-- PROPOSTA (docs/ordem-mestra/16): conta Google do lojista (Drive) por loja. NÃO APLICADA.
-- Mesmo padrão do Bling: tokens cifrados em private.*, state de uso único, só service_role mexe em segredo,
-- leitura de status (sem segredo) para quem vê a loja. Escopo inicial: Drive com acesso mínimo (drive.file).
-- Reversão: bloco ROLLBACK no fim.

-- 1) Credenciais (segredo). Nada aqui vai ao navegador.
create table private.google_credenciais (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  google_sub text not null,
  email text not null check (length(email) between 3 and 320),
  escopos text[] not null,
  access_token_cifrado text not null,
  refresh_token_cifrado text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now()
);
alter table private.google_credenciais enable row level security;
grant select, insert, update, delete on private.google_credenciais to service_role;

-- 2) Status público da conexão (sem token).
create table public.google_conexoes (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'conectada', 'revogada', 'erro')),
  email text,
  escopos text[] not null default '{}',
  ultimo_erro text,
  atualizado_em timestamptz not null default now()
);
alter table public.google_conexoes enable row level security;
create policy google_conexoes_ver on public.google_conexoes for select to authenticated using (private.pode_ver_loja(loja_id));
grant select on public.google_conexoes to authenticated;

-- 3) State do OAuth de uso único (nonce ligado a loja e usuário).
create table private.google_oauth_estados (
  nonce uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null,
  expira_em timestamptz not null,
  usado_em timestamptz
);
alter table private.google_oauth_estados enable row level security;
grant select, insert, update, delete on private.google_oauth_estados to service_role;

create function public.google_estado_criar(p_loja_id uuid, p_user_id uuid, p_ttl_s int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  insert into private.google_oauth_estados (loja_id, user_id, expira_em)
  values (p_loja_id, p_user_id, now() + make_interval(secs => least(greatest(p_ttl_s, 30), 900))) returning nonce into v;
  return v;
end $$;

create function public.google_estado_consumir(p_nonce uuid)
returns table (loja_id uuid, user_id uuid)
language sql security definer set search_path = '' as $$
  update private.google_oauth_estados set usado_em = now()
   where nonce = p_nonce and usado_em is null and expira_em > now()
  returning loja_id, user_id;
$$;

-- 4) Salvar a conta (credencial + status + auditoria numa transação). Não grava token em auditoria.
create function public.google_salvar_conta(
  p_loja_id uuid, p_user_id uuid, p_sub text, p_email text, p_escopos text[],
  p_access text, p_refresh text, p_expira_em timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.google_credenciais (loja_id, google_sub, email, escopos, access_token_cifrado, refresh_token_cifrado, expira_em, atualizado_em)
  values (p_loja_id, p_sub, p_email, p_escopos, p_access, p_refresh, p_expira_em, now())
  on conflict (loja_id) do update
    set google_sub = excluded.google_sub, email = excluded.email, escopos = excluded.escopos,
        access_token_cifrado = excluded.access_token_cifrado, refresh_token_cifrado = excluded.refresh_token_cifrado,
        expira_em = excluded.expira_em, atualizado_em = now();
  insert into public.google_conexoes (loja_id, status, email, escopos, ultimo_erro, atualizado_em)
  values (p_loja_id, 'conectada', p_email, p_escopos, null, now())
  on conflict (loja_id) do update
    set status = 'conectada', email = excluded.email, escopos = excluded.escopos, ultimo_erro = null, atualizado_em = now();
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p_loja_id, p_user_id, 'google_conectar', 'google_conexoes', null,
          jsonb_build_object('email', p_email, 'escopos', to_jsonb(p_escopos)));
end $$;

create function public.google_ler_credenciais(p_loja_id uuid)
returns table (email text, escopos text[], access_token_cifrado text, refresh_token_cifrado text, expira_em timestamptz)
language sql security definer set search_path = '' as $$
  select c.email, c.escopos, c.access_token_cifrado, c.refresh_token_cifrado, c.expira_em
    from private.google_credenciais c where c.loja_id = p_loja_id;
$$;

-- Renovação do access token (só o access e a validade mudam).
create function public.google_atualizar_access(p_loja_id uuid, p_access text, p_expira_em timestamptz) returns void
language sql security definer set search_path = '' as $$
  update private.google_credenciais set access_token_cifrado = p_access, expira_em = p_expira_em, atualizado_em = now()
   where loja_id = p_loja_id;
$$;

-- Desconectar: apaga os tokens; o status fica como revogada (a revogação no Google é feita pela função, antes).
create function public.google_desconectar(p_loja_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.google_credenciais where loja_id = p_loja_id;
  insert into public.google_conexoes (loja_id, status, email, escopos, ultimo_erro, atualizado_em)
  values (p_loja_id, 'revogada', null, '{}', null, now())
  on conflict (loja_id) do update set status = 'revogada', email = null, escopos = '{}', ultimo_erro = null, atualizado_em = now();
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (p_loja_id, p_user_id, 'google_desconectar', 'google_conexoes', null, null);
end $$;

create function public.google_marcar_erro(p_loja_id uuid, p_erro text) returns void
language sql security definer set search_path = '' as $$
  update public.google_conexoes set status = 'erro', ultimo_erro = left(p_erro, 200), atualizado_em = now() where loja_id = p_loja_id;
$$;

-- 5) Permissões: só o servidor (service_role) executa. Reaproveita bling_usuario_administra / pode_administrar_loja.
revoke all on function public.google_estado_criar(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.google_estado_consumir(uuid) from public, anon, authenticated;
revoke all on function public.google_salvar_conta(uuid, uuid, text, text, text[], text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.google_ler_credenciais(uuid) from public, anon, authenticated;
revoke all on function public.google_atualizar_access(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.google_desconectar(uuid, uuid) from public, anon, authenticated;
revoke all on function public.google_marcar_erro(uuid, text) from public, anon, authenticated;
grant execute on function public.google_estado_criar(uuid, uuid, int) to service_role;
grant execute on function public.google_estado_consumir(uuid) to service_role;
grant execute on function public.google_salvar_conta(uuid, uuid, text, text, text[], text, text, timestamptz) to service_role;
grant execute on function public.google_ler_credenciais(uuid) to service_role;
grant execute on function public.google_atualizar_access(uuid, text, timestamptz) to service_role;
grant execute on function public.google_desconectar(uuid, uuid) to service_role;
grant execute on function public.google_marcar_erro(uuid, text) to service_role;

-- ROLLBACK (antes da primeira conexão; depois, só com o lojista ciente de que perde o vínculo):
-- drop function public.google_marcar_erro(uuid,text), public.google_desconectar(uuid,uuid), public.google_atualizar_access(uuid,text,timestamptz),
--   public.google_ler_credenciais(uuid), public.google_salvar_conta(uuid,uuid,text,text,text[],text,text,timestamptz),
--   public.google_estado_consumir(uuid), public.google_estado_criar(uuid,uuid,int);
-- drop table private.google_oauth_estados, public.google_conexoes, private.google_credenciais;
