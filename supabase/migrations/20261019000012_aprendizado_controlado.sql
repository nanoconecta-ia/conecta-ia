-- Aprendizagem controlada: o agente PROPÕE regras aprendidas; só o lojista ativa. Toda regra tem versão, procedência e pode ser REVERTIDA.
-- Barreiras no banco: (1) o agente não consegue criar regra de escopo fiscal, de segurança ou de aplicação técnica (o escopo nem existe);
-- (2) o valor da regra não pode conter chaves fiscais, de permissão, de preço ou de aplicação; (3) o conteúdo de uma regra é imutável (muda-se por nova versão);
-- (4) aplicações/cruzados/peças já APROVADOS não são alterados nem apagados por quem opera o agente (só rebaixados para "desatualizado").
create table public.aprendizado_regras (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  escopo text not null check (escopo in ('sinonimo_termo', 'regra_classificacao', 'padrao_extracao', 'fonte_confiavel')),
  chave text not null check (char_length(btrim(chave)) between 2 and 120),
  valor jsonb not null,
  versao int not null check (versao >= 1),
  status text not null default 'proposta' check (status in ('proposta', 'ativa', 'substituida', 'revertida', 'rejeitada')),
  origem text not null check (origem in ('correcao_aprovada', 'fonte_verificada', 'observacao_agente')),
  fonte text not null check (char_length(btrim(fonte)) >= 3),                 -- sem procedência não entra
  proposto_por text not null check (proposto_por in ('agente', 'pessoa')),
  substitui_id uuid references public.aprendizado_regras(id),
  aprovado_por uuid, aprovado_em timestamptz,
  revertido_por uuid, revertido_em timestamptz, motivo_reversao text,
  criado_em timestamptz not null default now(),
  check (status <> 'ativa' or (aprovado_por is not null and aprovado_em is not null)),
  check (status <> 'revertida' or (revertido_por is not null and revertido_em is not null and motivo_reversao is not null)),
  unique (loja_id, escopo, chave, versao)
);
create unique index aprendizado_uma_ativa on public.aprendizado_regras (loja_id, escopo, chave) where status = 'ativa';

create function private.aprendizado_valor_seguro(v jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text; e jsonb;
begin
  if jsonb_typeof(v) = 'object' then
    for k, e in select key, value from jsonb_each(v) loop
      if lower(k) = any (array['ncm', 'cest', 'cst', 'cfop', 'icms', 'pis', 'cofins', 'ipi', 'aliquota', 'tributo', 'fiscal', 'politica', 'permissao', 'permissoes', 'escopo', 'escopos',
        'papel', 'role', 'risco', 'aprovado', 'aprovacao', 'aplicacao', 'aplicacoes', 'compatibilidade', 'preco', 'custo', 'estoque', 'homologacao']) then return false; end if;
      if not private.aprendizado_valor_seguro(e) then return false; end if;
    end loop;
  elsif jsonb_typeof(v) = 'array' then
    for e in select value from jsonb_array_elements(v) loop
      if not private.aprendizado_valor_seguro(e) then return false; end if;
    end loop;
  end if;
  return true;
end $$;

create function private.aprendizado_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'regras aprendidas não são apagadas: reverta' using errcode = '42501'; end if;
  if (new.loja_id, new.escopo, new.chave, new.valor, new.versao, new.origem, new.fonte, new.proposto_por, new.substitui_id, new.criado_em)
     is distinct from (old.loja_id, old.escopo, old.chave, old.valor, old.versao, old.origem, old.fonte, old.proposto_por, old.substitui_id, old.criado_em) then
    raise exception 'o conteúdo de uma regra é imutável: proponha uma nova versão' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger aprendizado_imutavel before update or delete on public.aprendizado_regras for each row execute function private.aprendizado_imutavel();

create function public.aprendizado_propor(p_loja uuid, p_escopo text, p_chave text, p_valor jsonb, p_origem text, p_fonte text, p_por text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_versao int;
begin
  if not private.aprendizado_valor_seguro(p_valor) then raise exception 'valor contém campo fiscal, de permissão, preço ou aplicação: não pode ser aprendido' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('aprendizado:' || p_loja::text || p_escopo || lower(p_chave), 0));
  select coalesce(max(versao), 0) + 1 into v_versao from public.aprendizado_regras where loja_id = p_loja and escopo = p_escopo and chave = lower(btrim(p_chave));
  insert into public.aprendizado_regras (loja_id, escopo, chave, valor, versao, origem, fonte, proposto_por)
    values (p_loja, p_escopo, lower(btrim(p_chave)), p_valor, v_versao, p_origem, p_fonte, p_por) returning id into v_id;
  return v_id;
end $$;

create function public.aprendizado_ativar(p_loja uuid, p_id uuid, p_user uuid) returns int language plpgsql security definer set search_path = '' as $$
declare r public.aprendizado_regras; v_anterior uuid;
begin
  if not private.pipeline_e_lojista(p_loja, p_user) then raise exception 'só o lojista ativa regra aprendida' using errcode = '42501'; end if;
  select * into r from public.aprendizado_regras where id = p_id and loja_id = p_loja for update;
  if not found then raise exception 'regra inexistente nesta loja' using errcode = 'P0002'; end if;
  if r.status <> 'proposta' then raise exception 'só proposta pode ser ativada (estado atual: %)', r.status using errcode = '22023'; end if;
  select id into v_anterior from public.aprendizado_regras where loja_id = p_loja and escopo = r.escopo and chave = r.chave and status = 'ativa';
  if v_anterior is not null then update public.aprendizado_regras set status = 'substituida' where id = v_anterior; end if;
  update public.aprendizado_regras set status = 'ativa', aprovado_por = p_user, aprovado_em = now() where id = p_id;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (p_loja, p_user, 'aprendizado.ativado', 'aprendizado_regras', jsonb_build_object('regra_id', p_id, 'escopo', r.escopo, 'chave', r.chave, 'versao', r.versao, 'substitui', v_anterior));
  return r.versao;
end $$;

-- reverter: a versão ativa volta a "revertida" e a ANTERIOR (a mais recente substituída) volta a valer; sem anterior, valem só as regras-base
create function public.aprendizado_reverter(p_loja uuid, p_id uuid, p_user uuid, p_motivo text) returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.aprendizado_regras; v_prev uuid;
begin
  if not private.pipeline_e_lojista(p_loja, p_user) then raise exception 'só o lojista reverte regra aprendida' using errcode = '42501'; end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 3 then raise exception 'motivo da reversão obrigatório' using errcode = '22023'; end if;
  select * into r from public.aprendizado_regras where id = p_id and loja_id = p_loja for update;
  if not found then raise exception 'regra inexistente nesta loja' using errcode = 'P0002'; end if;
  if r.status <> 'ativa' then raise exception 'só regra ativa pode ser revertida (estado atual: %)', r.status using errcode = '22023'; end if;
  update public.aprendizado_regras set status = 'revertida', revertido_por = p_user, revertido_em = now(), motivo_reversao = p_motivo where id = p_id;
  select id into v_prev from public.aprendizado_regras where loja_id = p_loja and escopo = r.escopo and chave = r.chave and status = 'substituida' and versao < r.versao order by versao desc limit 1;
  if v_prev is not null then update public.aprendizado_regras set status = 'ativa' where id = v_prev; end if;
  insert into public.auditoria (loja_id, user_id, acao, tabela, depois) values (p_loja, p_user, 'aprendizado.revertido', 'aprendizado_regras', jsonb_build_object('regra_id', p_id, 'motivo', p_motivo, 'restaurada', v_prev));
  return v_prev;
end $$;

create function public.aprendizado_rejeitar(p_loja uuid, p_id uuid, p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pipeline_e_lojista(p_loja, p_user) then raise exception 'só o lojista rejeita regra aprendida' using errcode = '42501'; end if;
  update public.aprendizado_regras set status = 'rejeitada' where id = p_id and loja_id = p_loja and status = 'proposta';
  if not found then raise exception 'proposta inexistente nesta loja' using errcode = 'P0002'; end if;
end $$;

create function public.aprendizado_ativas(p_loja uuid, p_escopo text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'chave', chave, 'valor', valor, 'versao', versao, 'fonte', fonte) order by chave), '[]'::jsonb)
  from public.aprendizado_regras where loja_id = p_loja and escopo = p_escopo and status = 'ativa'
