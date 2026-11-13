-- Triagem de vendas por UF/destinatário/finalidade, SEM dados de clientes.
-- Migração preparada em PR; não executar na conta da Mobis sem revisão do contador e testes.
-- Uma regra validada permite apenas ENCAMINHAR PARA CONFERÊNCIA NO ERP, nunca autoriza emissão, pagamento ou pedido.
create table public.loja_regras_venda_uf (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid not null,
  uf_destino text not null check (uf_destino in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI',
    'RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  )),
  tipo_destinatario text not null check (tipo_destinatario in ('cpf','cnpj')),
  contribuinte_icms text not null check (contribuinte_icms in ('sim','nao')),
  finalidade text not null check (finalidade in ('uso_consumo','revenda','ativo_imobilizado')),
  decisao text not null check (decisao in ('liberar_atendimento','bloquear')),
  status text not null default 'rascunho' check (status in ('rascunho','validada','revogada')),
  fundamento_normativo text,
  fonte_oficial text,
  justificativa text,
  inicio_vigencia date not null default current_date,
  fim_vigencia date,
  validado_por_contador text,
  validado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  foreign key (produto_id,loja_id) references public.produtos(id,loja_id) on delete cascade,
  unique (loja_id,produto_id,uf_destino,tipo_destinatario,contribuinte_icms,finalidade),
  check (fim_vigencia is null or fim_vigencia >= inicio_vigencia),
  check (status <> 'validada' or
    (nullif(btrim(coalesce(fundamento_normativo,'')),'') is not null
    and nullif(btrim(coalesce(fonte_oficial,'')),'') is not null
    and nullif(btrim(coalesce(validado_por_contador,'')),'') is not null
    and validado_em is not null))
);
create index loja_regras_venda_uf_consulta on public.loja_regras_venda_uf (loja_id,produto_id,uf_destino,status);
alter table public.loja_regras_venda_uf enable row level security;
-- Nunca permitir acesso de visitantes nem gravar documentos pessoais nesta tabela.
revoke all on public.loja_regras_venda_uf from public,anon,authenticated;
grant select on public.loja_regras_venda_uf to authenticated;
grant select,insert,update,delete on public.loja_regras_venda_uf to service_role;
create policy loja_regras_venda_uf_admin_leitura on public.loja_regras_venda_uf
  for select to authenticated using (private.pode_ver_loja(loja_id));
-- Somente backend autenticado e autorizado poderá gravar regras com evidência de contador.
-- A API pública usa a chave service_role só no servidor e retorna APENAS a conclusão de triagem.
