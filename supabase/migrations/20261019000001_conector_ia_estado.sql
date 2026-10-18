-- Conector IA — estado operacional persistente (Fase 1, PROPOSTA: não aplicar em produção sem aprovação específica).
-- O estado pertence ao Conecta.IA, não ao LLM: trocar GPT/Gemini/Claude no meio não apaga tarefa, proposta, aprovação nem auditoria.
-- Convenções do projeto: RLS por loja (private.pode_ver_loja), escrita só por service_role (RPCs da próxima migração),
-- nenhuma tabela nova é legível por anon.

create type public.risco_nivel as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.agente_msg_papel as enum ('user', 'assistant', 'tool', 'system');
create type public.tarefa_estado as enum ('planejando', 'aguardando_aprovacao', 'executando', 'verificando', 'concluida', 'falhou', 'cancelada', 'bloqueada');
create type public.proposta_estado as enum ('rascunho', 'pendente', 'aprovada', 'rejeitada', 'expirada', 'invalidada', 'executando', 'executada', 'parcial', 'falhou', 'cancelada');
create type public.item_estado as enum ('pendente', 'travado', 'aprovado', 'em_execucao', 'executado', 'confirmado', 'falhou', 'desconhecido', 'ignorado');
create type public.operacao_estado as enum ('pendente', 'enviada', 'confirmada', 'falhou', 'desconhecida');
create type public.produto_estado_op as enum ('bloqueado', 'liberado_propostas', 'pendente_aprovacao', 'aprovado_execucao', 'em_execucao', 'sincronizado', 'erro_divergencia');

-- Chaves compostas (id, loja_id): garantem que filho e pai são da MESMA loja, sem depender só do código.
alter table public.produtos add constraint produtos_id_loja_unique unique (id, loja_id);

-- ============================================================ conversas (isoladas por loja E usuário)
create table public.agente_conversas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  user_id uuid not null,
  titulo text not null default 'Nova conversa' check (char_length(titulo) between 1 and 120),
  projeto text check (projeto is null or char_length(projeto) <= 80),
  provedor text check (provedor is null or provedor in ('claude', 'gemini', 'compativel_openai', 'openai', 'deepseek')),
  modelo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, loja_id)
);
create index on public.agente_conversas (loja_id, user_id, atualizado_em desc);

create table public.agente_mensagens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  conversa_id uuid not null,
  seq int not null,
  papel public.agente_msg_papel not null,
  conteudo jsonb not null,                 -- blocos no formato canônico (text / tool_use / tool_result)
  provedor text,
  modelo text,
  tokens_entrada int check (tokens_entrada is null or tokens_entrada >= 0),
  tokens_saida int check (tokens_saida is null or tokens_saida >= 0),
  custo_estimado numeric(12, 6) check (custo_estimado is null or custo_estimado >= 0),
  prompt_versao int,
  criado_em timestamptz not null default now(),
  unique (conversa_id, seq),
  foreign key (conversa_id, loja_id) references public.agente_conversas (id, loja_id) on delete cascade
);
create index on public.agente_mensagens (loja_id, criado_em desc);

create table public.agente_anexos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  conversa_id uuid not null,
  mensagem_id uuid references public.agente_mensagens(id) on delete set null,
  tipo text not null check (tipo in ('imagem', 'documento', 'audio')),
  nome text not null check (char_length(nome) <= 200),
  mime text not null,
  bytes bigint not null check (bytes > 0 and bytes <= 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_path text not null,              -- bucket privado; o navegador só recebe URL assinada de curta duração
  criado_em timestamptz not null default now(),
  foreign key (conversa_id, loja_id) references public.agente_conversas (id, loja_id) on delete cascade
);
create index on public.agente_anexos (conversa_id);

-- ============================================================ tarefas (sobrevivem à exclusão da conversa e à troca de modelo)
create table public.agente_tarefas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  conversa_id uuid,
  criada_por uuid not null,
  objetivo text not null check (char_length(objetivo) between 3 and 2000),
  estado public.tarefa_estado not null default 'planejando',
  plano jsonb,
  resultado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluida_em timestamptz,
  unique (id, loja_id),
  foreign key (conversa_id, loja_id) references public.agente_conversas (id, loja_id) on delete set null (conversa_id)
);
create index on public.agente_tarefas (loja_id, estado, atualizado_em desc);

