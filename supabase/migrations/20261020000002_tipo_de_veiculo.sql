-- Tipo de veículo na vitrine: liga a aplicação do produto ao modelo cadastrado (genealogia) e amplia os tipos aceitos.
-- Só aplicação com modelo_id (cadastro técnico, não texto livre) entra no filtro por tipo; sem ligação, o produto não é classificado por tipo.
alter table public.modelos drop constraint if exists modelos_categoria_check;
alter table public.modelos add constraint modelos_categoria_check
  check (categoria in ('passeio', 'suv', 'utilitario', 'van', 'furgao', 'picape', 'caminhao', 'moto'));

alter table public.produto_aplicacoes add column modelo_id uuid references public.modelos(id) on delete set null;
create index produto_aplicacoes_modelo on public.produto_aplicacoes (loja_id, modelo_id) where modelo_id is not null;
