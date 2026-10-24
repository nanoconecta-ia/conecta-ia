-- Identidade do produto = ID do Bling DENTRO da loja (unique (loja_id, bling_id), que já existe). SKU não é chave única confiável:
-- o Bling aceita o mesmo código em registros diferentes. O índice único (loja_id, sku) fazia o lote inteiro da sincronização falhar.
-- Agora: o SKU vira índice comum; repetição ou ausência de SKU em produto ATIVO abre um conflito (com cópia do registro original),
-- o produto é despublicado e não pode ser publicado enquanto o conflito estiver aberto. Os demais produtos seguem normalmente.
drop index public.produtos_loja_sku;
create index produtos_loja_sku on public.produtos (loja_id, sku) where sku is not null;

create table public.produto_conflitos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  bling_id text not null,
  produto_id uuid references public.produtos(id) on delete cascade,
  motivo text not null check (motivo in ('sku_duplicado', 'sku_vazio')),
  sku text,
  outros_bling_ids text[] not null default '{}',
  estado text not null default 'aberto' check (estado in ('aberto', 'resolvido')),
  original jsonb not null,                       -- registro como foi importado (nada se perde)
  detectado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  unique (loja_id, bling_id, motivo)
);
create index produto_conflitos_abertos on public.produto_conflitos (loja_id) where estado = 'aberto';
alter table public.produto_conflitos enable row level security;
create policy conflitos_ver on public.produto_conflitos for select to authenticated using (private.pode_ver_loja(loja_id));
grant select on public.produto_conflitos to authenticated;
grant select, insert, update, delete on public.produto_conflitos to service_role;

-- Reconcilia a identidade de uma loja (idempotente; chamada pela sincronização depois de gravar o espelho).
create function public.produtos_reconciliar_identidade(p_loja uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_abertos int; v_resolvidos int; v_despublicados int;
begin
  -- candidatos: produtos ATIVOS (situacao 'A') com SKU vazio ou repetido (sem diferenciar maiúsculas nem espaços nas pontas)
  drop table if exists pg_temp.cand;
  create temp table cand on commit drop as
  select p.id as produto_id, p.bling_id,
         case when coalesce(btrim(p.sku), '') = '' then 'sku_vazio' else 'sku_duplicado' end as motivo,
         nullif(btrim(p.sku), '') as sku,
         coalesce((select array_agg(o.bling_id order by o.bling_id) from public.produtos o
                   where o.loja_id = p.loja_id and o.situacao = 'A' and o.id <> p.id and coalesce(btrim(p.sku), '') <> ''
                     and lower(btrim(o.sku)) = lower(btrim(p.sku))), '{}') as outros,
         jsonb_build_object('nome', p.nome, 'sku', p.sku, 'preco', p.preco, 'estoque', p.estoque, 'situacao', p.situacao,
                            'marca', p.marca, 'gtin', p.gtin, 'sincronizado_em', p.sincronizado_em) as original
  from public.produtos p
  where p.loja_id = p_loja and p.situacao = 'A'
    and (coalesce(btrim(p.sku), '') = ''
         or exists (select 1 from public.produtos o where o.loja_id = p.loja_id and o.situacao = 'A' and o.id <> p.id
                    and lower(btrim(o.sku)) = lower(btrim(p.sku))));
  insert into public.produto_conflitos (loja_id, bling_id, produto_id, motivo, sku, outros_bling_ids, original)
  select p_loja, bling_id, produto_id, motivo, sku, outros, original from pg_temp.cand
  on conflict (loja_id, bling_id, motivo) do update
    set estado = 'aberto', resolvido_em = null, produto_id = excluded.produto_id, sku = excluded.sku,
        outros_bling_ids = excluded.outros_bling_ids, original = excluded.original;
  update public.produto_conflitos c set estado = 'resolvido', resolvido_em = now()
   where c.loja_id = p_loja and c.estado = 'aberto'
     and not exists (select 1 from pg_temp.cand k where k.bling_id = c.bling_id and k.motivo = c.motivo);
  get diagnostics v_resolvidos = row_count;
  update public.produtos p set publicado = false where p.loja_id = p_loja and p.publicado and p.id in (select produto_id from pg_temp.cand);
  get diagnostics v_despublicados = row_count;
  select count(*) into v_abertos from public.produto_conflitos where loja_id = p_loja and estado = 'aberto';
  return jsonb_build_object('abertos', v_abertos, 'resolvidos', v_resolvidos, 'despublicados', v_despublicados);
end $$;
revoke all on function public.produtos_reconciliar_identidade(uuid) from public, anon, authenticated;
grant execute on function public.produtos_reconciliar_identidade(uuid) to service_role;

-- Produto com conflito aberto não é publicado (por ninguém, por nenhum caminho).
create function private.bloqueia_publicar_ambiguo() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.publicado and (tg_op = 'INSERT' or not old.publicado)
     and exists (select 1 from public.produto_conflitos c where c.loja_id = new.loja_id and c.bling_id = new.bling_id and c.estado = 'aberto') then
    raise exception 'identidade_ambigua: SKU repetido ou vazio, resolva o conflito antes de publicar' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger produtos_bloqueia_ambiguo before insert or update of publicado on public.produtos
  for each row execute function private.bloqueia_publicar_ambiguo();
