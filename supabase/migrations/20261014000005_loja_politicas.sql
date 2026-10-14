-- Migração 11: políticas e dados da empresa por loja (garantia/CDC, troca e devolução, entrega, privacidade,
-- termos). Rascunho até o lojista aprovar; o público só lê o aprovado. Textos são do lojista (revisão jurídica
-- dele); o sistema não presume prazos de fabricante.

create table public.loja_politicas (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  razao_social text,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9A-Z]{14}$'),     -- 14 posições (aceita CNPJ alfanumérico)
  endereco text,
  telefone text,
  email_contato text,
  garantia_legal_dias int not null default 90 check (garantia_legal_dias >= 30),  -- 90 durável; 30 não durável
  arrependimento_dias int not null default 7 check (arrependimento_dias >= 7),    -- compra à distância
  garantia_texto text,
  troca_devolucao_texto text,
  entrega_texto text,
  privacidade_texto text,
  termos_texto text,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovada')),
  revisado_por text,                              -- quem revisou juridicamente (nome livre); interno
  revisado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  -- política aprovada precisa de dados da empresa, textos essenciais e registro da revisão
  check (status <> 'aprovada' or (
    razao_social is not null and cnpj is not null and endereco is not null and
    (telefone is not null or email_contato is not null) and
    garantia_texto is not null and troca_devolucao_texto is not null and
    entrega_texto is not null and privacidade_texto is not null and revisado_em is not null))
);

create or replace function private.toca_atualizado_em() returns trigger language plpgsql
set search_path = '' as $$ begin new.atualizado_em := now(); return new; end $$;
create trigger politicas_atualizado before update on public.loja_politicas
  for each row execute function private.toca_atualizado_em();
create trigger politicas_auditoria after insert or update or delete on public.loja_politicas
  for each row execute function private.auditar_regra();

alter table public.loja_politicas enable row level security;
create policy politicas_lojista on public.loja_politicas for all to authenticated
  using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id));
create policy politicas_publicas on public.loja_politicas for select to anon
  using (status = 'aprovada' and private.loja_ativa(loja_id));

grant select, insert, update on public.loja_politicas to authenticated;
-- Público: só o aprovado e sem dados internos (quem revisou).
grant select (loja_id, razao_social, cnpj, endereco, telefone, email_contato, garantia_legal_dias,
              arrependimento_dias, garantia_texto, troca_devolucao_texto, entrega_texto,
              privacidade_texto, termos_texto, status, atualizado_em)
  on public.loja_politicas to anon;
grant select, insert, update, delete on public.loja_politicas to service_role;
