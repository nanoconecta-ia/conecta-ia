-- Backup versionado do cadastro do Bling dentro do Conecta (desenho aprovado pelo dono em 2026-10-19; PR #53).
-- NÃO aplicar em produção sem autorização específica.
-- Objetivo: se a chave do Bling cair, o Conecta continua com uma cópia completa e datada (JSON da API + vínculos de fornecedor,
-- categorias e contatos fornecedores) e consegue gerar o CSV no formato do Bling. Quando o Bling volta, compara-se e atualiza-se.
-- O Conecta NUNCA grava no Bling por aqui: estas tabelas só recebem LEITURA do Bling.
-- ATENÇÃO (privacidade): o snapshot contém custo, preço de compra e fornecedor. Só o administrador da loja lê (RLS); nada daqui vai
-- para a loja pública, para o espelho `produtos` nem para as ferramentas dos agentes.

create table public.bling_snapshots (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  origem text not null check (origem in ('manual', 'diario')),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'completo', 'parcial', 'falhou')),
  criado_por uuid,
  contagens jsonb not null default '{}'::jsonb,
  erro text check (erro is null or char_length(erro) <= 300),
  unique (id, loja_id)
);
create index on public.bling_snapshots (loja_id, criado_em desc);

create table public.bling_snapshot_produtos (
  snapshot_id uuid not null,
  loja_id uuid not null,
  bling_id text not null,
  codigo text,
  json_produto jsonb not null,
  json_vinculos jsonb not null default '[]'::jsonb,
  hash text not null,
  primary key (snapshot_id, bling_id),
  foreign key (snapshot_id, loja_id) references public.bling_snapshots (id, loja_id) on delete cascade
);
create index on public.bling_snapshot_produtos (loja_id, bling_id);

create table public.bling_snapshot_categorias (
  snapshot_id uuid not null,
  loja_id uuid not null,
  bling_id text not null,
  nome text not null,
  pai_bling_id text,
  primary key (snapshot_id, bling_id),
  foreign key (snapshot_id, loja_id) references public.bling_snapshots (id, loja_id) on delete cascade
);

create table public.bling_snapshot_contatos (
  snapshot_id uuid not null,
  loja_id uuid not null,
  bling_id text not null,
  nome text not null,
  documento text,
  primary key (snapshot_id, bling_id),
  foreign key (snapshot_id, loja_id) references public.bling_snapshots (id, loja_id) on delete cascade
);

do $$ declare t text; begin
  foreach t in array array['bling_snapshots', 'bling_snapshot_produtos', 'bling_snapshot_categorias', 'bling_snapshot_contatos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.administra_loja(loja_id, auth.uid()))', t || '_admin', t);
  end loop;
end $$;

