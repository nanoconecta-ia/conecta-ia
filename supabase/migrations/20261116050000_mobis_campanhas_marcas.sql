-- Campanhas institucionais de marca, sem mexer no preço ou no SKU físico do Bling.
-- Ofertas de itens específicos continuam em loja_banners, ligadas a produto_id.
create table if not exists public.marca_campanhas (
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null references public.lojas(id) on delete cascade,
 marca_id uuid not null references public.marcas(id) on delete cascade,
 titulo text not null check(char_length(titulo) between 5 and 90),
 chamada text check(chamada is null or char_length(chamada) <= 240),
 banner_imagem_url text,
 banner_direitos text,
 banner_fonte text,
 inicio timestamptz not null default now(),
 fim timestamptz,
 ordem integer not null default 0,
 status text not null default 'rascunho' check(status in ('rascunho','aprovado','rejeitado','pausado')),
 criado_em timestamptz not null default now(),
 aprovado_em timestamptz,
 aprovado_por uuid,
 constraint marca_campanhas_periodo check(fim is null or fim>=inicio),
 constraint marca_campanhas_imagem check (
   banner_imagem_url is null or
   (banner_imagem_url like 'https://%' and nullif(btrim(banner_direitos),'') is not null
   and nullif(btrim(banner_fonte),'') is not null)
 ),
 constraint marca_campanhas_aprovacao check(status <> 'aprovado' or (aprovado_em is not null and aprovado_por is not null))
);
alter table public.marca_campanhas enable row level security;
revoke all on public.marca_campanhas from anon,authenticated;
create index if not exists marca_campanhas_ativas on public.marca_campanhas(loja_id,inicio,fim,ordem) where status='aprovado';
comment on table public.marca_campanhas is 'Banner de marca e identidade promocional independente do cadastro fiscal, dos SKUs e dos preços de peças. Não mostrar imagem de produto sintético.';
