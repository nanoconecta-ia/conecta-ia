-- Ordem-mestra 16A, desenho aprovado para implementação. Somente SCHEMA.
-- NÃO cria o handler MCP, NÃO registra propostas e NÃO altera Bling.
-- A migração deve ser validada em Postgres DESCARTÁVEL antes de ser aplicada
-- ao Supabase ativo. Não executar este arquivo na produção sem nova autorização.
begin;

create table public.pacote_cadastro (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete restrict,
  produto_id uuid not null,
  bling_id text not null check (length(btrim(bling_id)) between 1 and 80),
  sku_espelho text,
  versao_contrato integer not null default 1 check (versao_contrato = 1),
  idempotency_key text not null check (length(idempotency_key) between 8 and 100),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  snapshot_espelho jsonb not null check (
    jsonb_typeof(snapshot_espelho) = 'object'
    and snapshot_espelho ? 'bling_id'
    and snapshot_espelho ? 'sku'
    and (snapshot_espelho - 'bling_id' - 'sku' - 'gtin' - 'marca' - 'sincronizado_em') = '{}'::jsonb
  ),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  agente text not null check (length(btrim(agente)) between 2 and 120),
  modelo text check (modelo is null or length(modelo) <= 120),
  estado text not null default 'recebido'
    check (estado in ('recebido','pendente_revisao','divergente','cancelado')),
  proposta_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pacote_cadastro_id_loja_unique unique (id, loja_id),
  constraint pacote_cadastro_chave_unique unique (loja_id, idempotency_key),
  constraint pacote_cadastro_proposta_unique unique (proposta_id),
  constraint pacote_cadastro_produto_fk
    foreign key (produto_id, loja_id) references public.produtos(id, loja_id),
  constraint pacote_cadastro_proposta_fk
    foreign key (proposta_id, loja_id) references public.agente_propostas(id, loja_id),
  constraint pacote_cadastro_estado_proposta_check
    check (estado <> 'pendente_revisao' or proposta_id is not null)
);

create table public.pacote_evidencias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  pacote_id uuid not null,
  chave_evidencia text not null check (length(btrim(chave_evidencia)) between 1 and 100),
  classe text not null check (classe in (
    'fabricante_oficial','montadora_oficial','distribuidor_b2b','epc_terceiro',
    'referencia_cruzada','marketplace','ia_terceira','foto_estoque','nota_entrada','outra'
  )),
  url_publica text check (
    url_publica is null or (
      length(url_publica) <= 1500 and
      url_publica ~ '^https://[A-Za-z0-9.-]+(/[^\s#]*)?$' and
      url_publica !~ '@' and
      url_publica !~* '([?&](vin|frame|chassi|chassis|token|access_token|api_key)=)'
    )
  ),
  documento_ref_interno text check (
    documento_ref_interno is null or (
      length(documento_ref_interno) between 9 and 300
      and documento_ref_interno ~ '^(nf|arquivo|drive|bling|storage):[A-Za-z0-9_./-]{3,240}$'
    )
  ),
  trecho text check (trecho is null or length(trecho) <= 1800),
  codigo_exato text check (codigo_exato is null or length(btrim(codigo_exato)) between 1 and 100),
  identidade_emissora text check (identidade_emissora is null or length(identidade_emissora) <= 160),
  dominio_verificado boolean not null default false,
  consultado_em timestamptz not null,
  trecho_hash text check (trecho_hash is null or trecho_hash ~ '^[0-9a-f]{64}$'),
  verificacao text not null default 'candidato'
    check (verificacao in ('candidato','divergente','verificado','rejeitado')),
  verificado_por uuid,
  verificado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint pacote_evidencias_id_loja_unique unique (id, loja_id),
  constraint pacote_evidencias_pacote_chave_unique unique (pacote_id, chave_evidencia),
  constraint pacote_evidencias_pacote_fk
    foreign key (pacote_id, loja_id) references public.pacote_cadastro(id, loja_id) on delete cascade,
  constraint pacote_evidencias_origem_check
    check (url_publica is not null or documento_ref_interno is not null),
  constraint pacote_evidencias_checagem_check
    check (
      verificacao <> 'verificado' or
      (verificado_por is not null and verificado_em is not null
       and (dominio_verificado or documento_ref_interno is not null))
    ),
  constraint pacote_evidencias_codigo_trecho_check
    check (codigo_exato is null or trecho is null or
           position(lower(codigo_exato) in lower(trecho)) > 0)
);

