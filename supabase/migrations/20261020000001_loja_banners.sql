-- Banners de oferta da loja. O lojista escolhe um PRODUTO PUBLICADO; preço, nome e foto vêm do espelho do Bling (nada é digitado).
-- Estilo 'auto' vira flash (oferta relâmpago) quando o produto está na área Motor da taxonomia; resolvido na leitura pública.
-- Rascunho/agendado/no ar é derivado de ativo + período; no máximo 5 no ar por loja; tudo auditado.
create table public.loja_banners (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  chamada text check (chamada is null or char_length(chamada) <= 80),
  estilo text not null default 'auto' check (estilo in ('auto', 'padrao', 'flash')),
  inicio timestamptz not null default now(),
  fim timestamptz,
  ativo boolean not null default false,
  ordem int not null default 0,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim > inicio)
);
create index loja_banners_loja_ativo on public.loja_banners (loja_id, ativo, inicio);

-- produto da mesma loja e publicado; máximo de 5 banners ativos por loja
create function private.valida_banner() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_loja uuid; v_pub boolean; v_n int;
begin
  select loja_id, publicado into v_loja, v_pub from public.produtos where id = new.produto_id;
  if v_loja is null or v_loja <> new.loja_id then raise exception 'produto não pertence à loja' using errcode = '23514'; end if;
  if new.ativo and not coalesce(v_pub, false) then raise exception 'só produto publicado pode ter banner ativo' using errcode = '23514'; end if;
  if new.ativo then
    select count(*) into v_n from public.loja_banners where loja_id = new.loja_id and ativo and id <> new.id;
    if v_n >= 5 then raise exception 'máximo de 5 banners ativos por loja' using errcode = '23514'; end if;
  end if;
  new.atualizado_em := now();
  if tg_op = 'INSERT' then new.criado_por := auth.uid(); end if;
  return new;
end $$;
create trigger banners_valida before insert or update on public.loja_banners for each row execute function private.valida_banner();
create trigger banners_auditoria after insert or update or delete on public.loja_banners for each row execute function private.auditar_regra();

alter table public.loja_banners enable row level security;
create policy banners_lojista on public.loja_banners for all to authenticated
  using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id));
grant select, insert, update, delete on public.loja_banners to authenticated, service_role;

-- Leitura pública (chamada só pela Edge Function com service_role): banners no ar, com dados do produto publicado.
-- flash = estilo 'flash', ou 'auto' com o produto dentro da área Motor (nó 'motor' ou descendente).
create function public.banners_da_vitrine(p_loja uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with recursive motor as (
    select id from public.taxonomia_nos where slug = 'motor' and pai_id is null
    union all select n.id from public.taxonomia_nos n join motor m on n.pai_id = m.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'produto_id', p.id, 'sku', p.sku, 'nome', p.nome, 'preco', p.preco, 'chamada', b.chamada, 'fim', b.fim,
    'flash', (b.estilo = 'flash' or (b.estilo = 'auto' and p.taxonomia_no_id in (select id from motor)))
  ) order by b.ordem, b.inicio), '[]'::jsonb)
  from public.loja_banners b join public.produtos p on p.id = b.produto_id
  where b.loja_id = p_loja and b.ativo and p.publicado and p.nome is not null and p.sku is not null
    and b.inicio <= now() and (b.fim is null or b.fim > now());
$$;
revoke all on function public.banners_da_vitrine(uuid) from public, anon, authenticated;
grant execute on function public.banners_da_vitrine(uuid) to service_role;
