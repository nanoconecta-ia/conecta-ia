-- Migração 12: ambiente (teste/produção), modo "catálogo de consulta", recursos da plataforma ligáveis por loja
-- (menu/botões retráteis escaláveis) e central de ajuda curada (o agente só ensina o que está aprovado).

-- 1) Modo de venda "catálogo": consulta sem compra. (O novo valor só é usado em migrações seguintes.)
alter type public.modo_venda add value if not exists 'catalogo';

-- 2) Ambiente da loja. Nasce em teste; produção exige política aprovada e domínio com DNS e SSL verificados.
alter table public.lojas add column ambiente text not null default 'teste' check (ambiente in ('teste', 'producao'));

create function private.exige_requisitos_producao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ambiente = 'producao' and (tg_op = 'INSERT' or old.ambiente is distinct from 'producao') then
    if not exists (select 1 from public.loja_politicas p where p.loja_id = new.id and p.status = 'aprovada') then
      raise exception 'produção exige política da loja aprovada' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.loja_dominios d where d.loja_id = new.id
                   and d.dns_verificado_em is not null and d.ssl_verificado_em is not null) then
      raise exception 'produção exige domínio com DNS e SSL verificados' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger lojas_producao_exige_requisitos before insert or update of ambiente on public.lojas
  for each row execute function private.exige_requisitos_producao();
create trigger lojas_ambiente_auditoria after update of ambiente on public.lojas
  for each row when (old.ambiente is distinct from new.ambiente) execute function private.auditar_regra();

-- 3) Recursos da plataforma (catálogo global) e escolha por loja.
create table public.recursos_plataforma (
  codigo text primary key check (codigo ~ '^[a-z0-9_]{2,40}$'),
  grupo text not null,
  nome text not null,
  descricao text,
  rota text,
  ordem int not null default 0,
  disponivel boolean not null default true,       -- false = "em breve" (não pode ser ligado)
  ativo_padrao boolean not null default true
);
create table public.loja_recursos (
  loja_id uuid not null references public.lojas(id) on delete cascade,
  recurso text not null references public.recursos_plataforma(codigo) on delete cascade,
  ativo boolean not null,
  primary key (loja_id, recurso)
);

insert into public.recursos_plataforma (codigo, grupo, nome, descricao, rota, ordem, disponivel, ativo_padrao) values
  ('visao_geral', 'Início', 'Visão geral', 'Resumo da loja e do que falta', '/painel', 10, true, true),
  ('catalogo', 'Catálogo', 'Catálogo', 'Produtos espelhados do Bling', '/painel/catalogo', 20, true, true),
  ('publicar', 'Catálogo', 'Antes de publicar', 'Compare o Bling com o site e aprove', '/painel/publicar', 30, true, true),
  ('enriquecimento', 'Agente', 'Propostas do agente', 'Aprove o que o agente sugeriu', '/painel/propostas', 40, false, true),
  ('taxonomia', 'Agente', 'Categorias', 'Árvore de categorias da loja', '/painel/categorias', 50, false, true),
  ('politicas', 'Loja', 'Políticas e empresa', 'Garantia, troca, privacidade e dados da empresa', '/painel/politicas', 60, false, true),
  ('bling', 'Integrações', 'Bling', 'Conexão com o ERP', '/painel/bling', 70, true, true),
  ('pagamentos', 'Vendas', 'Pagamentos', 'Meios de pagamento (em breve)', null, 80, false, false),
  ('frete', 'Vendas', 'Frete e logística', 'Correios e transportadoras (em breve)', null, 90, false, false),
  ('ajuda', 'Ajuda', 'Como funciona', 'Passo a passo com o agente', '/painel/ajuda', 100, false, true);

-- Recurso efetivo por loja (respeita a RLS de quem consulta).
create view public.recursos_efetivos with (security_invoker = on) as
  select l.id as loja_id, r.codigo, r.grupo, r.nome, r.descricao, r.rota, r.ordem, r.disponivel,
         (r.disponivel and coalesce(lr.ativo, r.ativo_padrao)) as ativo
  from public.lojas l cross join public.recursos_plataforma r
  left join public.loja_recursos lr on lr.loja_id = l.id and lr.recurso = r.codigo;

-- 4) Central de ajuda curada: o agente só ensina tópicos aprovados.
create table public.ajuda_topicos (
  codigo text primary key check (codigo ~ '^[a-z0-9_]{2,60}$'),
  recurso text references public.recursos_plataforma(codigo),
  titulo text not null,
  corpo_md text not null,
  ordem int not null default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado'))
);
insert into public.ajuda_topicos (codigo, recurso, titulo, corpo_md, ordem) values
  ('primeiros_passos', 'visao_geral', 'Primeiros passos',
   'O Bling é a fonte do cadastro. O Conecta.IA espelha o catálogo, o agente propõe melhorias e **você aprova** antes de qualquer coisa ir para o site.', 10),
  ('conectar_bling', 'bling', 'Conectar ao Bling',
   'Em **Bling**, clique em Conectar e autorize o acesso. A sincronização é automática; você nunca copia chave.', 20),
  ('antes_de_publicar', 'publicar', 'Antes de publicar',
   'Compare o que está no Bling com o que vai ao site. Produto incompleto não é publicado: o sistema diz o que falta.', 30),
  ('aprovar_propostas', 'enriquecimento', 'Aprovar o que o agente propõe',
   'Tudo que o agente envia chega como **a confirmar**, com fonte e data. Só vira público depois da sua aprovação.', 40);

-- 5) RLS e grants.
alter table public.recursos_plataforma enable row level security;
alter table public.loja_recursos enable row level security;
alter table public.ajuda_topicos enable row level security;
create policy recursos_ver on public.recursos_plataforma for select to authenticated using (true);
create policy loja_recursos_lojista on public.loja_recursos for all to authenticated
  using (private.pode_ver_loja(loja_id)) with check (private.pode_ver_loja(loja_id));
create policy ajuda_ver on public.ajuda_topicos for select to authenticated using (status = 'aprovado');
grant select on public.recursos_plataforma, public.ajuda_topicos, public.recursos_efetivos to authenticated;
grant select, insert, update, delete on public.loja_recursos to authenticated;
grant select, insert, update, delete on public.recursos_plataforma, public.loja_recursos, public.ajuda_topicos to service_role;
