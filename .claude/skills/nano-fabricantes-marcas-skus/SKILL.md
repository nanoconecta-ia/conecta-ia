---
name: nano-fabricantes-marcas-skus
description: Identificar marcas/fabricantes de autopeças a partir de SKU Bling, NF-e e catálogos oficiais, propor vínculo canônico, páginas de marca com texto/banner licenciado, categorias e produtos reais, mantendo busca por marca independente de aplicação/montadora e códigos cruzados sem falsa equivalência.
---

# Skill Nano.IA — Fabricantes, Marcas, NF-e, Catálogo e SKUs

## Propósito e escopo

O Nano deve ter **dois eixos de descoberta principais**, mais um terceiro eixo por código:
- **Fabricantes e Marcas:** MAHLE, Metal Leve, KS/Kolbenschmidt, Valeo, LuK, Sachs etc., se estiverem ligados a produtos reais homologados daquela loja;
- **Veículos e Montadoras:** Hyundai HR, Kia Bongo K2500, Nissan Frontier etc. — aplicações por motor/versão/ano somente com prova;
- **Buscar por SKU / GTIN / MPN / OEM / código do fornecedor:** procurar identificadores tipados, sem declarar que são o mesmo código.

Esses eixos se cruzam nos **mesmos produtos Bling**. Não existe SKU paralelo da marca, do site ou do Nano. Produto e variante têm um só cadastro por loja, com várias aplicações e múltiplas referências controladas.

O Nano produz **propostas, rascunhos e URLs candidatas**; não cria catálogo público, marca, produto, banner nem grava no Bling antes de aprovação por pessoa autorizada.

## 1. Dicionário de entidades — não confundir

- **Marca comercial da peça:** nome na embalagem e linha comercial do produto, com prova. Exemplo: `Metal Leve` é uma marca do portfólio `MAHLE`. **MAHLE Original** pode ser outra marca/linha; não reclassificar item Metal Leve como MAHLE Original.
- **Grupo / empresa / fabricante efetivo:** pessoa jurídica ou fábrica que produz o componente; não obrigatoriamente igual à marca nem ao fornecedor da nota.
- **Distribuidor/fornecedor NF-e:** quem emitiu a nota, não necessariamente dono da marca ou fabricante. O `cProd` da NF-e é código do **emitente**, não necessariamente `MPN`.
- **Importador:** participante da cadeia comercial; importação ≠ genuinidade ou qualidade. Cadastro transparente sem discriminação por origem; preferência comercial de recomendação configurada separadamente.
- **Montadora/linha genuína:** fabricante/representante do veículo e peça vendida sob identidade de montadora com documentação por SKU/lote; Nissan é montadora, `Frontier` é um **modelo de veículo**, não marca de peça própria chamada “Frontier Genuine Parts” sem prova.
- **KS:** resolver como **candidata à marca Kolbenschmidt** somente se rótulo, catálogo ou referência confirmarem; sigla curta sozinha é ambígua.
- **OEM:** referência/parte original de montadora (namespace próprio); `OEM-referência` ≠ fabricante físico ou peça genuína. `MPN` é código do fabricante da peça. `GTIN` depende da unidade comercial e validação. `SKU Bling` pertence à loja.

### Referência oficial para textos de marca

- MAHLE lista **Metal Leve** como marca de seu Aftermarket: https://www.br.mahle.com/pt/products-and-services/aftermarket/
- Catálogos MAHLE: https://www.mahle-aftermarket.com/la/pt/catalog/catalogo-mahle/
- Kolbenschmidt/Motorservice: https://www.ms-motorservice.com/
- Peças Genuínas Nissan: https://www.nissan.com.br/proprietarios/pecas-produtos.html

**Direitos autorais:** descrição editorial deve ser **original e resumida**, com fonte, data e revisão. Não copiar catálogos/trechos grandes ou fotografias/logos sem licença; catálogo público não autoriza reproduzir identidade visual de terceiros.

## 2. Reutilização obrigatória no projeto

