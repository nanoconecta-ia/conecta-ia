-- MOBIS/Nano: camada de AFIRMAÇÕES DE IA não confiáveis por padrão.
-- Respostas de Qwen, GPT etc. são hipóteses rastreáveis, NUNCA instruções para executar ações.
-- Não criar aplicação, OEM, SKU, imposto, etiqueta ou anúncio em função desta tabela.
create table if not exists public.catalogo_evidencias_ia (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  fonte_id uuid not null references public.fontes(id),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  identificador_afirmacao text not null check(length(btrim(identificador_afirmacao)) between 3 and 100),
  tema text not null check(tema in (
    'identidade_erp','preco','oem','equivalencia','aplicacao','medida',
    'logistica','fiscal','marca','busca_pdv','automacao'
  )),
  alegacao text not null check(length(btrim(alegacao)) between 8 and 1800),
  valor_candidato jsonb not null default '{}'::jsonb,
  evidencias_secundarias text[] not null default '{}'::text[],
  status text not null default 'candidato'
    check(status in ('candidato','conflito','comprovado','descartado')),
  prioridade text not null default 'P1'
    check(prioridade in ('P0','P1','P2')),
  motivo text not null check(length(btrim(motivo)) between 10 and 1800),
  revisor uuid,
  revisado_em timestamptz,
  comprovacao_documental text,
  coletado_em timestamptz not null default now(),
  constraint catalogo_evidencias_ia_unica
    unique(loja_id,fonte_id,produto_id,identificador_afirmacao),
  constraint catalogo_evidencias_ia_comprovacao check(
    status <> 'comprovado' or (
      revisor is not null and revisado_em is not null
      and nullif(btrim(comprovacao_documental),'') is not null
    )
  )
);
alter table public.catalogo_evidencias_ia enable row level security;
revoke all on public.catalogo_evidencias_ia from anon,authenticated;
create index if not exists catalogo_ia_revisao
  on public.catalogo_evidencias_ia (loja_id,status,prioridade,coletado_em desc);
comment on table public.catalogo_evidencias_ia is
'Quarentena de afirmações não verificadas de modelos de linguagem. Origem da IA não comprova fatos. Dados fiscais/medidas/compatibilidade só migram após revisão documental por mecanismo próprio.';

create or replace function public.mobis_evidencias_ia_resumo_admin(p_loja uuid)
returns jsonb language plpgsql stable security definer
set search_path to ''
as $$
begin
  if (select auth.uid()) is null
    or not coalesce(public.pode_administrar_loja(p_loja),false) then
    raise exception 'Acesso restrito ao administrador da loja'
      using errcode='42501';
  end if;
  return (
    select jsonb_build_object(
      'total',count(*),
      'candidatos',count(*) filter(where status='candidato'),
      'conflitos',count(*) filter(where status='conflito'),
      'comprovados',count(*) filter(where status='comprovado'),
      'descartados',count(*) filter(where status='descartado'),
      'prioridade_p0',count(*) filter(where prioridade='P0')
    )
    from public.catalogo_evidencias_ia where loja_id=p_loja
  );
end;
$$;
revoke all on function public.mobis_evidencias_ia_resumo_admin(uuid)
  from public,anon,authenticated;
grant execute on function public.mobis_evidencias_ia_resumo_admin(uuid)
  to authenticated;
