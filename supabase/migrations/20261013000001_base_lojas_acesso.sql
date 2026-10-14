-- Conecta.IA — Fase 1: lojas, domínios, acesso e funções de apoio.
-- Projeto Supabase: conecta-ia (ref dsfzhsrudriqkumtlqwj). NÃO aplicar em outro projeto.

-- Schema privado: não exposto pela API. Guarda segredos cifrados e funções internas.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.modo_venda as enum ('checkout', 'whatsapp', 'hibrido');
create type public.papel_loja as enum ('lojista', 'editor');

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,63}$'),
  modo_venda public.modo_venda not null default 'whatsapp',
  whatsapp text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.loja_dominios (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  dominio text not null check (dominio = lower(dominio)),
  dns_verificado_em timestamptz,
  ssl_verificado_em timestamptz,
  principal boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (dominio)
);
create index on public.loja_dominios (loja_id);
-- Um domínio só vale em produção com DNS e SSL verificados (regra do CLAUDE.md).
create view public.dominios_ativos as
  select loja_id, dominio, principal
  from public.loja_dominios
  where dns_verificado_em is not null and ssl_verificado_em is not null;

create table public.usuarios_loja (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null,
  papel public.papel_loja not null default 'lojista',
  criado_em timestamptz not null default now(),
  primary key (loja_id, user_id)
);
create index on public.usuarios_loja (user_id);

-- Super admin: claim em app_metadata (não editável pelo usuário) E sessão com MFA (aal2).
create function private.eh_super_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'papel', '') = 'super_admin'
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create function private.minhas_lojas() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select loja_id from public.usuarios_loja where user_id = auth.uid();
$$;

create function private.pode_ver_loja(p_loja uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.eh_super_admin() or p_loja in (select private.minhas_lojas());
$$;

grant usage on schema private to authenticated, service_role;
grant execute on function private.eh_super_admin(), private.minhas_lojas(), private.pode_ver_loja(uuid) to authenticated;

alter table public.lojas enable row level security;
alter table public.loja_dominios enable row level security;
alter table public.usuarios_loja enable row level security;

create policy lojas_ver on public.lojas for select to authenticated
  using (private.pode_ver_loja(id));
create policy lojas_super_admin_escreve on public.lojas for all to authenticated
  using (private.eh_super_admin()) with check (private.eh_super_admin());

create policy dominios_ver on public.loja_dominios for select to authenticated
  using (private.pode_ver_loja(loja_id));
create policy dominios_super_admin_escreve on public.loja_dominios for all to authenticated
  using (private.eh_super_admin()) with check (private.eh_super_admin());

create policy usuarios_ver on public.usuarios_loja for select to authenticated
  using (user_id = auth.uid() or private.eh_super_admin());
create policy usuarios_super_admin_escreve on public.usuarios_loja for all to authenticated
  using (private.eh_super_admin()) with check (private.eh_super_admin());

grant select on public.lojas, public.loja_dominios, public.usuarios_loja to authenticated;
grant insert, update, delete on public.lojas, public.loja_dominios, public.usuarios_loja to authenticated; -- limitado pelas policies
grant select on public.dominios_ativos to service_role;