-- Abre um snapshot em andamento (só service_role: a Edge Function confere o login e o papel antes).
create function public.bling_snapshot_iniciar(p_loja uuid, p_origem text, p_user uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_origem not in ('manual', 'diario') then raise exception 'origem_invalida' using errcode = '22023'; end if;
  insert into public.bling_snapshots (loja_id, origem, criado_por) values (p_loja, p_origem, p_user) returning id into v_id;
  return v_id;
end $$;

-- Grava um lote (idempotente: o mesmo produto no mesmo snapshot é substituído). Só enquanto o snapshot está em andamento.
create function public.bling_snapshot_gravar(p_snapshot uuid, p_produtos jsonb default '[]', p_categorias jsonb default '[]', p_contatos jsonb default '[]') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_loja uuid; v_status text; n_p int := 0; n_cat int := 0; n_con int := 0;
begin
  select loja_id, status into v_loja, v_status from public.bling_snapshots where id = p_snapshot;
  if v_loja is null then raise exception 'snapshot_nao_encontrado' using errcode = 'P0002'; end if;
  if v_status <> 'em_andamento' then raise exception 'snapshot_encerrado' using errcode = '55000'; end if;
  insert into public.bling_snapshot_produtos (snapshot_id, loja_id, bling_id, codigo, json_produto, json_vinculos, hash)
    select p_snapshot, v_loja, x.bling_id, x.codigo, x.json_produto, coalesce(x.json_vinculos, '[]'::jsonb), x.hash
    from jsonb_to_recordset(coalesce(p_produtos, '[]'::jsonb)) as x(bling_id text, codigo text, json_produto jsonb, json_vinculos jsonb, hash text)
  on conflict (snapshot_id, bling_id) do update set codigo = excluded.codigo, json_produto = excluded.json_produto, json_vinculos = excluded.json_vinculos, hash = excluded.hash;
  get diagnostics n_p = row_count;
  insert into public.bling_snapshot_categorias (snapshot_id, loja_id, bling_id, nome, pai_bling_id)
    select p_snapshot, v_loja, x.bling_id, x.nome, x.pai_bling_id
    from jsonb_to_recordset(coalesce(p_categorias, '[]'::jsonb)) as x(bling_id text, nome text, pai_bling_id text)
  on conflict (snapshot_id, bling_id) do update set nome = excluded.nome, pai_bling_id = excluded.pai_bling_id;
  get diagnostics n_cat = row_count;
  insert into public.bling_snapshot_contatos (snapshot_id, loja_id, bling_id, nome, documento)
    select p_snapshot, v_loja, x.bling_id, x.nome, x.documento
    from jsonb_to_recordset(coalesce(p_contatos, '[]'::jsonb)) as x(bling_id text, nome text, documento text)
  on conflict (snapshot_id, bling_id) do update set nome = excluded.nome, documento = excluded.documento;
  get diagnostics n_con = row_count;
  return jsonb_build_object('produtos', n_p, 'categorias', n_cat, 'contatos', n_con);
end $$;

-- Encerra o snapshot, registra as contagens reais (contadas no banco, não informadas pelo chamador) e audita.
create function public.bling_snapshot_concluir(p_snapshot uuid, p_status text, p_erro text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_loja uuid; v_user uuid; v_cont jsonb;
begin
  if p_status not in ('completo', 'parcial', 'falhou') then raise exception 'status_invalido' using errcode = '22023'; end if;
  select loja_id, criado_por into v_loja, v_user from public.bling_snapshots where id = p_snapshot and status = 'em_andamento';
  if v_loja is null then raise exception 'snapshot_nao_esta_em_andamento' using errcode = '55000'; end if;
  v_cont := jsonb_build_object(
    'produtos', (select count(*) from public.bling_snapshot_produtos where snapshot_id = p_snapshot),
    'categorias', (select count(*) from public.bling_snapshot_categorias where snapshot_id = p_snapshot),
    'contatos', (select count(*) from public.bling_snapshot_contatos where snapshot_id = p_snapshot));
  update public.bling_snapshots set status = p_status, concluido_em = now(), contagens = v_cont, erro = left(p_erro, 300) where id = p_snapshot;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois)
    values (v_loja, v_user, 'bling.backup.' || p_status, 'bling_snapshots', jsonb_build_object('snapshot_id', p_snapshot) || v_cont);
  return v_cont;
end $$;

-- Poda os mais antigos, mantendo os N mais recentes e SEMPRE o último completo (a cópia que salva a loja não pode ser apagada).
create function public.bling_snapshot_podar(p_loja uuid, p_manter int default 30) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_manter < 1 then raise exception 'manter_invalido' using errcode = '22023'; end if;
  with manter as (
    select id from public.bling_snapshots where loja_id = p_loja order by criado_em desc limit p_manter
  ), ultimo as (
    select id from public.bling_snapshots where loja_id = p_loja and status = 'completo' order by criado_em desc limit 1
  )
  delete from public.bling_snapshots s where s.loja_id = p_loja and s.status <> 'em_andamento'
    and s.id not in (select id from manter) and s.id not in (select id from ultimo);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.bling_snapshot_iniciar(uuid, text, uuid), public.bling_snapshot_gravar(uuid, jsonb, jsonb, jsonb),
  public.bling_snapshot_concluir(uuid, text, text), public.bling_snapshot_podar(uuid, int) from public, anon, authenticated;
grant execute on function public.bling_snapshot_iniciar(uuid, text, uuid), public.bling_snapshot_gravar(uuid, jsonb, jsonb, jsonb),
  public.bling_snapshot_concluir(uuid, text, text), public.bling_snapshot_podar(uuid, int) to service_role;
