-- Migração 15: notificações ao lojista, documentos de referência (tabelas oficiais anexadas) e validação do contador
-- por WhatsApp (fica EM ESPERA até a resposta). O número do contador é cadastrado pelo lojista dentro da plataforma.

-- 1) Contador da loja (contato privado: nunca público).
create table public.loja_contador (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  whatsapp text not null check (whatsapp ~ '^55[0-9]{10,11}$'),     -- 55 + DDD + número
  email text,
  atualizado_em timestamptz not null default now()
);
create trigger contador_auditoria after insert or update or delete on public.loja_contador
  for each row execute function private.auditar_regra();

-- 2) Notificações (ex.: "falta a tabela X; baixe no site oficial e anexe").
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  chave text not null,                                    -- idempotência: não duplicar o mesmo aviso
  tipo text not null check (tipo in ('tabela_faltando', 'validacao_contador', 'regra_nova', 'aprovacao', 'sistema')),
  severidade text not null default 'info' check (severidade in ('info', 'atencao', 'bloqueio')),
  titulo text not null,
  corpo text,
  fonte_url text,                                         -- onde baixar (site oficial)
  criada_em timestamptz not null default now(),
  lida_em timestamptz,
  resolvida_em timestamptz,
  unique (loja_id, chave)
);
create index on public.notificacoes (loja_id, resolvida_em, criada_em desc);

-- 3) Documentos de referência anexados pelo lojista; o agente estuda e propõe regras (sempre citando norma e trecho).
create table public.documentos_referencia (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  tabela text not null check (tabela in ('ncm', 'cest', 'regras_uf', 'outro')),
  nome_arquivo text not null,
  storage_path text not null,                             -- arquivo em storage privado da loja
  hash_arquivo text,
  fonte_oficial text,                                     -- URL/órgão de onde foi baixado
  enviado_por uuid,
  enviado_em timestamptz not null default now(),
  status text not null default 'enviado' check (status in ('enviado', 'em_estudo', 'aplicado', 'rejeitado')),
  observacao text
);
create index on public.documentos_referencia (loja_id, status);

-- 4) Validação do contador: mensagem pronta para WhatsApp; fica em espera até responder.
create table public.validacoes_contador (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid,
  tipo text not null check (tipo in ('ncm', 'cest', 'regime', 'regra_uf', 'outro')),
  resumo text not null,
  mensagem text not null,                                 -- texto que vai no link do WhatsApp
  contador_nome text,
  contador_whatsapp text,
  status text not null default 'em_espera' check (status in ('em_espera', 'confirmada', 'rejeitada', 'expirada')),
  criada_em timestamptz not null default now(),
  enviada_em timestamptz,
  respondida_em timestamptz,
  resposta text,
  foreign key (produto_id, loja_id) references public.produtos(id, loja_id) on delete cascade,
  check (status not in ('confirmada', 'rejeitada') or respondida_em is not null)
);
create index on public.validacoes_contador (loja_id, status);

alter table public.loja_contador enable row level security;
alter table public.notificacoes enable row level security;
alter table public.documentos_referencia enable row level security;
alter table public.validacoes_contador enable row level security;
create policy contador_lojista on public.loja_contador for all to authenticated
  using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id));
create policy notif_ver on public.notificacoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy notif_marcar on public.notificacoes for update to authenticated
  using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id));
create policy docs_ver on public.documentos_referencia for select to authenticated using (private.pode_ver_loja(loja_id));
create policy valid_ver on public.validacoes_contador for select to authenticated using (private.pode_ver_loja(loja_id));

grant select, insert, update on public.loja_contador to authenticated;
grant select on public.notificacoes, public.documentos_referencia, public.validacoes_contador to authenticated;
grant update (lida_em, resolvida_em) on public.notificacoes to authenticated;      -- só marcar como lida/resolvida
grant select, insert, update, delete on public.loja_contador, public.notificacoes, public.documentos_referencia,
  public.validacoes_contador to service_role;
