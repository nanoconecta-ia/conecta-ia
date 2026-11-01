---
name: nano-seo-rastreavel
description: Preparar e conferir páginas públicas de autopeças para Googlebot e buscadores de IA, com HTML indexável, JSON-LD honesto, canonical, sitemap, links e imagens autorizadas.
---

# Skill: SEO técnico rastreável e sem conteúdo inventado

**Acionar** ao criar proposta de título SEO, página de produto, página de categoria, política pública, dados estruturados, sitemap, robots ou resposta destinada ao Googlebot/OAI-SearchBot.

## Precondição P0

A vitrine pública é **separada do painel administrativo**. Nunca indexar painel, CPF/CNPJ interno, log, estoque reservado, custo ou fornecedor. Uma página indexável precisa resolver um URL HTTP real, no domínio verificado, sem `#/`, com **HTML inicial** legível para humano e bot e navegação por links `<a href>`. Robots e WAF devem permitir os crawlers desejados; uma tela React vazia ou `noindex` invalida a estratégia.

## Página por SKU

1. Entrada: `FichaConfirmada` da Skill de identidade + estoque/preço confirmado da Skill de oferta; nenhuma chamada LLM pode tornar um campo a_confirmar em aprovado.
2. H1, `title`, `meta description` e conteúdo principal descrevem **peça exata, marca da peça, motor/aplicação aprovada e diferenciais comprovados**. Uma URL por SKU/variante vendável; slug estável, canonical único, 301 para slug antigo. Evitar o mesmo texto reescrito em massa e doorway pages.
3. Renderizar `Product` JSON-LD com `sku`, `brand`, `mpn`/GTIN apenas verificados, `image` licenciada; `isAccessoryOrSparePartFor` só de aplicação validada (é semântica schema.org, não promessa de rich result). `Offer` somente se os fatos comerciais são válidos e visíveis na página; `availability` depende de estoque verdadeiro.
4. `BreadcrumbList`, `Organization` e `LocalBusiness` devem representar links, contato, estabelecimento físico e horários que existam de verdade. Não inventar `aggregateRating`, avaliações, estrelas, selo, garantia, preço promocional ou posicionamento.
5. `sitemap.xml` traz só URLs 200 indexáveis e canônicas; limite de 50 mil URLs ou 50 MB sem compressão por arquivo; `lastmod` expressa mudança real. `robots.txt` deixa sitemap visível e não bloqueia páginas públicas por engano.
6. Filtros de ano/marca/aplicação criam **navegação útil**, não milhões de páginas vazias; `/busca?q` e facetas sem valor editorial ficam `noindex`. Conteúdo técnico aprovado pode render páginas de aplicação únicas e indexáveis quando houver valor para o usuário.
7. Verificar imagem CDN pública, direitos, dimensão, alt factual, status 200 e CORS/crawlers quando necessários. Não usar URL Google Drive compartilhada como imagem de Merchant.

## QA obrigatório, antes de publicação

- GET em URL real deve devolver HTML completo **sem JS** com H1, SKU, imagem e preço/estoque quando válidos; sem preço não emitir `Offer` fictícia.
- Testar JSON-LD e conteúdo visível idênticos, escaping contra XSS e HTML inválido, URL canônica/redirect, mobile 390 px, robot noindex/403/CAPTCHA e imagens quebradas.
- Validar com Rich Results Test, Search Console e inspeção de URL quando houver domínio de teste; testes unitários locais **não provam indexação real**.
- Se produto não é vendável, considerar página editorial `Product` sem Merchant listing, somente se há conteúdo útil e política de publicação aprovada.
- O agente cria rascunhos de SEO; **não altera DNS, site, robots, arquivos em produção ou Bling sem autorização**.

**Reutilizar:** `supabase/functions/_shared/seo/{jsonld,pagina,rotas,sitemap,metadados}.ts` e `supabase/functions/loja-seo/index.ts`. Não duplicar renderizador; auditar estado de deploy. Fonte: https://developers.google.com/search/docs/appearance/ai-features e https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics.
