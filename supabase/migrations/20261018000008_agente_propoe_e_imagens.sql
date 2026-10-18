-- O agente passa a PROPOR dados (nunca aprovar): enriquecimento, código, aplicação veicular e imagem.
-- Toda proposta exige fonte e entra como 'a_confirmar'; cada RPC confere que o produto pertence à loja (defesa em profundidade).
-- Busca de imagem na web: credencial por loja (BYOK), como os demais provedores em Integrações de IA.

alter table public.produto_enriquecimento add constraint produto_enriquecimento_campo_valido
  check (campo in ('marca_peca', 'descricao_curta', 'descricao_longa', 'peso_kg', 'dimensoes', 'categoria_sugerida', 'ncm_sugerido'));

create table public.loja_busca_imagem (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  api_key_cifrada text not null,
  cx text not null check (cx ~ '^[0-9a-zA-Z:_-]{6,60}$'),
  ativa boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.loja_busca_imagem enable row level security;
revoke all on public.loja_busca_imagem from anon, authenticated;
grant select on public.loja_busca_imagem to authenticated;
grant select, insert, update on public.loja_busca_imagem to service_role;
create policy loja_busca_imagem_ver on public.loja_busca_imagem for select to authenticated using (private.pode_ver_loja(loja_id));

create function private.produto_da_loja(p_loja uuid, p_produto uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.produtos where id = p_produto and loja_id = p_loja);
$$;

create function public.enriquecimento_propor(p_loja uuid, p_produto uuid, p_campo text, p_valor jsonb, p_fonte text, p_confianca numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.produto_da_loja(p_loja, p_produto) then raise exception 'produto não pertence à loja' using errcode = '42501'; end if;
  insert into public.produto_enriquecimento (loja_id, produto_id, campo, valor, fonte, coletado_em, confianca, status)
  values (p_loja, p_produto, p_campo, p_valor, p_fonte, now(), p_confianca, 'a_confirmar')
  on conflict (produto_id, campo) do update
    set valor = excluded.valor, fonte = excluded.fonte, coletado_em = excluded.coletado_em, confianca = excluded.confianca, status = 'a_confirmar'
    where public.produto_enriquecimento.status <> 'aprovado';
end $$;

create function public.codigo_propor(p_loja uuid, p_produto uuid, p_tipo text, p_valor text, p_fonte text, p_confianca numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.produto_da_loja(p_loja, p_produto) then raise exception 'produto não pertence à loja' using errcode = '42501'; end if;
  insert into public.produto_codigos (loja_id, produto_id, tipo, valor, fonte, coletado_em, confianca, status)
  values (p_loja, p_produto, p_tipo, p_valor, p_fonte, now(), p_confianca, 'a_confirmar')
  on conflict (produto_id, tipo, valor) do nothing;
end $$;

create function public.aplicacao_propor(p_loja uuid, p_produto uuid, p_modelo text, p_motorizacao text, p_ano_inicial int, p_ano_final int, p_fonte text, p_confianca numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.produto_da_loja(p_loja, p_produto) then raise exception 'produto não pertence à loja' using errcode = '42501'; end if;
  insert into public.produto_aplicacoes (loja_id, produto_id, modelo, motorizacao, ano_inicial, ano_final, fonte, coletado_em, confianca, status)
  values (p_loja, p_produto, p_modelo, p_motorizacao, p_ano_inicial, p_ano_final, p_fonte, now(), p_confianca, 'a_confirmar');
end $$;

-- cruzamento_tipo/valor = como a imagem foi ligada a ESTA peça (aqui, o SKU buscado); a constraint do banco
-- exige esse cruzamento para aprovar imagem que não é 'real'. url_original é a página de origem (se houver).
create function public.imagem_propor(p_loja uuid, p_produto uuid, p_url text, p_origem text, p_sku text, p_pagina text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.produto_da_loja(p_loja, p_produto) then raise exception 'produto não pertence à loja' using errcode = '42501'; end if;
  insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, cruzamento_tipo, cruzamento_valor, url_original, aprovada, ordem)
  values (p_loja, p_produto, p_url, 'ilustrativa', p_origem, 'sku', p_sku, nullif(p_pagina, p_url),
    false, coalesce((select max(ordem) + 1 from public.produto_imagens where produto_id = p_produto), 0));
end $$;

-- aprovar: marca aprovada (e principal, se for a primeira aprovada do produto). rejeitar: remove a proposta (não é dado real ainda).
create function public.imagem_decidir(p_loja uuid, p_imagem uuid, p_decisao text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_produto uuid;
begin
  select produto_id into v_produto from public.produto_imagens where id = p_imagem and loja_id = p_loja and aprovada = false;
  if v_produto is null then raise exception 'imagem não encontrada ou já decidida' using errcode = 'P0002'; end if;
  if p_decisao = 'aprovar' then
    update public.produto_imagens set aprovada = true,
      principal = principal or not exists (select 1 from public.produto_imagens where produto_id = v_produto and aprovada = true)
    where id = p_imagem;
  elsif p_decisao = 'rejeitar' then
    delete from public.produto_imagens where id = p_imagem;
  else raise exception 'decisão inválida' using errcode = '22023'; end if;
end $$;

create function public.busca_imagem_salvar(p_loja uuid, p_api_key_cifrada text, p_cx text)
returns void language sql security definer set search_path = '' as $$
  insert into public.loja_busca_imagem (loja_id, api_key_cifrada, cx, ativa) values (p_loja, p_api_key_cifrada, p_cx, true)
  on conflict (loja_id) do update set api_key_cifrada = excluded.api_key_cifrada, cx = excluded.cx, ativa = true, atualizado_em = now();
$$;
create function public.busca_imagem_ler(p_loja uuid)
returns table (api_key_cifrada text, cx text) language sql security definer set search_path = '' as $$
  select api_key_cifrada, cx from public.loja_busca_imagem where loja_id = p_loja and ativa;
$$;
create function public.busca_imagem_desativar(p_loja uuid)
returns void language sql security definer set search_path = '' as $$
  update public.loja_busca_imagem set ativa = false, atualizado_em = now() where loja_id = p_loja;
$$;

revoke all on function
  public.enriquecimento_propor(uuid, uuid, text, jsonb, text, numeric), public.codigo_propor(uuid, uuid, text, text, text, numeric),
  public.aplicacao_propor(uuid, uuid, text, text, int, int, text, numeric), public.imagem_propor(uuid, uuid, text, text, text, text),
  public.imagem_decidir(uuid, uuid, text), public.busca_imagem_salvar(uuid, text, text), public.busca_imagem_ler(uuid), public.busca_imagem_desativar(uuid)
  from public, anon, authenticated;
grant execute on function
  public.enriquecimento_propor(uuid, uuid, text, jsonb, text, numeric), public.codigo_propor(uuid, uuid, text, text, text, numeric),
  public.aplicacao_propor(uuid, uuid, text, text, int, int, text, numeric), public.imagem_propor(uuid, uuid, text, text, text, text),
  public.imagem_decidir(uuid, uuid, text), public.busca_imagem_salvar(uuid, text, text), public.busca_imagem_ler(uuid), public.busca_imagem_desativar(uuid)
  to service_role;
