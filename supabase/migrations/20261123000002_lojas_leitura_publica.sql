-- Vitrine pública: permite ao papel anon LER a loja ativa (resolver por domínio/slug).
-- Seguro: a tabela lojas só tem colunas públicas (nome, slug, whatsapp, modo_venda, ...);
-- segredos (tokens do Bling, chaves) ficam em tabelas separadas e cifradas, fora daqui.
-- Isso permite servir a vitrine com a CHAVE PÚBLICA (anon), sem usar service_role no público.
grant select on public.lojas to anon;
create policy lojas_publicas on public.lojas
  for select to anon
  using (ativa = true);