-- ============================================================ propostas versionadas e imutáveis
create table public.agente_propostas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  tarefa_id uuid,
  conversa_id uuid,
  solicitante_user uuid not null,                       -- quem pediu (humano autenticado)
  agente text not null default 'Conector IA',
  provedor text,
  modelo text,
  prompt_versao int,
  titulo text not null check (char_length(titulo) between 3 and 160),
  resumo text,
  risco public.risco_nivel not null default 'MEDIUM',
  versao int not null default 1 check (versao >= 1),
  proposta_anterior_id uuid references public.agente_propostas(id),
  lote boolean not null default false,
  estado public.proposta_estado not null default 'rascunho',
  hash text,                                            -- sha256 do conteúdo (calculado no envio; nunca digitado)
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  decidido_em timestamptz,
  unique (id, loja_id),
  unique (proposta_anterior_id),
  foreign key (tarefa_id, loja_id) references public.agente_tarefas (id, loja_id),
  foreign key (conversa_id, loja_id) references public.agente_conversas (id, loja_id) on delete set null (conversa_id),
  check (estado = 'rascunho' or (hash is not null and expira_em is not null and enviado_em is not null))
);
create index on public.agente_propostas (loja_id, estado, criado_em desc);

create table public.agente_proposta_itens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  proposta_id uuid not null,
  produto_id uuid,
  ordem int not null check (ordem >= 0),
  operacao text not null check (operacao ~ '^[a-z_]+(\.[a-z_]+)+$'),   -- id da ferramenta no registro (ex.: bling.produtos.alterar)
  alvo text,                                            -- identificador no ERP/site, quando houver
  campos text[] not null default '{}',
  antes jsonb,
  depois jsonb not null,
  fontes jsonb not null default '[]' check (jsonb_typeof(fontes) = 'array'),
  validacoes jsonb not null default '[]' check (jsonb_typeof(validacoes) = 'array'),
  risco public.risco_nivel not null default 'MEDIUM',
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  estado public.item_estado not null default 'pendente',
  motivo text,
  unique (proposta_id, ordem),
  unique (loja_id, idempotency_key),
  unique (id, loja_id),
  foreign key (proposta_id, loja_id) references public.agente_propostas (id, loja_id) on delete cascade,
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id)
);
create index on public.agente_proposta_itens (produto_id);

-- ============================================================ aprovação vinculada à versão exata
create table public.agente_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  proposta_id uuid not null,
  versao int not null,
  hash_proposta text not null,
  user_id uuid not null,                                -- SEMPRE um humano autenticado e membro da loja (ver RPC)
  decisao text not null check (decisao in ('aprovada', 'rejeitada')),
  risco public.risco_nivel not null,
  escopo jsonb not null,                                -- itens, produtos e campos autorizados
  expira_em timestamptz not null,
  decidido_em timestamptz not null default now(),
  unique (proposta_id),
  foreign key (proposta_id, loja_id) references public.agente_propostas (id, loja_id)
);

-- ============================================================ execução: uma linha por tentativa, com evidência
create table public.agente_operacoes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null,
  proposta_id uuid not null,
  item_id uuid not null,
  tentativa int not null default 1 check (tentativa >= 1),
  idempotency_key text not null,
  ferramenta text not null,
  modo text not null default 'simulado' check (modo in ('simulado', 'real')),
  estado public.operacao_estado not null default 'pendente',
  requisicao jsonb,                                     -- resumo sem segredos
  resposta jsonb,
  evidencia jsonb,                                      -- leitura de confirmação após a escrita
  erro text,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  unique (item_id, tentativa),
  foreign key (item_id, loja_id) references public.agente_proposta_itens (id, loja_id)
);
create index on public.agente_operacoes (loja_id, estado, iniciado_em desc);

-- Liberação explícita de escrita REAL por loja e ferramenta. Sem linha ativa, o banco recusa modo 'real'.
create table public.agente_escrita_liberada (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  ferramenta text not null,
  liberada_por uuid not null,
  liberada_em timestamptz not null default now(),
  revogada_em timestamptz,
  referencia text not null,                             -- evidência da autorização (testes, escopo, aprovação do dono)
  primary key (loja_id, ferramenta)
);

-- ============================================================ trava por produto
create table public.produto_travas (
  produto_id uuid primary key,
  loja_id uuid not null,
  estado public.produto_estado_op not null default 'liberado_propostas',
  motivo text,
  alterado_por uuid,
  alterado_em timestamptz not null default now(),
  foreign key (produto_id, loja_id) references public.produtos (id, loja_id) on delete cascade
);
create index on public.produto_travas (loja_id, estado);

