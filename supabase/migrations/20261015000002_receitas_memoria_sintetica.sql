-- Migração 19: receitas (memória sintética do agente de cadastro).
-- Receita = MÉTODO (onde pesquisar, em que ordem, o que exigir), nunca dado. Global e versionada;
-- a loja só corrige a própria execução. Correção só vira receita nova depois de revisão do super admin.
-- Nenhuma receita aprova dado: aprovar continua sendo do lojista, na fila.

create table public.receitas (
  id uuid primary key default gen_random_uuid(),
  perfil_ramo text not null references public.perfis_ramo(codigo),
  codigo text not null check (codigo ~ '^[a-z0-9_]{2,60}$'),
  versao int not null default 1 check (versao >= 1),
  nome text not null check (length(btrim(nome)) > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'aposentada')),
  taxonomia_no_id uuid references public.taxonomia_nos(id),
  gatilho jsonb not null default '{}'::jsonb check (jsonb_typeof(gatilho) = 'object'),
  passos jsonb not null check (jsonb_typeof(passos) = 'array' and jsonb_array_length(passos) > 0),
  campos_exigidos text[] not null default '{}',
  substitui_id uuid references public.receitas(id),
  criada_em timestamptz not null default now(),
  unique (perfil_ramo, codigo, versao)
);
-- no máximo uma versão ativa por receita
create unique index receitas_uma_ativa on public.receitas (perfil_ramo, codigo) where status = 'ativa';

-- Versões são imutáveis: só o status pode mudar (nova versão = nova linha).
create function private.receita_imutavel() returns trigger language plpgsql
set search_path = '' as $$
begin
  if (new.perfil_ramo, new.codigo, new.versao, new.nome, new.taxonomia_no_id, new.gatilho, new.passos, new.campos_exigidos, new.substitui_id)
     is distinct from
     (old.perfil_ramo, old.codigo, old.versao, old.nome, old.taxonomia_no_id, old.gatilho, old.passos, old.campos_exigidos, old.substitui_id) then
    raise exception 'receita % v% é imutável: crie uma nova versão', old.codigo, old.versao using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.receita_imutavel() from public;
create trigger receitas_imutavel before update on public.receitas
  for each row execute function private.receita_imutavel();

create table public.receita_execucoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  receita_id uuid not null references public.receitas(id) on delete restrict,
  receita_faltando boolean not null default false,       -- usou a genérica por não haver receita para o gatilho
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  resultado text not null default 'em_andamento' check (resultado in ('em_andamento', 'sucesso', 'parcial', 'falhou')),
  campos_preenchidos text[] not null default '{}',
  campos_vazios text[] not null default '{}',
  erro text,
  custo_tokens int check (custo_tokens >= 0),            -- custo de IA por loja; provedor não é exposto ao lojista
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  check ((resultado = 'em_andamento') = (concluida_em is null)),
  unique (loja_id, idempotency_key)
);
create index on public.receita_execucoes (loja_id, produto_id);
create index on public.receita_execucoes (receita_id);

create table public.receita_correcoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  execucao_id uuid not null references public.receita_execucoes(id) on delete cascade,
  campo text not null check (length(btrim(campo)) > 0),
  valor_proposto text,
  valor_final text,
  motivo text,
  status text not null default 'proposta' check (status in ('proposta', 'candidata', 'promovida', 'descartada')),
  decidida_em timestamptz,
  criada_em timestamptz not null default now(),
  check (valor_proposto is distinct from valor_final),
  check ((status in ('promovida', 'descartada')) = (decidida_em is not null))
);
create index on public.receita_correcoes (loja_id);
create index on public.receita_correcoes (execucao_id);

-- Candidatas à promoção: >= 3 correções iguais (mesmo campo e valor final) de >= 2 lojas, na mesma receita.
-- Só o servidor lê (cruza lojas); a promoção em si é decisão do super admin.
create view public.receita_correcoes_candidatas with (security_invoker = true) as
select e.receita_id, c.campo, c.valor_final,
       count(*) as total, count(distinct c.loja_id) as lojas
from public.receita_correcoes c
join public.receita_execucoes e on e.id = c.execucao_id
where c.status in ('proposta', 'candidata') and c.valor_final is not null
group by e.receita_id, c.campo, c.valor_final
having count(*) >= 3 and count(distinct c.loja_id) >= 2;

-- RLS e grants. Escrita só pelo servidor. Receita ativa é leitura para logados; execuções/correções só da própria loja.
alter table public.receitas enable row level security;
alter table public.receita_execucoes enable row level security;
alter table public.receita_correcoes enable row level security;
revoke all on public.receitas, public.receita_execucoes, public.receita_correcoes, public.receita_correcoes_candidatas from anon, authenticated;
grant select, insert, update, delete on public.receitas, public.receita_execucoes, public.receita_correcoes to service_role;
grant select on public.receita_correcoes_candidatas to service_role;
grant select on public.receitas, public.receita_execucoes, public.receita_correcoes to authenticated;

create policy receitas_ver on public.receitas for select to authenticated
  using (status = 'ativa' or private.eh_super_admin());
create policy receita_execucoes_ver on public.receita_execucoes for select to authenticated
  using (private.pode_ver_loja(loja_id));
create policy receita_correcoes_ver on public.receita_correcoes for select to authenticated
  using (private.pode_ver_loja(loja_id));
