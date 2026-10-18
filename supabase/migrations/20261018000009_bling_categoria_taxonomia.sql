-- Ponte entre a decomposição real do Bling (bling_categorias) e a taxonomia interna (taxonomia_nos) usada pela loja
-- pública. Sem essa ponte, produtos.taxonomia_no_id nunca é preenchido e a loja nunca mostra filtro por categoria.
-- O lojista define o mapeamento (RPC abaixo); a sincronização (bling-sync) aplica automaticamente em produtos novos
-- e já alterados. bling_categoria_id é texto livre (não referencia bling_categorias): categorias do Bling podem ser
-- órfãs/apagadas do lado do Bling e o produto continuar com o id antigo — isso é um dado real, não um erro nosso.
create table public.bling_categoria_taxonomia (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  bling_categoria_id text not null,
  taxonomia_no_id uuid not null references public.taxonomia_nos(id),
  definido_em timestamptz not null default now(),
  primary key (loja_id, bling_categoria_id)
);
alter table public.bling_categoria_taxonomia enable row level security;
revoke all on public.bling_categoria_taxonomia from anon, authenticated;
grant select on public.bling_categoria_taxonomia to authenticated;
grant select, insert, update, delete on public.bling_categoria_taxonomia to service_role;
create policy bling_categoria_taxonomia_ver on public.bling_categoria_taxonomia for select to authenticated
  using (private.pode_ver_loja(loja_id));

-- Define (ou substitui) o mapeamento de uma categoria do Bling para um nó da taxonomia, e aplica de imediato
-- em todos os produtos já sincronizados daquela categoria (não exige nova sincronização para fazer efeito).
create function public.bling_categoria_taxonomia_definir(p_loja uuid, p_bling_categoria_id text, p_taxonomia_no_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.taxonomia_nos where id = p_taxonomia_no_id) then
    raise exception 'nó de taxonomia não encontrado' using errcode = '23503';
  end if;
  insert into public.bling_categoria_taxonomia (loja_id, bling_categoria_id, taxonomia_no_id)
  values (p_loja, p_bling_categoria_id, p_taxonomia_no_id)
  on conflict (loja_id, bling_categoria_id) do update set taxonomia_no_id = excluded.taxonomia_no_id, definido_em = now();
  update public.produtos set taxonomia_no_id = p_taxonomia_no_id
    where loja_id = p_loja and categoria_bling_id = p_bling_categoria_id
      and taxonomia_no_id is distinct from p_taxonomia_no_id;
end $$;

-- Remove o mapeamento (os produtos já linkados mantêm o taxonomia_no_id até serem remapeados ou a categoria mudar).
create function public.bling_categoria_taxonomia_remover(p_loja uuid, p_bling_categoria_id text)
returns void language sql security definer set search_path = '' as $$
  delete from public.bling_categoria_taxonomia where loja_id = p_loja and bling_categoria_id = p_bling_categoria_id;
$$;

-- Chamada pela sincronização (bling-sync) após gravar produtos: aplica o mapeamento já definido em qualquer
-- produto cuja categoria_bling_id tenha mapeamento mas o taxonomia_no_id ainda não reflita isso (produto novo
-- ou categoria trocada no Bling). Idempotente; sem efeito quando não há mapeamento para a categoria.
create function public.bling_categoria_taxonomia_aplicar(p_loja uuid)
returns integer language sql security definer set search_path = '' as $$
  with atualizados as (
    update public.produtos p set taxonomia_no_id = m.taxonomia_no_id
    from public.bling_categoria_taxonomia m
    where p.loja_id = p_loja and m.loja_id = p_loja and p.categoria_bling_id = m.bling_categoria_id
      and p.taxonomia_no_id is distinct from m.taxonomia_no_id
    returning 1
  )
  select count(*)::integer from atualizados;
$$;

revoke all on function public.bling_categoria_taxonomia_definir(uuid, text, uuid), public.bling_categoria_taxonomia_remover(uuid, text),
  public.bling_categoria_taxonomia_aplicar(uuid) from public, anon, authenticated;
grant execute on function public.bling_categoria_taxonomia_definir(uuid, text, uuid), public.bling_categoria_taxonomia_remover(uuid, text),
  public.bling_categoria_taxonomia_aplicar(uuid) to service_role;