-- ============================================================ registro de cada chamada de ferramenta (chat e gateway)
create table public.agente_chamadas_ferramenta (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  origem text not null check (origem in ('chat', 'gateway_mcp', 'executor')),
  conversa_id uuid,
  tarefa_id uuid,
  user_id uuid,
  mcp_chave_id uuid,
  ferramenta text not null,
  risco public.risco_nivel,
  decisao text not null check (decisao in ('permitida', 'negada', 'requer_aprovacao', 'simulada')),
  motivo text,
  entrada jsonb,                                        -- resumo; nunca segredo
  saida jsonb,
  duracao_ms int
);
create index on public.agente_chamadas_ferramenta (loja_id, quando desc);

-- ============================================================ prompts versionados e memória técnica com fonte/versão
create table public.agente_prompts (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,   -- null = plataforma
  nome text not null,
  versao int not null check (versao >= 1),
  escopo text not null default 'geral' check (escopo in ('geral', 'seguranca')),
  conteudo text not null check (char_length(conteudo) between 10 and 20000),
  hash text not null,
  estado text not null default 'proposto' check (estado in ('proposto', 'ativo', 'arquivado')),
  proposto_por text not null check (proposto_por in ('humano', 'agente')),
  aprovado_por uuid,
  criado_em timestamptz not null default now(),
  -- política de segurança não é editável por agente; ativar exige um humano
  check (estado <> 'ativo' or aprovado_por is not null),
  check (escopo <> 'seguranca' or proposto_por = 'humano')
);
create unique index agente_prompts_versao on public.agente_prompts (coalesce(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), nome, versao);
create unique index agente_prompts_um_ativo on public.agente_prompts (coalesce(loja_id, '00000000-0000-0000-0000-000000000000'::uuid), nome) where estado = 'ativo';

create table public.agente_conhecimento (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.lojas(id) on delete cascade,   -- null = conhecimento da plataforma
  tipo text not null check (tipo in ('documentacao', 'validado', 'hipotese')),
  titulo text not null check (char_length(titulo) between 3 and 200),
  conteudo text not null check (char_length(conteudo) between 1 and 20000),
  fonte text not null,                                          -- URL ou documento; sem fonte não entra
  fonte_versao text,
  coletado_em timestamptz not null default now(),
  versao int not null default 1 check (versao >= 1),
  status text not null default 'a_confirmar' check (status in ('a_confirmar', 'validado', 'rejeitado', 'substituido')),
  validado_por uuid,
  busca tsvector generated always as (to_tsvector('portuguese', titulo || ' ' || conteudo)) stored,
  criado_em timestamptz not null default now(),
  check (status <> 'validado' or (validado_por is not null and tipo <> 'hipotese')),
  check (tipo <> 'hipotese' or status in ('a_confirmar', 'rejeitado'))
);
create index agente_conhecimento_busca on public.agente_conhecimento using gin (busca);
create index on public.agente_conhecimento (loja_id, tipo, status);

-- ============================================================ catálogo de capacidades por provedor (não presumir nada)
create table public.provedor_capacidades (
  provedor text not null check (provedor in ('claude', 'gemini', 'compativel_openai', 'openai', 'deepseek')),
  capacidade text not null check (capacidade in ('chat', 'tool_calling', 'streaming', 'visao', 'audio_entrada', 'geracao_imagem')),
  situacao text not null check (situacao in ('implementado', 'nao_implementado', 'nao_verificado')),
  observacao text,
  primary key (provedor, capacidade)
);
-- Semeado só com o que o código realmente faz hoje (adaptadores.ts): chat+tool_calling implementados nos três; o resto não.
insert into public.provedor_capacidades (provedor, capacidade, situacao, observacao)
select p, c, s, o from (values
  ('claude', 'chat', 'implementado', 'Messages API, sem streaming'),
  ('claude', 'tool_calling', 'implementado', null),
  ('gemini', 'chat', 'implementado', 'generateContent, sem streaming'),
  ('gemini', 'tool_calling', 'implementado', 'functionDeclarations'),
  ('compativel_openai', 'chat', 'implementado', 'chat/completions; cobre OpenAI, DeepSeek, Llama hospedado'),
  ('compativel_openai', 'tool_calling', 'implementado', 'depende de o modelo escolhido suportar ferramentas')
) v(p, c, s, o);
insert into public.provedor_capacidades (provedor, capacidade, situacao, observacao)
select p.provedor, c.capacidade, 'nao_implementado', 'Ainda não implementado no adaptador'
from (values ('claude'), ('gemini'), ('compativel_openai')) p(provedor)
cross join (values ('streaming'), ('visao'), ('audio_entrada'), ('geracao_imagem')) c(capacidade);

