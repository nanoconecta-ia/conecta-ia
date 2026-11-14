-- PARA APROVAÇÃO: NÃO aplicada em produção. Desenho: docs/imagens/DESENHO-ENVIO-FOTOS.md (decisões 1 e 2).
-- Formaliza em migração os buckets de fotos de produto. Não cria política em storage.objects: ninguém escreve nem lê pelo
-- navegador; quem grava é a Edge Function (service_role), e a leitura pública só existe no bucket de DERIVADOS aprovados.
--
-- produtos-originais : PRIVADO. Recebe o arquivo enviado (já reduzido pelo navegador). Nunca público. Limite 3 MB.
-- produtos-imagens   : PÚBLICO. Só versões tratadas de imagens aprovadas e com direitos confirmados. Já existe no projeto ao vivo
--                      (criado fora de migração, vazio): os valores abaixo são os MESMOS de lá (5 MB; PNG, JPEG e WebP); "on conflict
--                      do nothing" garante que aplicar esta migração não altera o bucket existente.
-- Idempotente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-originais', 'produtos-originais', false, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos-imagens', 'produtos-imagens', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
