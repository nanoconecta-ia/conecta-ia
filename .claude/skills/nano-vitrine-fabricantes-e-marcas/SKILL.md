---
name: nano-vitrine-fabricantes-e-marcas
description: Reconhece marcas e fabricantes por XML de nota, MPN, GTIN e cadastro Bling, cria propostas de vínculo com SKUs e taxonomia sem duplicar itens, e prepara vitrine pública por marca com fontes e direitos validados. Acionar para marcas, fabricantes, referências cruzadas, banners institucionais e produtos por marca.
---

# Nano.IA — Skill Fabricantes e Marcas

STATUS: projeto/documentação, não implementado. Uma Skill orienta o agente, mas não substitui validadores determinísticos, aprovações e testes. Nenhuma escrita no Bling, migração ou publicação sem autorização.

## Entidades distintas

- Montadora e veículo: Hyundai, Kia, Nissan. Usados para aplicação, não para classificar marca da peça.
- Marca comercial da peça: MAHLE, Metal Leve, KS/Kolbenschmidt, Frontier Genuine Parts, quando conferidas.
- Fabricante efetivo: quem produziu a peça específica, somente se documentado; pode não ser a mesma entidade da marca.
- Importador/distribuidor/fornecedor: dados comerciais e de origem separados; custo e NF de compra são privados por loja.
- Genuína, OE/OES e aftermarket: classificação técnica de cada SKU com prova; um código OEM de referência, logo ou palavra "Genuine" não torna item genuíno de montadora.

Não confundir MAHLE/Metal Leve como sinônimos universais nem juntar SKUs automaticamente. KS é abreviação contextual de Kolbenschmidt quando comprovada. A marca comercial "Frontier Genuine Parts" é encontrada em anúncios de reposição, mas NÃO equivale automaticamente a Nissan Genuine Parts, nem indica compatibilidade com o veículo Frontier.

Fontes iniciais: https://catalogo.mahle.com/ ; https://www.ms-motorservice.com/br/pt_br/empresa/nossas-marcas/visao-geral/ ; https://www.nissan.com.br/proprietarios/pecas-produtos.html .

## Grafo canônico, nunca classificação só por palavras

O esquema lógico diferencia loja, marca, fabricante, SKU interno Bling, código fornecedor, MPN, GTIN, OEM de referência, peça técnica e aplicações N:M. Eixo da vitrine de marca independente das categorias e aplicações:
Fabricantes e Marcas -> marca homologada -> categorias técnicas em estoque/publicadas -> SKU -> ficha técnica.
A seleção de marca NÃO exige escolher modelo de veículo. O filtro veicular pode ser combinado depois, sem modificar a marca.

Reaproveitar fabricantes_peca, pecas_ref, produto_pecas_ref, fornecedores_oem, ref_cruzada, taxonomia_nos, produto_enriquecimento, bling_categoria_taxonomia e as funções de intercâmbio existentes. Não recriar tabela global de SKU nem duplicar ERP. Novas tabelas somente se comprovadamente necessárias (marca comercial separada da pessoa jurídica e habilitação por loja).

## Pipeline da nota fiscal para página de fabricante

1. Ler XML fiscal somente na loja autorizada, preservar conteúdo original e não enviar dados sensíveis para LLM público. NF comprova operação de compra e código informado pelo emissor, não certifica fabricante efetivo, autorização de distribuidor ou relação com a montadora.
2. Parear por identificador Bling, SKU, código no fornecedor, MPN, GTIN, unidade/embalagem e referências. Fazer análise de duplicidade antes de propor novo SKU; reimportar XML não pode criar produto extra.
3. Normalizar nome para busca, mas preservar nome de marca exato. Criar aliases tipados com fonte, data, status e revisão. "MAHLE"/"Metal Leve" podem ter relação de grupo/linha com prova, mas nunca merge cego. "FRONTIER GENUINE PARTS" não vira Nissan Genuine Parts.
4. Consultar fontes oficiais por MPN; conferir diâmetro, STD/0,25/0,50, composição do kit, motor/versão, aplicações e contraindicações. Foto ou OCR, sem documento, são pistas, não homologação. Marcar incertezas explicitamente.
5. Guardar propostas para marca, fabricante, classificação genuína/OE/reposição, MPN/OEM, medidas, aplicações, descrição curta/complementar do Bling, SEO e página de marca; revisão humana para cada decisão. Nunca mexer em NCM/CFOP ou na nota original.
6. Publicar somente dados técnicos, textos e fotos aprovados. Nunca vazar custo, fornecedor sigiloso, impostos ou CNPJ do emissor no site, Google/feeds ou materiais promocionais.