Inspecionar antes de alterar:
- `public.fabricantes_peca`, `public.pecas_ref`, `public.ref_cruzada`, `public.produto_pecas_ref`, `public.fornecedores_oem`: migr. `20261015000001_genealogia_tecnica.sql`;
- `public.filtros_da_vitrine`, `public.intercambio_da_peca`: migr. `20261019000014_camada_conhecimento_automotivo.sql`;
- `public.produtos`, `taxonomia_nos`, `bling_categoria_taxonomia`, `produto_codigos`, `produto_aplicacoes` e dados da loja já existentes;
- `painel/src/paginas/Taxonomia.tsx`, `painel/src/lib/navegacao.ts`, `web/src/app/loja/[slug]/page.tsx` e `web/src/lib/vitrine.ts`;
- `supabase/functions/_shared/seo/{jsonld,feed_merchant,dados}.ts` e `loja-seo`;
- parser LOCAL de NF-e `docs/diagnostico-2026-10-28/nfe_parser.py`: não se trata de importador automático em produção.

Se houver forma preexistente de associar a marca comercial ao fabricante, reutilizar. Senão, propor estrutura de `marcas_comerciais` (global, com proveniência) ↔ `fabricantes_peca` e `marcas_loja` (perfil editorial por loja) com RLS. **Não** enfiar marca em `taxonomia_nos` de peças, que é árvore funcional.

## 3. Ingestão de nota de fornecedor em modo proposta

1. Ler **somente documento autorizado à loja**, arquivo XML validado (estrutura NF-e, chave/dígito, protocolo de autorização, cancelamentos, emitente e itens); não abrir NF de terceiro sem autorização nem enviar dados de custo/CNPJ completo/tributação a LLM público.
2. Por item extrair `nItem`, `cProd` (código fornecedor), `xProd` (descrição nota), `cEAN` (verificar DV GTIN), `CNPJFab` opcional, descrição e identificadores inferidos **como candidatos**. NCM, CFOP e valores fiscais permanecem intocados/privados.
3. Confrontar com produto Bling existente por `loja_id + bling_id + sku`. Fazer matching de código fabricante/GTIN + marca/embalagem + variante comercial, sem duplicação; empates recebem status `ambiguidade`.
4. Buscar catálogo OFICIAL por MPN, GTIN e item, registrar `fonte, data, versao`. **NF autenticada prova declaração e aquisição, não prova sozinha fabricante original, marca certificada ou certificação INMETRO**.
5. Classificar `marca_comercial`, `fabricante_efetivo`, `grupo_empresarial`, `fornecedor`, `importador`, `linha_genuina`, `oem_referencia`, `mpn` em campos diferentes. Não copiar informações fiscais para site.
6. Criar **proposta versionada** com diferenças `antes/depois` para o lojista aprovar. O agente não cria automaticamente marca, equivalência nem alterou o Bling.

## 4. Catálogo por marca, independente do veículo

### Aba pública "Fabricantes e Marcas"

- Menu separado de `Categorias` e `Veículos e Montadoras`, com cards de marcas **efetivamente vendidas por aquela loja** e contagem de produtos publicados.
- Rota server-rendered por loja `/loja/[slug]/fabricantes/[marca-slug]` e domínio canônico `/fabricantes/[marca-slug]` quando houver resolução do domínio; mostrar HTML real sem hash `#/`, segurança, links e breadcrumbs.
- Página de marca: nome comercial verificado, grupo/fabricante quando identificado, breve descrição factual e escrita originalmente, **banner e logo licenciados**, grupos de produtos com hierarquia funcional `Marca → Família (pistões, anéis, bronzinas...) → SKU`, disponibilidade/estoque e fotos publicáveis; filtros paralelos `veículo / motor / ano / medida / código`. Não mostrar marca sem SKUs publicados como "representada".
- Marca sem produtos publicados = não criar página vazia indexável; mostrar estado informativo/noindex, quando necessário.
- Não declarar que loja é **revendedora oficial, distribuidora autorizada ou representante** sem contrato/evidência; merchandising com informações oficiais não concede autorização comercial.
- Banner é **composição visual com ativos licenciados**, não foto de produto alterada; seguir a Skill `nano-fidelidade-visual` do PR #196.
- Google: páginas de produtos em `Product + Offer`; páginas agregadoras de marca são listas/coleções com breadcrumbs e links, **não um único Product inventado**. Cada SKU mantém `brand` de sua marca real, `mpn` e `gtin` verificados, canonical e feed consistentes. Não gerar Schema Organization alegando que Mobis = fabricante MAHLE/KS.

### Navegação cruzada

