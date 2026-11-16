-- Busca na web pelo Firecrawl, com a chave DA LOJA (o responsável cola em Integrações de IA). PROPOSTA: não aplicada em produção.
-- Segredo só em private.*, cifrado no servidor (cripto.ts); o navegador lê apenas estado, final da chave e consumo.
-- Custo controlado por loja: limite mensal de buscas conferido ANTES de cada chamada. Nenhum DELETE: remover = desativar e apagar o segredo.

create table public.loja_busca_firecrawl (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  ativa boolean not null default true,
  final_chave text check (final_chave is null or length(final_chave) = 4),
  limite_mensal integer check (limite_mensal is null or limite_mensal between 10 and 100000),
  buscas_mes integer not null default 0 check (buscas_mes >= 0),
  mes_ref date not null default (date_trunc('month', now()))::date,
  ultimo_uso_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create table private.busca_firecrawl_segredos (
  loja_id uuid primary key references public.loja_busca_firecrawl(loja_id) on delete cascade,
  chave_cifrada text not null
);

alter table public.loja_busca_firecrawl enable row level security;
revoke all on public.loja_busca_firecrawl from anon, authenticated;
grant select (loja_id, ativa, final_chave, limite_mensal, buscas_mes, mes_ref, ultimo_uso_em, atualizado_em) on public.loja_busca_firecrawl to authenticated;
grant select, insert, update on public.loja_busca_firecrawl to service_role;
create policy loja_busca_firecrawl_ver on public.loja_busca_firecrawl for select to authenticated using (private.pode_ver_loja(loja_id));
revoke all on private.busca_firecrawl_segredos from public, anon, authenticated;
grant select, insert, update on private.busca_firecrawl_segredos to service_role;

create function public.busca_firecrawl_salvar(p_loja uuid, p_cifrada text, p_final text, p_limite integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.loja_busca_firecrawl (loja_id, ativa, final_chave, limite_mensal) values (p_loja, true, p_final, p_limite)
  on conflict (loja_id) do update set ativa = true, final_chave = excluded.final_chave, limite_mensal = excluded.limite_mensal, atualizado_em = now();
  insert into private.busca_firecrawl_segredos (loja_id, chave_cifrada) values (p_loja, p_cifrada)
  on conflict (loja_id) do update set chave_cifrada = excluded.chave_cifrada;
end $$;

-- Só devolve chave ativa; zera o consumo na virada do mês.
create function public.busca_firecrawl_ler(p_loja uuid)
returns table (chave_cifrada text, limite_mensal integer, buscas_mes integer) language plpgsql security definer set search_path = '' as $$
begin
  update public.loja_busca_firecrawl set buscas_mes = 0, mes_ref = (date_trunc('month', now()))::date
  where loja_id = p_loja and mes_ref < (date_trunc('month', now()))::date;
  return query
    select s.chave_cifrada, k.limite_mensal, k.buscas_mes
    from public.loja_busca_firecrawl k join private.busca_firecrawl_segredos s on s.loja_id = k.loja_id
    where k.loja_id = p_loja and k.ativa and s.chave_cifrada <> '';
end $$;

create function public.busca_firecrawl_registrar(p_loja uuid, p_buscas integer)
returns void language sql security definer set search_path = '' as $$
  update public.loja_busca_firecrawl
  set buscas_mes = case when mes_ref < (date_trunc('month', now()))::date then 0 else buscas_mes end + greatest(p_buscas, 0),
      mes_ref = (date_trunc('month', now()))::date, ultimo_uso_em = now()
  where loja_id = p_loja;
$$;

create function public.busca_firecrawl_desativar(p_loja uuid)
returns void language sql security definer set search_path = '' as $$
  update private.busca_firecrawl_segredos set chave_cifrada = '' where loja_id = p_loja;
  update public.loja_busca_firecrawl set ativa = false, final_chave = null, atualizado_em = now() where loja_id = p_loja;
$$;

revoke all on function public.busca_firecrawl_salvar(uuid, text, text, integer), public.busca_firecrawl_ler(uuid),
  public.busca_firecrawl_registrar(uuid, integer), public.busca_firecrawl_desativar(uuid) from public, anon, authenticated;
grant execute on function public.busca_firecrawl_salvar(uuid, text, text, integer), public.busca_firecrawl_ler(uuid),
  public.busca_firecrawl_registrar(uuid, integer), public.busca_firecrawl_desativar(uuid) to service_role;
