-- Mobis / Conecta.IA: imagem opcional específica para cada campanha Flash.
-- O banner referencia sempre o MESMO produto físico; as aplicações por veículo têm suas próprias páginas.
-- Nenhum estoque, preço, produto ou aplicação é duplicado.
alter table public.loja_banners
  add column if not exists imagem_id uuid references public.produto_imagens(id) on delete set null;

-- Impede selecionar imagem de outra loja/produto, sem direitos ou retirada.
-- A view imagens_publicaveis é a mesma fonte segura usada pelo catálogo público.
create or replace function private.validar_imagem_banner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.imagem_id is not null and not exists (
    select 1 from public.imagens_publicaveis i
    where i.id = new.imagem_id
      and i.loja_id = new.loja_id
      and i.produto_id = new.produto_id
  ) then
    raise exception 'imagem do banner precisa pertencer ao produto e estar autorizada para publicação'
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger banners_imagem_valida
before insert or update on public.loja_banners
for each row execute function private.validar_imagem_banner();

-- Reutiliza a RPC pública existente, respeitando o controle de acesso já configurado.
-- Sem imagem selecionada, usa a principal PUBLICÁVEL do mesmo SKU.
-- Imagem removida / autorização revogada nunca reaparece no banner.
create or replace function public.banners_da_vitrine(p_loja uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with recursive motor as (
    select id from public.taxonomia_nos where slug = 'motor' and pai_id is null
    union all
    select n.id from public.taxonomia_nos n join motor m on n.pai_id = m.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'produto_id', p.id, 'sku', p.sku, 'nome', p.nome,
    'preco', p.preco, 'chamada', b.chamada, 'fim', b.fim,
    'imagem', (
      select i.url from public.imagens_publicaveis i
      where i.loja_id = b.loja_id and i.produto_id = p.id
        and (b.imagem_id is null or i.id = b.imagem_id)
      order by i.principal desc, i.ordem, i.id limit 1
    ),
    'flash', (b.estilo = 'flash' or (b.estilo = 'auto' and p.taxonomia_no_id in (select id from motor)))
  ) order by b.ordem, b.inicio), '[]'::jsonb)
  from public.loja_banners b join public.produtos p on p.id = b.produto_id
  where b.loja_id = p_loja and b.ativo and p.publicado
    and p.nome is not null and p.sku is not null
    and b.inicio <= now() and (b.fim is null or b.fim > now());
$$;
revoke all on function public.banners_da_vitrine(uuid) from public, anon, authenticated;
grant execute on function public.banners_da_vitrine(uuid) to service_role;
