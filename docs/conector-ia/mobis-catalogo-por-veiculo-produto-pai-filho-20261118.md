# MOBIS | Catálogo por veículo e produto com taxonomia pai/filho (18/11/2026)

## Referência funcional

Estrutura de navegação inspirada no catálogo eletrônico Bosch (duas modalidades: pesquisa de veículo e pesquisa de produto; ficha com dados técnicos e aplicação). **Não reproduzir código-fonte, marcas, composição gráfica ou conteúdo da Bosch.** Toda a identidade visual continua sendo MOBIS (metálico, vermelho #E2181A, grafite #1F2327, gelo #EAF2F6).

Referência de navegação Bosch: https://am.boschaftermarket.com/br/pt/pe%C3%A7as/product-search.html

## Fluxo público
1. **Por veículo:** Montadora → Modelo → Motor → Ano. Versão, tecnologia e chassi entram apenas quando houver evidência cadastrada e aprovada; não presumir.
2. **Por produto:** Palavra-chave, SKU, referência de fabricante e OEM **aprovados** → sistema → categoria pai → subcategoria filha → produto físico.
3. **Página do SKU:** foto aprovada, marca, descrição do cadastro, SKU, referências homologadas, trilha de categorias, aba de especificações, aplicações aprovadas e contato/QR do WhatsApp Business da MOBIS.
4. **Uma peça física, diversos veículos:** aplicações por modelo podem apontar para uma mesma ficha/estoque, jamais clonar SKUs ou repetir saldo.

## Hierarquia real confirmada (consulta read-only em 18/11/2026)

Exemplo cadastrado: `Motor → Blocos e motores completos → Motor parcial` (slugs `motor → blocos-motores → tec-blocos-motores-motor-parcial`).

Fonte: `public.taxonomia_nos` do Conecta.IA, `pai_id` autoreferente. Não criar pai/filho artificial por regex no front-end. A consulta atual encontrou 571 nós do perfil autopeças, incluindo categorias sem produtos, que **não** devem aparecer como disponibilidade na vitrine.

## Contrato de API

Em `supabase/functions/loja-publica/index.ts`, a resposta Mobis preserva `categorias` (folhas legadas) e acrescenta:
- `arvore_categorias: Array<{id,nome,slug,pai_slug,nivel,total}>`, **somente** nós que tenham SKUs publicados no próprio ramo. `total` conta os produtos, sem criar SKUs.
- `produtos[].categoria_caminho: Array<{nome,slug}>`: linhagem da peça realmente vinculada.
- `categoria` como filtro agora aceita slug de pai, filho ou neto **apenas** se estiver na árvore publicada. Outros tenants usam o comportamento legado.

A estrutura vem de leitura limitada por `perfil_ramo=autopecas`. Se houver falha, ciclo, pai ausente ou limite de consulta atingido, a árvore falha fechada e a UI preserva o filtro plano antigo. A API continua filtrando loja e `publicado=true` antes da exposição.

## Regras técnicas

- **Sem alterações no Bling**, NCM, CFOP, estoque, preço, pedido, composição pai/filho ou homologações.
- Fotos apenas de `imagens_publicaveis`, marca/referências de dados aprovados; nenhuma imagem de fornecedor extraída da internet automaticamente.
- Compatibilidade: só de `produto_aplicacoes.status = aprovado`. Montadora e nome de modelo da navegação não homologam aplicações.
- A página de produto usa abas **Descrição**, **Especificações técnicas** e **Utilização em veículos**. Dados ausentes são marcados para confirmação, não preenchidos por IA.
- Todas as mudanças de UI são escopadas à MOBIS; Conecta.IA mantém a própria identidade.
- Sem deploy ou publicação automática. O código é apresentado na [PR #445](https://github.com/nanoconecta-ia/conecta-ia/pull/445) para revisão e testes.

## Controle de qualidade

Verificar na CI: TypeScript/Vite, testes da Edge Function, Playwright em 360, 390, 720 e 1280 px, navegação pai→filho→SKU, ausência de itens não publicados e não regressão de Conecta.IA. Revisar acessibilidade de tabs e breadcrumbs.

## Guia visual e assets

[Drive — Identidade Visual Oficial da MOBIS](https://drive.google.com/drive/folders/1erX6xhGuIenFWtrjRIRHV7EpnT_yrxS3).

Os exemplos Trim-Go, ícones metálicos e screenshot Bosch fornecidos na conversa são **referências de arte e navegação**. Não transformá-los em afirmações de preço, peça física disponível ou aplicação técnica sem correspondência aprovada.