Usuário pode ir tanto de `Fabricantes > Metal Leve > Pistões > SKU...` quanto de `Montadoras > Hyundai > HR > Motor > Pistões > SKU...`, ou colar MPN/GTIN/OEM. A mesma ficha aparece por consulta, sem novo cadastro.

## 5. Códigos cruzados: grafo de EVIDÊNCIAS, não de igualdade

Tipos:
- `mesma_referencia_de_catalogo` (citação, **não** substituição assegurada),
- `equivalencia_funcional` (proposta técnica, revisada),
- `equivalente_validado` (ensaio/documentação/medidas/versão suficientes),
- `substituto_homologado` (substituição formal, ressalvas e mercado).
- `mesmo_GTIN` só depois de verificar **unidade, quantidade/embalagem e marca comercial**; reuso de GTIN errado gera conflito, não merge.

Cada aresta A→B tem `fonte`, `tipo`, `data`, `versão`, `medidas`, `condições_uso`, `aplicações`, `status_aprovacao`. **Sem transitividade**: A–B + B–C não implica A–C. As versões STD, 0,25, 0,50, 8V, 16V, flanges, pino/diâmetro e tolerâncias precisam conferir por par.

No resultado de busca, distinguir `mesmo_produto`, `equivalente_aprovado`, `referencia_encontrada_na_web`, `alternativa_nao_verificada`. Não usar link “compre este equivalente” para vínculos só candidatos.

## 6. Cadastro gerado para canais

Do mesmo **produto existente** gerar rascunhos, sem copiar textos entre canais como fatos:
- **Bling `descricaoCurta`**: peça + marca real + MPN + aplicação curta aprovada;
- **Bling `descricaoComplementar`**: ficha técnica em mm, condições/contraindicações, códigos com `referencia` rotulada, advertências CDC, sem custo/fornecedor confidencial;
- **PDV**: ficha rápida por SKU, MPN, OEM referência, marca, estoque e restrições;
- **SEO público/Google**: página única por SKU, dados estruturados da peça real, preço/estoque do Bling e URL canônica;
- **WhatsApp/Instagram/Meta**: rascunho editorial com condições verificadas e licença, sem envio automático.

## 7. Testes mínimos de aceite do Claude Code

1. XML fictício item `cProd=ML-123`, `xProd="PISTAO METAL LEVE"`, nenhum `CNPJFab`/MPN/catálogo: **não** classificar como fabricante certificado/genuína automaticamente; marcar `cProd` do fornecedor.
2. "Mali Metal Leve" como digitação do usuário sugere `Metal Leve` somente como candidato; catálogo confirma antes de associar.
3. `KS` sozinho não basta; `Kolbenschmidt` com referência do fabricante apoia marca após prova.
4. "Frontier Genuine Parts" → modelo Frontier + possível linha Peças Genuínas Nissan; não criar fabricante “Frontier Genuine Parts”.
5. Marca Metal Leve e linha MAHLE Original, mesmo grupo, **permanecem marcas distintas** em páginas e feeds.
6. Duas peças de marcas distintas com o mesmo código OEM de referência continuam dois produtos; só apresentar equivalência se relação direta aprovada com medidas/família de peças e restrições.
7. `SKU 123` em Loja A não aparece em Loja B; marca global pode existir mas perfil e estoque publicados são por loja.
8. Produto sem licença de logo/imagem, sem SKU publicado ou com estoque inválido não gera banner de oferta nem página de marca com propaganda falsa.
9. Navegação por marca + veículo + código leva à mesma ficha; links crawlable sem `#/...`; JSON-LD `brand` condiz com marca real.
10. Proposta nunca grava dados na NF-e/ERP, altera NCM/CFOP/custo, cria SKU duplicado ou envia algo ao Google/Meta/WhatsApp sem autorização.

## Handoff para Claude Code

Implementar em PRs isolados: P0 modelo/vínculo/validador de identidade; P1 perfil editorial/aba/página SSR; P2 mecanismo de códigos cruzados e PDV; P3 SEO/feed/analytics; integração ao Nano chat único. Exigir testes e captura de evidência; registrar implementação local vs ambiente real. **Nenhum merge, deploy, migração, mudança de DNS, Bling ou conteúdo publicado sem autorização explícita.**

Relacionadas: issue #200; #198, PR #199, #194, PR #196.
