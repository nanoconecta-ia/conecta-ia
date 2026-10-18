-- Vários provedores de IA por loja (Claude, Gemini, compatível com OpenAI/Llama) com um "principal".
-- base_url só para o tipo compatível com OpenAI (https público; validado também no servidor).
alter table public.loja_chaves_ia
  add column base_url text check (base_url is null or base_url ~ '^https://[^/?#@ ]+(/[^?# ]*)?$'),
  add column principal boolean not null default false;
create unique index loja_chaves_ia_um_principal on public.loja_chaves_ia (loja_id) where principal;
alter table public.loja_chaves_ia drop constraint loja_chaves_ia_provedor_valido;
alter table public.loja_chaves_ia add constraint loja_chaves_ia_provedor_valido
  check (provedor in ('claude', 'gemini', 'compativel_openai', 'openai', 'deepseek'));

-- Substitui a versão de 6 argumentos: agora recebe base_url. O primeiro provedor salvo vira o principal.
drop function public.ia_salvar_chave(uuid, text, text, text, text, bigint);
create function public.ia_salvar_chave(p_loja uuid, p_provedor text, p_cifrada text, p_final text, p_modelo text, p_limite bigint, p_base_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tem boolean;
begin
  select exists (select 1 from public.loja_chaves_ia where loja_id = p_loja and principal and ativa and provedor <> p_provedor) into v_tem;
  insert into public.loja_chaves_ia (loja_id, provedor, ativa, modelo, final_chave, limite_mensal_tokens, base_url, principal)
  values (p_loja, p_provedor, true, p_modelo, p_final, p_limite, p_base_url, not v_tem)
  on conflict (loja_id, provedor) do update
    set ativa = true, modelo = excluded.modelo, final_chave = excluded.final_chave, limite_mensal_tokens = excluded.limite_mensal_tokens,
        base_url = excluded.base_url, principal = public.loja_chaves_ia.principal or not v_tem
  returning id into v_id;
  insert into private.chaves_ia_segredos (chave_id, chave_cifrada) values (v_id, p_cifrada)
  on conflict (chave_id) do update set chave_cifrada = excluded.chave_cifrada;
end $$;

-- Chave ativa: a do provedor pedido, ou (sem pedido) a principal, ou qualquer ativa. Zera o consumo na virada do mês.
create function public.ia_chave_ativa(p_loja uuid, p_provedor text default null)
returns table (provedor text, cifrada text, modelo text, limite bigint, tokens_mes bigint, base_url text)
language plpgsql security definer set search_path = '' as $$
begin
  update public.loja_chaves_ia set tokens_mes = 0, mes_ref = (date_trunc('month', now()))::date
  where loja_id = p_loja and mes_ref < (date_trunc('month', now()))::date;
  return query
    select k.provedor, s.chave_cifrada, k.modelo, k.limite_mensal_tokens, k.tokens_mes, k.base_url
    from public.loja_chaves_ia k join private.chaves_ia_segredos s on s.chave_id = k.id
    where k.loja_id = p_loja and k.ativa and s.chave_cifrada <> '' and (p_provedor is null or k.provedor = p_provedor)
    order by k.principal desc, k.criado_em limit 1;
end $$;

create function public.ia_definir_principal(p_loja uuid, p_provedor text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.loja_chaves_ia where loja_id = p_loja and provedor = p_provedor and ativa) then return false; end if;
  update public.loja_chaves_ia set principal = (provedor = p_provedor) where loja_id = p_loja and (principal or provedor = p_provedor);
  return true;
end $$;

-- Ao desativar o principal, o provedor ativo mais antigo assume (se houver).
create or replace function public.ia_desativar_chave(p_loja uuid, p_provedor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update private.chaves_ia_segredos s set chave_cifrada = ''
  from public.loja_chaves_ia k where k.id = s.chave_id and k.loja_id = p_loja and k.provedor = p_provedor;
  update public.loja_chaves_ia set ativa = false, final_chave = null, principal = false where loja_id = p_loja and provedor = p_provedor;
  if not exists (select 1 from public.loja_chaves_ia where loja_id = p_loja and principal) then
    update public.loja_chaves_ia set principal = true
    where id = (select id from public.loja_chaves_ia where loja_id = p_loja and ativa order by criado_em limit 1);
  end if;
end $$;

revoke all on function public.ia_salvar_chave(uuid, text, text, text, text, bigint, text), public.ia_chave_ativa(uuid, text),
  public.ia_definir_principal(uuid, text), public.ia_desativar_chave(uuid, text) from public, anon, authenticated;
grant execute on function public.ia_salvar_chave(uuid, text, text, text, text, bigint, text), public.ia_chave_ativa(uuid, text),
  public.ia_definir_principal(uuid, text), public.ia_desativar_chave(uuid, text) to service_role;
