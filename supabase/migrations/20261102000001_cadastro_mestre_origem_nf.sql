-- F2 do desenho docs/conector-ia/CADASTRO_MESTRE_ORIGEM_NF.md (aprovado pelo dono em 2026-11-02).
-- Cadastro mestre, origem por fornecedor, vínculo imutável com nota fiscal e evidência de marca.
-- Só estrutura: nenhuma função de escrita no Bling, nenhum dado de custo exposto a IA/MCP/site.
-- Reversão: docs/conector-ia/CADASTRO_MESTRE_REVERSAO.sql (só em banco descartável; nunca em produção sem ordem do dono).

create type public.origem_marca as enum ('nacional', 'importado', 'a_confirmar');
create type public.origem_tipo as enum ('importador', 'fabricante', 'parceiro', 'outro');

create table public.produto_mestre (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete restrict,
  taxonomia_no_id uuid references public.taxonomia_nos(id) on delete set null,
  nome text not null check (length(btrim(nome)) > 0),
  fabricante text,
  codigo_original text,
  origem_marca public.origem_marca not null default 'a_confirmar',
  criado_em timestamptz not null default now(),
  unique (id, loja_id)
);
create index on public.produto_mestre (loja_id, codigo_original);

-- cada oferta/fornecedor ligada ao mestre; SEM preço (preço fica em produto_origem_custo)
create table public.produto_origem (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  mestre_id uuid not null,
  tipo public.origem_tipo not null,
  sku_origem text not null check (length(btrim(sku_origem)) > 0),
  referencia_fornecedor text,
  produto_id uuid,
  nota_entrada text,
  criado_em timestamptz not null default now(),
  foreign key (mestre_id, loja_id) references public.produto_mestre (id, loja_id) on delete restrict,
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id) on delete restrict,
  unique (id, loja_id),
  unique (loja_id, tipo, sku_origem)
);
create index on public.produto_origem (loja_id, mestre_id);

-- preço de compra por origem: só administrador da loja; nunca lido por função de IA, mapa, MCP ou site
create table public.produto_origem_custo (
  id bigint generated always as identity primary key,
  loja_id uuid not null,
  origem_id uuid not null,
  custo numeric(14,4) not null check (custo >= 0),
  moeda text not null default 'BRL',
  vigente_desde date not null default current_date,
  registrado_por uuid not null default auth.uid(),
  foreign key (origem_id, loja_id) references public.produto_origem (id, loja_id) on delete restrict
);
create index on public.produto_origem_custo (loja_id, origem_id, vigente_desde desc);

-- item de nota (entrada ou saída) ligado a produto/mestre, com evidência; append-only
create table public.produto_vinculo_nf (
  id bigint generated always as identity primary key,
  loja_id uuid not null references public.lojas(id) on delete restrict,
  nota_tipo text not null check (nota_tipo in ('entrada', 'saida')),
  nota_numero text not null,
  nota_serie text,
  nota_chave text,
  item_numero integer not null check (item_numero > 0),
  produto_id uuid,
  mestre_id uuid,
  evidencia text not null check (length(btrim(evidencia)) >= 5),
  imutavel boolean not null default true check (imutavel),
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now(),
  check (produto_id is not null or mestre_id is not null),
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id) on delete restrict,
  foreign key (mestre_id, loja_id) references public.produto_mestre (id, loja_id) on delete restrict,
  unique (loja_id, nota_tipo, nota_numero, nota_serie, item_numero, produto_id)
);
create index on public.produto_vinculo_nf (loja_id, nota_chave);

-- toda proposta de marca aponta para uma linha de evidência
create table public.marca_evidencia (
  id bigint generated always as identity primary key,
  loja_id uuid not null references public.lojas(id) on delete restrict,
  produto_id uuid,
  marca text not null check (length(btrim(marca)) > 0),
  origem_marca public.origem_marca not null default 'a_confirmar',
  fonte text not null check (length(btrim(fonte)) >= 5),
  fonte_tipo text not null check (fonte_tipo in ('url', 'nota_fiscal', 'cadastro', 'documento')),
  nivel text not null check (nivel in ('verificada', 'declarada')),
  criado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id) on delete restrict
);
create index on public.marca_evidencia (loja_id, produto_id);

-- produto com nota vinculada nunca é descartado
alter table public.produtos add column protegido_por_nf boolean not null default false;

-- append-only: vínculo com nota e evidência de marca; nada se apaga nem se edita
create function private.cadastro_append_only() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% é append-only', tg_table_name using errcode = '42501';
end $$;
create trigger produto_vinculo_nf_imutavel before update or delete on public.produto_vinculo_nf
  for each row execute function private.cadastro_append_only();
create trigger marca_evidencia_imutavel before update or delete on public.marca_evidencia
  for each row execute function private.cadastro_append_only();

-- mestre e origem nunca são apagados (restaurar = nova origem, não DELETE)
create function private.cadastro_sem_delete() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% não pode ser apagado', tg_table_name using errcode = '42501';
end $$;
create trigger produto_mestre_sem_delete before delete on public.produto_mestre
  for each row execute function private.cadastro_sem_delete();
create trigger produto_origem_sem_delete before delete on public.produto_origem
  for each row execute function private.cadastro_sem_delete();

-- vincular nota protege o produto
create function private.vinculo_nf_protege() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.produto_id is not null then
    update public.produtos set protegido_por_nf = true where id = new.produto_id and loja_id = new.loja_id;
  end if;
  return new;
end $$;
create trigger produto_vinculo_nf_protege after insert on public.produto_vinculo_nf
  for each row execute function private.vinculo_nf_protege();

-- RLS: leitura por quem vê a loja; escrita só pelo servidor (service_role). Custo: só administrador da loja.
do $$
declare t text;
begin
  foreach t in array array['produto_mestre', 'produto_origem', 'produto_origem_custo', 'produto_vinculo_nf', 'marca_evidencia'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.produto_mestre, public.produto_origem, public.produto_vinculo_nf, public.marca_evidencia to authenticated;
grant select on public.produto_origem_custo to authenticated;
create policy produto_mestre_ver on public.produto_mestre for select to authenticated using (private.pode_ver_loja(loja_id));
create policy produto_origem_ver on public.produto_origem for select to authenticated using (private.pode_ver_loja(loja_id));
create policy produto_vinculo_nf_ver on public.produto_vinculo_nf for select to authenticated using (private.pode_ver_loja(loja_id));
create policy marca_evidencia_ver on public.marca_evidencia for select to authenticated using (private.pode_ver_loja(loja_id));
create policy produto_origem_custo_admin on public.produto_origem_custo for select to authenticated
  using (private.eh_super_admin() or private.administra_loja(loja_id, auth.uid()));
