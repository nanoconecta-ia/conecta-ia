-- Controle de venda em dois níveis + auditoria imutável.
-- Permissão efetiva = o que o super admin permite ∩ o que o lojista escolheu.

create table public.restricoes_plataforma_uf (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,  -- null = vale para todas as lojas
  uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
  bloqueada boolean not null default true,
  motivo text,
  criado_em timestamptz not null default now()
);
create unique index restricoes_plataforma_unica on public.restricoes_plataforma_uf
  (coalesce(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), uf);

create table public.restricoes_loja (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  ufs_permitidas char(2)[],            -- null = sem limite próprio (limite do super admin continua valendo)
  aceita_pf boolean not null default true,
  aceita_pj boolean not null default true,
  somente_catalogo boolean not null default false,
  atualizado_em timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  loja_id uuid,
  user_id uuid,
  acao text not null,
  tabela text,
  antes jsonb,
  depois jsonb
);
create index on public.auditoria (loja_id, quando desc);

-- Append-only: ninguém altera nem apaga registro de auditoria.
create function private.auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'auditoria é imutável';
end $$;
create trigger auditoria_sem_update before update or delete on public.auditoria
  for each row execute function private.auditoria_imutavel();

create function private.auditar_regra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
  values (
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'loja_id')::uuid, null),
    auth.uid(), lower(tg_op), tg_table_name,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;
create trigger audita_restricoes_plataforma after insert or update or delete on public.restricoes_plataforma_uf
  for each row execute function private.auditar_regra();
create trigger audita_restricoes_loja after insert or update or delete on public.restricoes_loja
  for each row execute function private.auditar_regra();

alter table public.restricoes_plataforma_uf enable row level security;
alter table public.restricoes_loja enable row level security;
alter table public.auditoria enable row level security;

create policy rest_plat_ver on public.restricoes_plataforma_uf for select to authenticated
  using (loja_id is null and private.eh_super_admin() or loja_id is not null and private.pode_ver_loja(loja_id));
create policy rest_plat_super on public.restricoes_plataforma_uf for all to authenticated
  using (private.eh_super_admin()) with check (private.eh_super_admin());

create policy rest_loja_ver on public.restricoes_loja for select to authenticated using (private.pode_ver_loja(loja_id));
-- Lojista só pode ESTREITAR; a regra efetiva faz a interseção, então nunca libera o que foi bloqueado.
create policy rest_loja_escreve on public.restricoes_loja for all to authenticated
  using (loja_id in (select private.minhas_lojas()) or private.eh_super_admin())
  with check (loja_id in (select private.minhas_lojas()) or private.eh_super_admin());

create policy auditoria_ver on public.auditoria for select to authenticated
  using (loja_id is null and private.eh_super_admin() or loja_id is not null and private.pode_ver_loja(loja_id));

grant select, insert, update, delete on public.restricoes_plataforma_uf, public.restricoes_loja to authenticated;
grant select on public.auditoria to authenticated;

-- Decisão de venda, calculada no servidor (UF do CEP de entrega; PF/PJ do CPF/CNPJ).
-- Retorna null se pode vender, ou o motivo da recusa.
create function public.motivo_bloqueio_venda(p_loja uuid, p_uf char(2), p_tipo_pessoa text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare r public.restricoes_loja%rowtype; l public.lojas%rowtype;
begin
  select * into l from public.lojas where id = p_loja;
  if not found or not l.ativa then return 'loja_inativa'; end if;
  select * into r from public.restricoes_loja where loja_id = p_loja;
  if l.modo_venda = 'whatsapp' or coalesce(r.somente_catalogo, false) then return 'somente_catalogo'; end if;
  if exists (select 1 from public.restricoes_plataforma_uf
             where uf = p_uf and bloqueada and (loja_id is null or loja_id = p_loja)) then
    return 'uf_bloqueada_plataforma';
  end if;
  if r.ufs_permitidas is not null and not (p_uf = any (r.ufs_permitidas)) then return 'uf_bloqueada_loja'; end if;
  if p_tipo_pessoa = 'pf' and not coalesce(r.aceita_pf, true) then return 'pf_nao_aceita'; end if;
  if p_tipo_pessoa = 'pj' and not coalesce(r.aceita_pj, true) then return 'pj_nao_aceita'; end if;
  return null;
end $$;
revoke execute on function public.motivo_bloqueio_venda(uuid, char, text) from public, anon, authenticated;
grant execute on function public.motivo_bloqueio_venda(uuid, char, text) to service_role;