$$;

-- (4) registros aprovados do catálogo técnico: quem opera o agente não altera nem apaga; só rebaixa para "desatualizado" (pede nova revisão).
-- Uma revisão humana de registro aprovado roda numa transação própria com:  set local conecta.revisao_humana = 'sim';  e fica registrada.
create function private.protege_aprovado() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('conecta.revisao_humana', true) = 'sim' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.status = 'aprovado' then raise exception 'registro aprovado não é apagado automaticamente (%): peça revisão humana', tg_table_name using errcode = '42501'; end if;
    return old;
  end if;
  if old.status = 'desatualizado' and new.status = 'aprovado' then
    raise exception 'registro desatualizado não volta a "aprovado" automaticamente (%): peça revisão humana', tg_table_name using errcode = '42501';
  end if;
  if old.status = 'aprovado' then
    if new.status = 'desatualizado' and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;   -- rebaixar é seguro
    raise exception 'registro aprovado não é alterado automaticamente (%): peça revisão humana', tg_table_name using errcode = '42501';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['pecas_aplicacoes_tecnicas', 'ref_cruzada', 'pecas_ref', 'versao_motor', 'fornecedores_oem', 'eventos_veiculo'] loop
    execute format('create trigger protege_aprovado before update or delete on public.%I for each row execute function private.protege_aprovado()', t);
  end loop;
end $$;

alter table public.aprendizado_regras enable row level security;
revoke all on public.aprendizado_regras from anon, authenticated;
grant select, insert, update, delete on public.aprendizado_regras to service_role;
grant select on public.aprendizado_regras to authenticated;
create policy aprendizado_regras_ver on public.aprendizado_regras for select to authenticated using (private.pode_ver_loja(loja_id));
revoke all on function public.aprendizado_propor(uuid, text, text, jsonb, text, text, text), public.aprendizado_ativar(uuid, uuid, uuid), public.aprendizado_reverter(uuid, uuid, uuid, text),
  public.aprendizado_rejeitar(uuid, uuid, uuid), public.aprendizado_ativas(uuid, text) from public, anon, authenticated;
grant execute on function public.aprendizado_propor(uuid, text, text, jsonb, text, text, text), public.aprendizado_ativar(uuid, uuid, uuid), public.aprendizado_reverter(uuid, uuid, uuid, text),
  public.aprendizado_rejeitar(uuid, uuid, uuid), public.aprendizado_ativas(uuid, text) to service_role;
