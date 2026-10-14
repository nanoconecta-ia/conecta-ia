-- Migração 13: dados fiscais por produto (NCM/CEST/CST/origem), regime da loja, tabelas oficiais versionadas
-- e log fiscal imutável. Regras: NCM vindo da nota do fabricante é intocável; CEST sai de tabela oficial
-- (nunca de palpite); sugestão do agente fica "a_confirmar" até o contador validar; nada é gravado no Bling
-- nem publicado sem validação. Escrita só pelo servidor (service_role).

-- 1) Regime e dados fiscais da loja (UF e CNPJ vêm de fonte pública; o regime é declarado pelo lojista/contador).
create table public.loja_fiscal (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9A-Z]{14}$'),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  regime text check (regime in ('simples', 'presumido', 'real', 'mei')),
  cnae_principal text,
  regime_declarado_em timestamptz,
  validado_por text,                                   -- contador do cliente
  validado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  check (validado_em is null or (validado_por is not null and regime is not null and uf is not null))
);

-- 2) Tabelas oficiais versionadas (NCM/TIPI, CEST, regras por UF), sempre com fonte, vigência e hash do arquivo.
create table public.ref_versoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null check (tabela in ('ncm', 'cest', 'regras_uf')),
  fonte text not null,                                 -- URL/documento oficial
  versao text not null,
  vigencia_ini date not null,
  vigencia_fim date,
  hash_arquivo text,
  carregada_em timestamptz not null default now(),
  ativa boolean not null default false,
  check (vigencia_fim is null or vigencia_fim >= vigencia_ini),
  unique (tabela, versao)
);
create unique index ref_versao_ativa on public.ref_versoes (tabela) where ativa;

create table public.ref_ncm (
  versao_id uuid not null references public.ref_versoes(id) on delete cascade,
  codigo text not null check (codigo ~ '^[0-9]{8}$'),
  descricao text not null,
  primary key (versao_id, codigo)
);
create table public.ref_cest (
  versao_id uuid not null references public.ref_versoes(id) on delete cascade,
  cest text not null check (cest ~ '^[0-9]{7}$'),
  ncm_prefixo text not null check (ncm_prefixo ~ '^[0-9]{4,8}$'),
  segmento text not null,
  anexo text not null,
  item text not null,                                  -- item de origem no anexo, para conferência
  descricao text,
  ambiguo boolean not null default false,              -- mesmo NCM com CEST diferente: não resolve sozinho
  primary key (versao_id, cest, ncm_prefixo)
);
create table public.ref_regras_uf (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.ref_versoes(id) on delete cascade,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  ncm_prefixo text check (ncm_prefixo ~ '^[0-9]{4,8}$'),
  cest text check (cest ~ '^[0-9]{7}$'),
  tipo text not null,                                  -- ex.: st, antecipacao, difal (nomes a definir ao carregar)
  parametros jsonb not null default '{}',
  norma text not null check (length(btrim(norma)) > 0),    -- portaria/decreto/convênio com número
  trecho text not null check (length(btrim(trecho)) > 0),  -- trecho exato da norma
  vigencia_ini date not null,
  vigencia_fim date,
  check (vigencia_fim is null or vigencia_fim >= vigencia_ini)
);
create index on public.ref_regras_uf (uf, ncm_prefixo);

-- 3) Fiscal do produto.
create table public.produto_fiscal (
  produto_id uuid primary key,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  ncm text check (ncm is null or ncm ~ '^[0-9]{8}$'),
  cest text check (cest is null or cest ~ '^[0-9]{7}$'),
  cst text,
  origem text,                                         -- origem da mercadoria (0-8)
  origem_ncm text not null check (origem_ncm in ('nota_fabricante', 'agente', 'manual')),
  regra_aplicada text,
  fonte text,
  versao_tabela text,
  justificativa text,                                  -- obrigatória quando o agente sugere
  confianca numeric(3,2) check (confianca between 0 and 1),
  status text not null default 'a_confirmar' check (status in ('a_confirmar', 'validado', 'rejeitado')),
  validado_por text,
  validado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  check (origem_ncm <> 'agente' or (regra_aplicada is not null and fonte is not null and justificativa is not null)),
  check (status <> 'validado' or (validado_por is not null and validado_em is not null and ncm is not null))
);

