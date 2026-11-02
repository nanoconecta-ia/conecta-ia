-- Atividade do agente externo (MCP) no chat do Nano. Desenho aprovado pelo dono em 2026-11-02 (retenção 90 dias).
-- Imutável: sem UPDATE; DELETE só de linhas com mais de 90 dias (limpeza). Escrita só pelo service_role (gateway).
create table public.agente_atividades (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  mcp_chave_id uuid,
  origem text not null check (origem in ('gateway_mcp')),
  tipo text not null check (tipo in ('consulta', 'proposta', 'resumo', 'recusa')),
  ferramenta text check (ferramenta is null or char_length(ferramenta) <= 80),
  produto_id uuid,
  proposta_id uuid,
  resumo text check (resumo is null or char_length(resumo) <= 600),
  criado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id),
  foreign key (proposta_id, loja_id) references public.agente_propostas (id, loja_id)
);
create index on public.agente_atividades (loja_id, criado_em desc);

create function private.agente_atividades_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then raise exception 'agente_atividades é imutável' using errcode = 'check_violation'; end if;
  if tg_op = 'DELETE' and old.criado_em > now() - interval '90 days' then
    raise exception 'agente_atividades só pode ser apagada após 90 dias' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
create trigger agente_atividades_imutavel before update or delete on public.agente_atividades
  for each row execute function private.agente_atividades_imutavel();

alter table public.agente_atividades enable row level security;
revoke all on public.agente_atividades from anon, authenticated;
grant select on public.agente_atividades to authenticated;
grant select, insert, delete on public.agente_atividades to service_role;
create policy agente_atividades_ver on public.agente_atividades for select to authenticated using (private.pode_ver_loja(loja_id));