-- ============================================================ RLS e grants (leitura pelo painel; escrita só service_role)
do $$
declare t text;
begin
  foreach t in array array['agente_conversas', 'agente_mensagens', 'agente_anexos', 'agente_tarefas', 'agente_propostas',
    'agente_proposta_itens', 'agente_aprovacoes', 'agente_operacoes', 'agente_escrita_liberada', 'produto_travas',
    'agente_chamadas_ferramenta', 'agente_prompts', 'agente_conhecimento', 'provedor_capacidades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- conversas e anexos: cada usuário vê só as próprias (e só da loja a que pertence)
create policy agente_conversas_ver on public.agente_conversas for select to authenticated
  using (user_id = auth.uid() and private.pode_ver_loja(loja_id));
create policy agente_mensagens_ver on public.agente_mensagens for select to authenticated
  using (exists (select 1 from public.agente_conversas c where c.id = conversa_id and c.user_id = auth.uid() and private.pode_ver_loja(c.loja_id)));
create policy agente_anexos_ver on public.agente_anexos for select to authenticated
  using (exists (select 1 from public.agente_conversas c where c.id = conversa_id and c.user_id = auth.uid() and private.pode_ver_loja(c.loja_id)));

-- estado operacional da loja: quem vê a loja vê tarefas, propostas, aprovações, execuções, travas e o log de ferramentas
create policy agente_tarefas_ver on public.agente_tarefas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_propostas_ver on public.agente_propostas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_itens_ver on public.agente_proposta_itens for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_aprovacoes_ver on public.agente_aprovacoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_operacoes_ver on public.agente_operacoes for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_escrita_ver on public.agente_escrita_liberada for select to authenticated using (private.pode_ver_loja(loja_id));
create policy produto_travas_ver on public.produto_travas for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_chamadas_ver on public.agente_chamadas_ferramenta for select to authenticated using (private.pode_ver_loja(loja_id));
create policy agente_prompts_ver on public.agente_prompts for select to authenticated using (loja_id is null or private.pode_ver_loja(loja_id));
create policy agente_conhecimento_ver on public.agente_conhecimento for select to authenticated using (loja_id is null or private.pode_ver_loja(loja_id));
create policy provedor_capacidades_ver on public.provedor_capacidades for select to authenticated using (true);

-- ============================================================ imutabilidade
-- Log de chamadas e aprovações: append-only (como a auditoria). Aprovação nunca é editada: mudou a proposta, nasce outra versão.
create function private.agente_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% é imutável (append-only)', tg_table_name using errcode = '42501';
end $$;
create trigger agente_chamadas_imutavel before update or delete on public.agente_chamadas_ferramenta
  for each row execute function private.agente_imutavel();
create trigger agente_aprovacoes_imutavel before update or delete on public.agente_aprovacoes
  for each row execute function private.agente_imutavel();

-- Itens de proposta só mudam de CONTEÚDO enquanto a proposta é rascunho; depois só o estado/motivo.
create function private.itens_imutaveis() returns trigger language plpgsql set search_path = '' as $$
declare v_estado public.proposta_estado;
begin
  select estado into v_estado from public.agente_propostas where id = coalesce(new.proposta_id, old.proposta_id);
  if tg_op = 'INSERT' then
    if v_estado <> 'rascunho' then raise exception 'proposta já enviada: crie uma nova versão' using errcode = '42501'; end if;
    return new;
  elsif tg_op = 'DELETE' then
    if v_estado <> 'rascunho' then raise exception 'proposta já enviada: itens não podem ser removidos' using errcode = '42501'; end if;
    return old;
  end if;
  if v_estado <> 'rascunho' and (
       (new.loja_id, new.proposta_id, new.produto_id, new.ordem, new.operacao, new.alvo, new.campos, new.antes, new.depois,
        new.fontes, new.validacoes, new.risco, new.idempotency_key)
       is distinct from
       (old.loja_id, old.proposta_id, old.produto_id, old.ordem, old.operacao, old.alvo, old.campos, old.antes, old.depois,
        old.fontes, old.validacoes, old.risco, old.idempotency_key)) then
    raise exception 'proposta já enviada: o conteúdo do item é imutável (crie uma nova versão)' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agente_itens_imutaveis before insert or update or delete on public.agente_proposta_itens
  for each row execute function private.itens_imutaveis();

-- Proposta enviada: hash, versão e solicitante não mudam mais.
create function private.proposta_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado <> 'rascunho' and (new.hash, new.versao, new.solicitante_user, new.risco, new.loja_id)
     is distinct from (old.hash, old.versao, old.solicitante_user, old.risco, old.loja_id) then
    raise exception 'proposta enviada é imutável' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger agente_propostas_imutavel before update on public.agente_propostas
  for each row execute function private.proposta_imutavel();
