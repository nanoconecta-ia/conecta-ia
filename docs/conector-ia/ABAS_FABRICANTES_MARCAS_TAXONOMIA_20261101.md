# Conecta.IA — Marca/Fabricante como eixo independente da taxonomia veicular

Status: **arquitetura + Skill para implementação pelo Claude Code, sem código de produção, testes de integração nem migrações implantadas**. Issue #201; articulação com PRs #199 (Skills e SEO), #196 (fidelidade visual), issue #194 (mídia HD/Drive/R2).

## Desenho de experiência

Menu público por loja:
- **Início**
- **Fabricantes e Marcas** — diretório próprio, livre de filtro de veículo
- **Categorias** — famílias técnicas (motor, arrefecimento, correias etc.)
- **Veículos e Motores** — catálogo de aplicações veiculares aprovadas
- **Busca por Código** — SKU Bling, GTIN, MPN, referência OEM com identificação de TIPO

Ao abrir Fabricantes e Marcas:
1. Cartões apenas das marcas HOMOLOGADAS com ao menos um produto publicado/licenciado na loja; filtro A-Z e busca por nome/alias aprovado.
2. Página individual com texto institucional curto e fonte, opcional banner homologado, categorias presentes naquela loja e grade paginada de produtos.
3. Dentro da página da marca, aplicar opcionalmente filtros por categoria, modelo/motor/ano, diâmetro de pistão, STD/0,25/0,50 etc. sem perder filtro de marca.
4. SKU abre ficha técnica única, exibe MPN/GTIN/OEM em linhas separadas, medidas e restrições, preço/estoque do Bling, fotos reais autorizadas, e seção de referências cruzadas que distingue correspondência de homologação.

### Exemplo visual do fluxo

Fabricantes e Marcas > MAHLE / Metal Leve > Componentes de Motor > Pistões > SKU existente no Bling.
Outros caminhos para o **mesmo SKU** podem ser: Categorias > Pistões > mesmo SKU; Veículos > HR 16V > Pistões > mesmo SKU.
NÃO criar um cadastro de produto em cada caminho; ligações são relacionamentos N:M.

## 1. Modelo, reúso de banco e divergências

Tabelas já disponíveis em migrações: fabricantes_peca, pecas_ref, fornecedores_oem, produto_pecas_ref, ref_cruzada, pecas_aplicacoes_tecnicas, taxonomia_nos, produto_enriquecimento. A origem primária dos SKUs é o cadastro do Bling por loja.

Necessidade a verificar em migration **futura isolada**:
- marcas_comerciais (nome, slug, homepage oficial verificada, titular se comprovado, grupo empresarial opcional, fonte, revisão, status)
- marcas_alias (nome alternativo/abreviação/grupo, tipo, fonte, status; **nunca fazer merge por similaridade apenas**)
- marca_fabricante_relacoes (marca ↔ empresa fabricante com papel e evidência por período/linha; não assumir que uma marca sempre é a fábrica)
- loja_marcas (loja_id, marca_id, descrição e banner revisados, licença/direitos, flag pública, auditoria)
- produto_marcas (loja_id, produto_id, marca_id, fonte, status, versão) **somente se a ligação não puder ser derivada fielmente do espelho do Bling + link aprovado a pecas_ref**.

Evitar excesso de tabelas e **usar índices existentes** primeiro. A marca de venda no Bling não deve obrigatoriamente ser o fabricante de motor ou montadora. SKU do ERP nunca é substituído por códigos de terceiros.

### Classificação que o Nano precisa explicar

| Campo | Exemplo/observação | Pode inferir? |
|---|---|---|
| sku_loja | CI... existente no Bling | Não inventar |
| codigo_no_fornecedor | Código impresso no XML/aba fornecedor do Bling | Fonte NF, não é fabricante |
| codigo_fabricante_mpn | Referência do catálogo/embalagem confirmada | Só com catálogo ou documento |
| codigo_importador | Referência comercial do importador | Não é OEM |
| gtin | GTIN da unidade comercial, se válido | Não criar para revenda |
| referencia_oem | Referência de código de montadora | Não prova originalidade |
| fabricante_efetivo | Pessoa jurídica que fabrica peça concreta | Só com prova |
| marca_comercial | Marca que identifica venda | Separada de fabricante |
| classificacao_oe/genuina | Genuína, OE/OES, aftermarket, a confirmar | Somente evidência por SKU |

O Bling documenta separadamente o código SKU interno e o código no fornecedor no cadastro; conferir mapeamento na API v3 antes do adaptador, sem tocar notas fiscais já emitidas. Referência: https://ajuda.bling.com.br/hc/pt-br/articles/360036756914-Como-cadastrar-produtos .

## 2. Entrada por NF: pipeline mínimo

Entrada: XML fiscal por loja, em leitura. Extrair chave, emissor (privado), produto descrito, códigos fornecidos, NCM/CFOP **somente para preservação fiscal**; não alterar NCM/CFOP e não enviar dados privados para pesquisa pública.