create table public.pacote_blocos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  pacote_id uuid not null,
  tipo text not null check (tipo in (
    'identidade','evidencias','aplicacao','taxonomia','imagem','texto_seo','logistica'
  )),
  chave_bloco text not null check (length(btrim(chave_bloco)) between 1 and 100),
  ordem integer not null check (ordem >= 0),
  estado_fonte text not null default 'a_confirmar'
    check (estado_fonte in ('confirmado_por_fonte','a_confirmar','ausente','divergente')),
  valor_proposto jsonb not null default '{}'::jsonb
    check (jsonb_typeof(valor_proposto) = 'object'),
  evidencia_chaves text[] not null default '{}'::text[]
    check (cardinality(evidencia_chaves) <= 80),
  pendencias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pendencias) = 'array'),
  item_proposta_id uuid,
  criado_em timestamptz not null default now(),
  constraint pacote_blocos_id_loja_unique unique (id, loja_id),
  constraint pacote_blocos_unico unique (pacote_id, tipo, chave_bloco),
  constraint pacote_blocos_pacote_fk
    foreign key (pacote_id, loja_id) references public.pacote_cadastro(id, loja_id) on delete cascade,
  constraint pacote_blocos_item_fk
    foreign key (item_proposta_id, loja_id) references public.agente_proposta_itens(id, loja_id),
  constraint pacote_blocos_fonte_check
    check (estado_fonte <> 'confirmado_por_fonte' or cardinality(evidencia_chaves) > 0)
);

create index pacote_cadastro_fila_idx
  on public.pacote_cadastro (loja_id, estado, criado_em desc);
create index pacote_blocos_lista_idx
  on public.pacote_blocos (loja_id, pacote_id, ordem);
create index pacote_evidencias_lista_idx
  on public.pacote_evidencias (loja_id, pacote_id, consultado_em desc);

-- Verifica a identidade BLING no espelho e impede reescrever o snapshot/hash.
-- Autorizações futuras devem comparar de novo com o Bling vivo antes de executar.
create function private.pacote_cadastro_proteger() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare v_bling text; v_sku text;
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.loja_id, new.produto_id, new.bling_id,
        new.sku_espelho, new.versao_contrato, new.idempotency_key,
        new.payload_hash, new.snapshot_espelho, new.snapshot_hash,
        new.agente, new.modelo, new.criado_em)
       is distinct from
       (old.id, old.loja_id, old.produto_id, old.bling_id,
        old.sku_espelho, old.versao_contrato, old.idempotency_key,
        old.payload_hash, old.snapshot_espelho, old.snapshot_hash,
        old.agente, old.modelo, old.criado_em)
      then raise exception 'pacote_identidade_imutavel' using errcode = '23514';
    end if;
    if old.proposta_id is not null and new.proposta_id is distinct from old.proposta_id then
      raise exception 'pacote_proposta_imutavel' using errcode = '23514';
    end if;
    if old.estado = 'cancelado' and new.estado <> 'cancelado' then
      raise exception 'pacote_cancelado' using errcode = '23514';
    end if;
  end if;
  -- A identidade é conferida na CAPTURA. Em atualizações de estado,
  -- permitir marcar 'divergente' caso o espelho tenha mudado depois.
  -- A futura decisão comparará snapshot_hash/versao novamente.
  if tg_op = 'INSERT' then
    select p.bling_id, p.sku into v_bling, v_sku
      from public.produtos p where p.id = new.produto_id and p.loja_id = new.loja_id;
    if not found or v_bling is distinct from new.bling_id
       or v_sku is distinct from new.sku_espelho
       or new.snapshot_espelho->>'bling_id' is distinct from new.bling_id
       or new.snapshot_espelho->>'sku' is distinct from new.sku_espelho
      then raise exception 'pacote_espelho_bling_divergente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger pacote_cadastro_proteger_t
  before insert or update on public.pacote_cadastro
  for each row execute function private.pacote_cadastro_proteger();

