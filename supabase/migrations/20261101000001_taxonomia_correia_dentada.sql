-- Taxonomia da correia dentada (pedido do dono, 2026-11-01): quatro nós PROPOSTOS dentro de Motor > Correias e tensores.
-- Idempotente: pode rodar de novo sem duplicar. Os nós entram como 'proposto' (padrão da coluna) e só o lojista os aprova na tela Taxonomia.
-- Não move nenhum produto existente; não cria família técnica nem medidas (decisão separada do dono).
insert into public.taxonomia_nos (perfil_ramo, pai_id, nome, slug, ordem)
select 'autopecas', pai.id, n.nome, n.slug, n.ordem
from public.taxonomia_nos pai
cross join (values
  ('Correia dentada', 'correia-dentada', 1),
  ('Tensor da correia dentada', 'tensor-correia-dentada', 2),
  ('Rolete e polia da correia dentada', 'rolete-polia-correia-dentada', 3),
  ('Kit de correia dentada (correia, tensor e roletes)', 'kit-correia-dentada', 4)
) as n(nome, slug, ordem)
where pai.perfil_ramo = 'autopecas' and pai.slug = 'correias-tensores'
on conflict (perfil_ramo, slug) do nothing;