-- NCM que veio na nota do fabricante é intocável.
create function private.protege_ncm_nota() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.origem_ncm = 'nota_fabricante' and (new.ncm is distinct from old.ncm or new.origem_ncm is distinct from old.origem_ncm) then
    raise exception 'NCM da nota do fabricante não pode ser alterado' using errcode = 'check_violation';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger fiscal_protege_ncm before update on public.produto_fiscal
  for each row execute function private.protege_ncm_nota();

-- 4) Log fiscal imutável, preenchido automaticamente a cada mudança de NCM/CEST/CST/origem.
create table public.fiscal_log (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  loja_id uuid not null,
  produto_id uuid not null,
  campo text not null,
  antes text,
  depois text,
  origem_ncm text,
  regra text,
  fonte text,
  versao_tabela text,
  por text
);
create index on public.fiscal_log (loja_id, produto_id, quando desc);
create trigger fiscal_log_imutavel before update or delete on public.fiscal_log
  for each row execute function private.auditoria_imutavel();

create function private.registra_fiscal_log() returns trigger language plpgsql security definer set search_path = '' as $$
declare c text; a text; d text;
begin
  foreach c in array array['ncm', 'cest', 'cst', 'origem'] loop
    a := case when tg_op = 'UPDATE' then to_jsonb(old) ->> c end;
    d := to_jsonb(new) ->> c;
    if a is distinct from d then
      insert into public.fiscal_log (loja_id, produto_id, campo, antes, depois, origem_ncm, regra, fonte, versao_tabela, por)
      values (new.loja_id, new.produto_id, c, a, d, new.origem_ncm, new.regra_aplicada, new.fonte, new.versao_tabela,
              coalesce(new.validado_por, new.origem_ncm));
    end if;
  end loop;
  return new;
end $$;
create trigger fiscal_registra_log after insert or update on public.produto_fiscal
  for each row execute function private.registra_fiscal_log();

-- 5) RLS e grants.
alter table public.loja_fiscal enable row level security;
alter table public.ref_versoes enable row level security;
alter table public.ref_ncm enable row level security;
alter table public.ref_cest enable row level security;
alter table public.ref_regras_uf enable row level security;
alter table public.produto_fiscal enable row level security;
alter table public.fiscal_log enable row level security;
create policy loja_fiscal_ver on public.loja_fiscal for select to authenticated using (private.pode_ver_loja(loja_id));
create policy ref_versoes_ver on public.ref_versoes for select to authenticated using (true);
create policy ref_ncm_ver on public.ref_ncm for select to authenticated using (true);
create policy ref_cest_ver on public.ref_cest for select to authenticated using (true);
create policy ref_regras_ver on public.ref_regras_uf for select to authenticated using (true);
create policy prod_fiscal_ver on public.produto_fiscal for select to authenticated using (private.pode_ver_loja(loja_id));
create policy fiscal_log_ver on public.fiscal_log for select to authenticated using (private.pode_ver_loja(loja_id));
-- Público: só NCM/CEST VALIDADOS de produto publicado.
create policy prod_fiscal_publico on public.produto_fiscal for select to anon
  using (status = 'validado' and private.loja_ativa(loja_id)
         and exists (select 1 from public.produtos p where p.id = produto_id and p.publicado));

grant select on public.loja_fiscal, public.ref_versoes, public.ref_ncm, public.ref_cest, public.ref_regras_uf,
  public.produto_fiscal, public.fiscal_log to authenticated;
grant select (produto_id, loja_id, ncm, cest, status) on public.produto_fiscal to anon;
grant select, insert, update, delete on public.loja_fiscal, public.ref_versoes, public.ref_ncm, public.ref_cest,
  public.ref_regras_uf, public.produto_fiscal to service_role;
grant select, insert on public.fiscal_log to service_role;
