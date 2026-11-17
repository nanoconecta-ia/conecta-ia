# MOBIS / Conecta.IA — Banners Flash ↔ produto físico ↔ páginas por veículo
Atualização: 17/11/2026. O percurso principal do banner foi alterado para link direto ao SKU, mantendo as aprovações.

## Modelo de identidade de estoque (obrigatório)
1. Um produto do Bling com **SKU físico único** é espelhado em `produtos`.
2. A campanha em `loja_banners` referencia `produto_id`; a campanha **não** gera um novo produto.
3. As páginas por veículo são publicadas como `produto_aplicacoes` com `pagina_slug` único, `status='aprovado'`, `pagina_indexavel=true`; referenciam **o mesmo `produto_id`**.
4. A foto do motor/bloco é do SKU físico, nunca uma foto inventada para a aplicação. A mesma foto pode aparecer nas páginas dos veículos realmente homologados.
5. A vitrine só expõe `publicado=true`. Uma aplicação em revisão não deve ter link público. Mencionar o veículo como referência institucional não é afirmar compatibilidade.
6. Preços, estoque, impostos, CFOP, NCM, dados de NF e dados do Bling não são editados pelo editor de banners.

## Conecta.IA / painel autenticado
Menu **Banners de oferta / Campanhas Flash** (atrás de `VITE_BANNERS_ATIVO=1`, apenas quando migração/RPC estiverem instaladas):
- Escolher produto publicado, escrever chamada com limite de 80 caracteres, estilo Auto/Padrão/Flash.
- Selecionar **apenas imagem do mesmo produto que já está aprovada e licenciada** (ou usar automaticamente a foto principal autorizada).
- Definir período de início/fim e prioridade/ordem 0..99.
- Salvar rascunho, publicar, editar, pausar ou excluir.
- RLS do lojista por `loja_id`, gatilho valida produto e imagem no mesmo tenant, limite atual de 24 banners ativos, trilha de auditoria existente.

## Site Mobis — clique direto na página do produto
- Página principal: `#/loja/mobis`. Destaque Flash usa dados de `loja-publica` e foto autorizada.
- Clique na fotografia, no título ou no CTA do Flash navega diretamente à **página canônica do SKU**: `#/p/mobis/<SKU>`. Não há modal intermediário no caminho promocional.
- Ficha do produto físico: `#/p/mobis/<SKU>`. É a única página de produto canônico do SKU.
- Páginas por aplicação: `#/a/<pagina_slug>`. São endereços independentes por veículo/motor/ano **somente quando homologados**.
- A página canônica lista os links de aplicações aprovadas; cada página de aplicação oferece retorno ao mesmo SKU físico.
- A foto da peça no catálogo abre a página do SKU, não escolhe arbitrariamente a primeira aplicação.
- Botões cinza, detalhe laranja da marca, fundos branco/gelo, sem substituir tipografia ou logo.

## Regras de imagem e confidencialidade
- Migração opcional `loja_banners.imagem_id` só aceita `produto_imagens` do mesmo `loja_id` e `produto_id` que estejam em `imagens_publicaveis`.
- A RPC `banners_da_vitrine` usa imagem da view de publicáveis; sem imagem autorizada, mostra apenas a chamada sem fotografia do produto.
- Se o lojista retirar a licença ou a foto, ela deixa de ser retornada automaticamente. O editor nunca é autorização de direitos.
- Fotos TRIM-GO da Quatro no Drive são referências privadas; publicação depende de comprovação dos direitos de uso, foto por SKU e homologação.
- Zero estoque no espelho => preço não aparece na chamada da campanha, e a interface pede confirmação.

## Dependências e aprovação
- PRs #419, #420, #422 e #423 foram integrados; a navegação direta é uma correção isolada de frontend, sem migração SQL ou permissão adicional.
- Revisar em ambiente isolado com `npm test`, `npm run build`, testes Playwright da vitrine e teste SQL da função `banners_da_vitrine`.
- Revisar endpoints públicos, RLS e provas de direitos antes de publicar uma campanha real.
- Somente após aceite visual e comercial: merge/deploy explícito, validação em domínio oficial e publicação individual de produtos autorizados.