-- Blocos só podem referir evidências DO MESMO pacote e itens da mesma proposta.
create function private.pacote_blocos_proteger() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare v_proposta uuid; v_produto uuid; v_item_proposta uuid; v_item_produto uuid;
begin
  if exists (
    select 1 from unnest(new.evidencia_chaves) as chave
    where not exists (
      select 1 from public.pacote_evidencias e
      where e.pacote_id = new.pacote_id
        and e.loja_id = new.loja_id
        and e.chave_evidencia = chave
    )
  ) then raise exception 'pacote_bloco_evidencia_ausente' using errcode = '23503'; end if;

  if new.item_proposta_id is not null then
    select p.proposta_id,p.produto_id into v_proposta,v_produto
      from public.pacote_cadastro p
      where p.id = new.pacote_id and p.loja_id = new.loja_id;
    select i.proposta_id,i.produto_id into v_item_proposta,v_item_produto
      from public.agente_proposta_itens i
      where i.id = new.item_proposta_id and i.loja_id = new.loja_id;
    if v_proposta is null or v_item_proposta is distinct from v_proposta
       or v_item_produto is distinct from v_produto then
      raise exception 'pacote_bloco_item_proposta_invalido' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;
create trigger pacote_blocos_proteger_t
  before insert or update on public.pacote_blocos
  for each row execute function private.pacote_blocos_proteger();

-- Imutabilidade da EVIDÊNCIA: somente os campos de revisão podem mudar.
create function private.pacote_evidencias_proteger() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (new.id,new.loja_id,new.pacote_id,new.chave_evidencia,new.classe,
      new.url_publica,new.documento_ref_interno,new.trecho,new.codigo_exato,
      new.identidade_emissora,new.consultado_em,new.trecho_hash,new.criado_em)
     is distinct from
     (old.id,old.loja_id,old.pacote_id,old.chave_evidencia,old.classe,
      old.url_publica,old.documento_ref_interno,old.trecho,old.codigo_exato,
      old.identidade_emissora,old.consultado_em,old.trecho_hash,old.criado_em)
    then raise exception 'pacote_evidencia_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pacote_evidencias_proteger_t
  before update on public.pacote_evidencias
  for each row execute function private.pacote_evidencias_proteger();

-- A Data API não expõe por padrão tabelas novas: conceder SELECT explícito
-- só ao authenticated autorizado; acesso por loja depende de RLS também.
alter table public.pacote_cadastro enable row level security;
alter table public.pacote_blocos enable row level security;
alter table public.pacote_evidencias enable row level security;
create policy pacote_cadastro_admin_ler on public.pacote_cadastro
  for select to authenticated
  using ((select auth.uid()) is not null
         and public.pode_administrar_loja(loja_id));
create policy pacote_blocos_admin_ler on public.pacote_blocos
  for select to authenticated
  using ((select auth.uid()) is not null
         and public.pode_administrar_loja(loja_id));
create policy pacote_evidencias_admin_ler on public.pacote_evidencias
  for select to authenticated
  using ((select auth.uid()) is not null
         and public.pode_administrar_loja(loja_id));

revoke all on public.pacote_cadastro,public.pacote_blocos,public.pacote_evidencias
  from public,anon,authenticated;
grant select on public.pacote_cadastro,public.pacote_blocos,public.pacote_evidencias
  to authenticated;
grant all on public.pacote_cadastro,public.pacote_blocos,public.pacote_evidencias
  to service_role;
revoke all on function private.pacote_cadastro_proteger(),
  private.pacote_blocos_proteger(),private.pacote_evidencias_proteger()
  from public,anon,authenticated;

comment on table public.pacote_cadastro is
  'Envelope administrativo por produto/ID Bling; NÃO aprova nem executa o cadastro, não altera estoque/fiscal.';
comment on table public.pacote_blocos is
  'Blocos de proposta e pendências, vinculados ao produto e ao motor de aprovação existente.';
comment on table public.pacote_evidencias is
  'Referências técnicas e documentais de revisão; conteúdo privado, não homologação automática de OEM ou foto.';

commit;