## Página da marca

Rota alvo: /loja/{slug}/marcas/{marcaSlug} sob domínio público verificado, sem fragmento #, com HTML inicial SSR/SSG, canonical, breadcrumb e links para produtos. Menu separado "Fabricantes e Marcas". A página deve incluir:
- título e descrição original curta da marca com fonte oficial;
- linhas reais: pistões, anéis, bronzinas, camisas, válvulas e outras categorias somente se houver fonte e produtos dessa linha;
- banner institucional com fotografia própria/licenciada e logotipo autorizado, ou marca textual neutra sem endosso fictício;
- grade de itens publicados daquela loja com preço/estoque válidos do Bling e imagens publicáveis com direitos; paginação server-side, não limitada aos 60 primeiros itens;
- filtros independentes por família técnica, marca, motor, veículo, ano, medida STD/retífica, MPN, OEM e GTIN; mostrar restrições quando necessárias;
- Indexação só quando marca aprovada e houver itens públicos reais; sem conteúdo, deixar fora de sitemap e não criar página SEO vazia.

Exemplos de rascunhos institucionais, sujeitos a aprovação:
MAHLE/Metal Leve: "A MAHLE Metal Leve atua no segmento de componentes para motores, com linhas como pistões, anéis, bronzinas, camisas e válvulas. Confira as peças e aplicações confirmadas no catálogo da loja." Referência https://catalogo.mahle.com/ .
KS/Kolbenschmidt: "Kolbenschmidt é uma marca de componentes para motores comercializada no mercado de reposição pela MS Motorservice. Conheça os produtos disponíveis na loja, identificados pelo código técnico." Fonte https://www.ms-motorservice.com/br/pt_br/empresa/nossas-marcas/visao-geral/ .
Frontier Genuine Parts: não escrever biografia ou indicar relação com Nissan até comprovar fabricante/titularidade com fonte primária. Nome comercial visto em anúncios não é selo de originalidade.

## Cruzamento entre fabricantes

As relações não são transitivas. Mesmo OEM em dois catálogos NÃO prova equivalência. Respeitar tipos existentes em multiagente/relacoes.ts: hipótese, referência cruzada, equivalência funcional, equivalente validado, substituto homologado. Cada vínculo tem fonte, data, estado, modelo/versão/motor e medidas. Divergência de diâmetro, STD/0,50, ano, sensor, pinagem, composição ou material pode invalidar intercâmbio. Exibir "Referências relacionadas a conferir" separado de "Equivalentes homologados".

## Segurança e qualidade

- Catálogo por loja: produto, estoque, preço, foto autorizada, banner, descrição e licença não migram entre tenants. Fatos oficiais genéricos da marca podem ser globais, com fonte e curadoria.
- Não alegar ser revenda autorizada da marca apenas porque comprou de distribuidor com NF.
- Sem logotipo/foto licenciado: não copiar imagens da busca web; usar texto neutro, sem falsa afiliação.
- Sincronizar dados com Bling como origem; somente propostas de alteração por campo, diff antes/depois e leitura de confirmação depois de aplicar.
- Skill complementar: nano-metrologia-procedencia-cdc (PR #199), nano-fidelidade-visual (PR #196) e Skills SEO/catalogo do PR #199.

## Testes obrigatórios para Claude Code

1. Importar NF duas vezes -> zero duplicação de SKU e arquivos, com auditoria.
2. Marca Frontier Genuine Parts -> NÃO gerar Nissan Genuine Parts nem veículo Nissan Frontier automaticamente.
3. MAHLE e Metal Leve com relação documental -> aliases relacionados, preservando identidade comercial de cada item.
4. Duas marcas com mesmo OEM, medidas distintas -> sem equivalência técnica publicada.
5. Uma marca com pistões, anéis e bronzinas -> três categorias na mesma página, sem criar subcategorias de marca duplicadas no Bling.
6. Nenhum dado de fornecedor/custo/nota no site ou prompt público; teste cruzado entre duas lojas.
7. Página indexável somente com itens publicados e fotografias licenciadas; navegação e filtros combináveis por veículo, com paginação >60.
8. Escrita no Bling, publicação de banner, criação de marca e migração sempre bloqueadas sem aprovação.

**Handoff:** issue #201. Documentar validações executáveis, SQL RLS, fixture de XML sem dados privados e PRs pequenos, sem merge/deploy até aprovação.
