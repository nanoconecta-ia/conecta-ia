-- Midias reais de veículos para todas as aplicações da MOBIS.
-- Uma imagem por modelo (vitrine) ou por aplicação (geração específica).
-- Somente a Edge Function, usando server-side, pode publicar registros aprovados.
create table if not exists public.veiculo_midias (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  modelo_id uuid references public.modelos(id),
  aplicacao_id uuid references public.produto_aplicacoes(id),
  montadora_id uuid not null references public.montadoras(id),
  ano_inicial integer,
  ano_final integer,
  foto_png_url text,
  foto_fonte text,
  foto_licenca text,
  foto_autor text,
  foto_ajustes text,
  foto_fundo_transparente boolean not null default false,
  foto_aprovada boolean not null default false,
  logo_png_url text,
  logo_fonte text,
  logo_direito_uso text,
  logo_aprovado boolean not null default false,
  status text not null default 'a_confirmar',
  atualizado_em timestamptz not null default now(),
  constraint veiculo_midias_alvo_check check ((modelo_id is not null) <> (aplicacao_id is not null)),
  constraint veiculo_midias_periodo_check check
    ((ano_inicial is null or ano_inicial between 1950 and 2100)
     and (ano_final is null or ano_final between 1950 and 2100)
     and (ano_inicial is null or ano_final is null or ano_final >= ano_inicial)),
  constraint veiculo_midias_status_check check (status in ('a_confirmar','aprovado','rejeitado')),
  constraint veiculo_midias_foto_check check (
    not foto_aprovada or (
      status='aprovado' and foto_fundo_transparente and
      foto_png_url like 'https://%' and lower(right(split_part(foto_png_url,'?',1),4))='.png' and
      nullif(btrim(foto_fonte),'') is not null and
      nullif(btrim(foto_licenca),'') is not null and
      nullif(btrim(foto_autor),'') is not null
    )
  ),
  constraint veiculo_midias_logo_check check (
    not logo_aprovado or (
      status='aprovado' and
      logo_png_url like 'https://%' and lower(right(split_part(logo_png_url,'?',1),4))='.png' and
      nullif(btrim(logo_fonte),'') is not null and
      nullif(btrim(logo_direito_uso),'') is not null
    )
  )
);
create index if not exists veiculo_midias_por_modelo on public.veiculo_midias (loja_id,modelo_id) where status='aprovado';
create index if not exists veiculo_midias_por_aplicacao on public.veiculo_midias (loja_id,aplicacao_id) where status='aprovado';
alter table public.veiculo_midias enable row level security;
revoke all on public.veiculo_midias from anon, authenticated;
comment on table public.veiculo_midias is 'Miniaturas de veículos reais/PNG e logos oficiais de identificação, aprovados por modelo ou aplicação. Sem imagens fictícias ou foto do veículo confundida com foto da peça.';