Normalização: procurar por (loja_id, bling_id/sku), vínculo de fornecedor, GTIN da UNIDADE certa, MPN, embalagem, descrição e características.
Se candidato múltiplo: marcar conflito e pedir revisão; nunca criar SKU novo ou juntar códigos automaticamente.
Enriquecimento: catálogo oficial da marca > documento técnico > distributor corroborado > pesquisa web como pista; sempre registrar fonte, data, identificador exato e versão.
Proposta de Marca: página institucional e aliases são propostas; só ativar quando confirmada identidade e SKU autorizado. Aplicações e medidas de engenharia passam pelos próprios validadores.
Saída: diff por campo, fila de aprovação e leitura posterior à escrita no Bling (se futuramente autorizada).
Idempotência: segunda importação do mesmo XML não duplica SKU, atributos nem dados de origem.

## 3. Hierarquia de marcas e relações comerciais

- MAHLE Metal Leve S.A. é empresa associada a várias linhas e marcas. Marca comercial MAHLE e marca Metal Leve podem ser apresentadas separadamente ou como grupo de marcas **conforme o produto e documentação**, sem fusão automática.
- KS = Kolbenschmidt quando registro oficial/MPN sustentar. Motorservice é a organização de venda do aftermarket do grupo Rheinmetall, não necessariamente a inscrição comercial no produto.
- Frontier Genuine Parts é descrita como marca comercial em lojas de reposição (ex.: código F26603). **Não anunciar vínculo com Nissan Genuine Parts** sem fonte primária; "Frontier" no nome da marca não atribui a peça a Nissan Frontier.
- Importados são cadastrados de forma neutra; preferências de recomendação são independentes da classificação de procedência e não apagam SKUs.

**Cross-reference não é equivalência:** preservar origem/destino, código e tipo da relação com fonte. Uma referência OEM igual em dois fabricantes só indica correspondência documental a ser verificada. Não existe equivalência transitiva automática A=B, B=C -> A=C. Validar medidas, variante, ano, kit/conteúdo e material.

## 4. SEO e imagens

- Rotas reais SSR sob domínio próprio: /marcas/ e /marcas/{slug}; não depender de hash e não indexar página sem itens.
- HTML H1/description, URL canônica, breadcrumbs, descrição original da marca com **fonte oficial**, links de categoria e produto.
- Dados estruturados: BreadcrumbList, CollectionPage e ItemList quando apropriados; Product/Offer somente nas páginas de produto com dados visíveis e reais. Não prometer rich result da página de marca.
- Fotos: não usar imagens do buscador/Google Drive como URL definitiva. Somente variant CDNs próprias e licenciadas. Banner com texto e fotografia própria/regularmente licenciada; uso de logo oficial ou alegação de "representante autorizado" requer exame de direitos e prova de credenciamento.
- A vitrine atual web/src/lib/vitrine.ts lê produtos publicados com limite 60 e imagens aprovadas sem verificar diretamente os direitos — dois **bloqueadores de rollout**: paginação por marca no servidor e leitura exclusivamente de mídia publicável com licença confirmada.
- No catálogo público não exibir custo, dados fiscais do fornecedor ou NF.

## 5. Exemplo de conteúdo institucional a ser aprovado

**MAHLE / Metal Leve**: “A MAHLE Metal Leve atua no segmento de componentes para motores, com linhas de pistões, anéis, bronzinas, camisas e válvulas. Consulte os produtos disponíveis nesta loja e confira a aplicação técnica por código.” Fonte https://catalogo.mahle.com/ .

**KS / Kolbenschmidt**: “Kolbenschmidt (KS) é uma marca de componentes de motor comercializada pela MS Motorservice para o mercado de reposição. Confira os códigos e as peças disponíveis nesta loja.” Fonte https://www.ms-motorservice.com/br/pt_br/empresa/nossas-marcas/visao-geral/ .

**Frontier Genuine Parts**: só depois de fonte institucional que comprove titularidade/fabricante. Até lá, exibir marca comercial em produto confirmado, sem institucional fictício nem associação a Nissan.

## 6. Plano para Claude Code

**PR A — sem migração:** contratos tipados e mocks de marca/alias por loja, comparador de cadastro, testes de identificador/procedência, normalização conservadora de aliases; documentação e arquivos de fixture.
**PR B — leitura/UI:** diretório público e página por marca em SSR, grade paginada e filtros independentes, noindex de páginas sem produtos; sem banner de terceiros, sem dados sigilosos. Revisar autorização de imagens.
**PR C — banco/aprovação:** aplicar somente as tabelas de marca realmente necessárias, RLS, índices, migração reversível, vínculo com nota/produto, provas, dedup e aprovação; deploy só autorizado.
**PR D — mídia e SEO:** banner institucional permitido, texto oficial revisado, CDN e SEO por marca com Rich Results Test e Search Console quando site de teste publicado com permissão.

Cenários negativos: NF sem MPN, código de fornecedor igual OEM mas peça diferente, embalagem GTIN incompatível, "KS" ambíguo, 8V confundido com 16V, importado descrito como genuíno, Frontier Genuine Parts fundida com Nissan, foto sem licença, ausência de estoque, marca com >60 produtos, loja A lendo compra da loja B.

**Sem merge/deploy/alteração fiscal, banco, DNS, Bling ou publicações Meta/Google sem aprovação específica do proprietário.**
