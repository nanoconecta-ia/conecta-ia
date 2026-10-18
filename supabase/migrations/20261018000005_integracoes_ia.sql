-- Integrações de IA por loja: chave do provedor (BYOK, cifrada no servidor) e plugins/conexões (mcp, api, llm, plugin_pull).
-- Segredos só em private.*; o navegador nunca recebe chave nem credencial. Escrita só por service_role (Edge Functions).
-- Nenhum DELETE: remover = desativar e apagar o segredo (o registro fica para auditoria).

alter table public.loja_chaves_ia
  add column modelo text check (modelo is null or modelo ~ '^[a-z0-9][a-z0-9._-]{2,59}$'),
  add column final_chave text,
  add column tokens_mes bigint not null default 0 check (tokens_mes >= 0),
  add column mes_ref date not null default (date_trunc('month', now()))::date,
  add constraint loja_chaves_ia_provedor_valido check (provedor in ('claude', 'gemini', 'openai', 'deepseek', 'compativel_openai'));

create table public.loja_plugins (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 2 and 60),
  tipo text not null check (tipo in ('mcp', 'api', 'llm', 'plugin_pull')),
  url text check (url is null or url ~ '^https://[^/?#@ ]+(/[^?# ]*)?$'),   -- só https, sem usuário/senha e sem query
  capacidades text[] not null default '{}' check (capacidades <@ array['consultar_bling','enriquecer','imagem','taxonomia','consultar_catalogo','buscar_web']::text[]),
  risco text not null default 'LOW' check (risco in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ativo boolean not null default false,
  ultimo_teste_em timestamptz,
  ultimo_teste_ok boolean,
  removido_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index loja_plugins_nome_unico on public.loja_plugins (loja_id, lower(nome)) where removido_em is null;
create index on public.loja_plugins (loja_id);

create table private.plugin_segredos (
  plugin_id uuid primary key references public.loja_plugins(id) on delete cascade,
  credencial_cifrada text not null
);

alter table public.loja_plugins enable row level security;
revoke all on public.loja_plugins from anon, authenticated;
grant select on public.loja_plugins to authenticated;
grant select, insert, update on public.loja_plugins to service_role;
create policy loja_plugins_ver on public.loja_plugins for select to authenticated
  using (removido_em is null and private.pode_ver_loja(loja_id));
revoke all on private.plugin_segredos from public, anon, authenticated;
grant select, insert, update on private.plugin_segredos to service_role;
grant usage on schema private to service_role;

-- Chave do provedor ---------------------------------------------------------------------------
create function public.ia_salvar_chave(p_loja uuid, p_provedor text, p_cifrada text, p_final text, p_modelo text, p_limite bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.loja_chaves_ia (loja_id, provedor, ativa, modelo, final_chave, limite_mensal_tokens)
  values (p_loja, p_provedor, true, p_modelo, p_final, p_limite)
  on conflict (loja_id, provedor) do update
    set ativa = true, modelo = excluded.modelo, final_chave = excluded.final_chave, limite_mensal_tokens = excluded.limite_mensal_tokens
  returning id into v_id;
  insert into private.chaves_ia_segredos (chave_id, chave_cifrada) values (v_id, p_cifrada)
  on conflict (chave_id) do update set chave_cifrada = excluded.chave_cifrada;
end $$;

-- Só devolve chave ativa; zera o consumo na virada do mês.
create function public.ia_ler_chave(p_loja uuid, p_provedor text)
returns table (cifrada text, modelo text, limite bigint, tokens_mes bigint) language plpgsql security definer set search_path = '' as $$
begin
  update public.loja_chaves_ia set tokens_mes = 0, mes_ref = (date_trunc('month', now()))::date
  where loja_id = p_loja and provedor = p_provedor and mes_ref < (date_trunc('month', now()))::date;
  return query
    select s.chave_cifrada, k.modelo, k.limite_mensal_tokens, k.tokens_mes
    from public.loja_chaves_ia k join private.chaves_ia_segredos s on s.chave_id = k.id
    where k.loja_id = p_loja and k.provedor = p_provedor and k.ativa and s.chave_cifrada <> '';
end $$;

create function public.ia_registrar_uso(p_loja uuid, p_provedor text, p_tokens bigint)
returns void language sql security definer set search_path = '' as $$
  update public.loja_chaves_ia
  set tokens_mes = case when mes_ref < (date_trunc('month', now()))::date then 0 else tokens_mes end + greatest(p_tokens, 0),
      mes_ref = (date_trunc('month', now()))::date, ultimo_uso_em = now()
  where loja_id = p_loja and provedor = p_provedor;
$$;

create function public.ia_desativar_chave(p_loja uuid, p_provedor text)
returns void language sql security definer set search_path = '' as $$
  update private.chaves_ia_segredos s set chave_cifrada = ''
  from public.loja_chaves_ia k where k.id = s.chave_id and k.loja_id = p_loja and k.provedor = p_provedor;
  update public.loja_chaves_ia set ativa = false, final_chave = null where loja_id = p_loja and provedor = p_provedor;
$$;

-- Plugins ---------------------------------------------------------------------------------------
create function public.plugin_salvar(p_loja uuid, p_nome text, p_tipo text, p_url text, p_cifrada text, p_capacidades text[], p_risco text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.loja_plugins where loja_id = p_loja and lower(nome) = lower(p_nome) and removido_em is null;
  if v_id is null then
    insert into public.loja_plugins (loja_id, nome, tipo, url, capacidades, risco)
    values (p_loja, p_nome, p_tipo, p_url, p_capacidades, p_risco) returning id into v_id;
  else
    -- qualquer mudança desliga o plugin: precisa ser reativado de propósito
    update public.loja_plugins set tipo = p_tipo, url = p_url, capacidades = p_capacidades, risco = p_risco, ativo = false,
      ultimo_teste_em = null, ultimo_teste_ok = null where id = v_id;
  end if;
  if p_cifrada is not null then
    insert into private.plugin_segredos (plugin_id, credencial_cifrada) values (v_id, p_cifrada)
    on conflict (plugin_id) do update set credencial_cifrada = excluded.credencial_cifrada;
  end if;
  return v_id;
end $$;

create function public.plugin_definir_ativo(p_loja uuid, p_id uuid, p_ativo boolean)
returns boolean language sql security definer set search_path = '' as $$
  with a as (update public.loja_plugins set ativo = p_ativo where id = p_id and loja_id = p_loja and removido_em is null returning 1)
  select exists (select 1 from a);
$$;

create function public.plugin_remover(p_loja uuid, p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.loja_plugins set ativo = false, removido_em = now() where id = p_id and loja_id = p_loja;
  update private.plugin_segredos s set credencial_cifrada = '' from public.loja_plugins p where p.id = s.plugin_id and p.id = p_id and p.loja_id = p_loja;
$$;

create function public.plugin_credencial(p_loja uuid, p_id uuid)
returns text language sql security definer set search_path = '' as $$
  select s.credencial_cifrada from private.plugin_segredos s join public.loja_plugins p on p.id = s.plugin_id
  where p.id = p_id and p.loja_id = p_loja and p.removido_em is null and s.credencial_cifrada <> '';
$$;

create function public.plugin_marcar_teste(p_loja uuid, p_id uuid, p_ok boolean)
returns void language sql security definer set search_path = '' as $$
  update public.loja_plugins set ultimo_teste_em = now(), ultimo_teste_ok = p_ok where id = p_id and loja_id = p_loja;
$$;

revoke all on function public.ia_salvar_chave(uuid, text, text, text, text, bigint), public.ia_ler_chave(uuid, text),
  public.ia_registrar_uso(uuid, text, bigint), public.ia_desativar_chave(uuid, text),
  public.plugin_salvar(uuid, text, text, text, text, text[], text), public.plugin_definir_ativo(uuid, uuid, boolean),
  public.plugin_remover(uuid, uuid), public.plugin_credencial(uuid, uuid), public.plugin_marcar_teste(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.ia_salvar_chave(uuid, text, text, text, text, bigint), public.ia_ler_chave(uuid, text),
  public.ia_registrar_uso(uuid, text, bigint), public.ia_desativar_chave(uuid, text),
  public.plugin_salvar(uuid, text, text, text, text, text[], text), public.plugin_definir_ativo(uuid, uuid, boolean),
  public.plugin_remover(uuid, uuid), public.plugin_credencial(uuid, uuid), public.plugin_marcar_teste(uuid, uuid, boolean)
  to service_role;
