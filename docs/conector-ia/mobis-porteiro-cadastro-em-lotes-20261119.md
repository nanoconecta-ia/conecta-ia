# MOBIS — Norma proposta do porteiro para cadastro técnico em lotes
Data: 19/11/2026. Estado: rascunho de regra de negócio; **não está implantada no gateway nem no banco**. Escopo: Conecta.IA / loja MOBIS.

## Regra universal — todos os modelos e SKUs podem ser cadastrados SEM FOTO
Para todos os produtos reais da MOBIS (independentemente de marca, veículo, família ou SKU), ler a **[norma de fotos opcionais, busca de imagens e preenchimento posterior](mobis-cadastro-sem-foto-todos-skus-20261119.md)**. O agente deve identificar a peça no Bling, procurar imagem real com fonte/direitos dentro do orçamento de 15 segundos por SKU e **prosseguir com o cadastro técnico/rascunho do site** mesmo se não encontrar fotografia. Na loja MOBIS, foto ausente é pendência de complementação pelo lojista, **não bloqueia a publicação se os demais portões forem satisfeitos e o proprietário aprovar**. Nunca substituir por foto de peça parecida; sem imagem aprovada, mostrar placeholder neutro. Manter aplicação/OEM sem comprovação fora de páginas públicas. Produto pausado continua pausado. A publicação sem foto já é permitida pelo portão do banco MOBIS; os processos automáticos de catalogação em lote e busca de imagem ainda precisam ser implementados e testados.

## Princípio de produtividade
O lojista não deve conduzir pesquisa detalhada SKU por SKU. A investigação exemplar do CI003696 calibra **receitas reutilizáveis por família técnica** (ex.: motor D4CB 16V). O agente faz pesquisa, separa evidência e pendências e propõe em lote; o proprietário revisa um resumo de diferenças e só intervém em conflitos, sendo a aprovação humana obrigatória antes de qualquer publicação ou escrita.

## Roteiro obrigatório de fontes: onde achar cada peça em até 15 segundos
O agente deve consultar antes de tudo **[o mapa rápido de fontes GS1 Brasil + NCM + EPC + montadoras/importadores + B2B + marketplaces](fontes-pesquisa-rapida-sku-ncm-gs1-20261119.md)**. Esse arquivo orienta **todos** os agentes, não apenas uma sessão do Claude/GPT, e define a busca de SKU + GTIN + NCM + descrição com evidência e **orçamento GLOBAL de 15.000 ms por SKU** (incluindo retorno parcial). A integração real, `deadline` e `AbortController` ainda dependem de implementação e teste do executor — não declarar pronta pela existência desta norma.

Prioridade da pesquisa: Bling/XML/etiqueta → **GS1 Verified by GS1/CNP (quando houver GTIN)** → **PartSouq/EPC original** → **portal nacional da montadora/importadora do período (CAOA/Hyundai Brasil; Kia Brasil/KMB/Grupo Gandini; equivalentes verificados de outras marcas)** → **fabricante de peça / fornecedor OE com prova** → **importadores e catálogos B2B** → e-commerce/Mercado Livre/Shopee, **somente para pistas**. O NCM permite localizar classes e candidatos, inclusive pela GS1 Other Keys (API sujeita a plano), mas jamais comprova identidade única ou aplicação.

## Cadastro por descrição e nascimento/fim das versões brasileiras
Consultar obrigatoriamente **[pesquisa por descrição, genealogia pai/filhos/primos e exemplos Hyundai HR e VW Gol](roteiro-descricao-genealogia-veicular-br-20261119.md)**. Entrada sem SKU (`motor para HR 2013`) **é válida**: resolver modelo/mercado BR/ano, detectar várias gerações no mesmo ano, documentar motor e cilindros, retornar candidatos e só depois cruzar produto físico existente no Bling. Os anos de início/fim do MODELO não são os de cada MOTOR ou versão; último ano de catálogo de reposição não é prova do encerramento da montadora. Filhos = versões com documentos; primos = aplicações relacionadas sem equivalência automática. Sem evidência, permitir hipótese/consulta, **não** publicação.

## Entrada e processamento por lote
1. Receber lista de SKUs atuais do Bling em modo consulta. Deduplicar por `loja_id + bling_id + sku`; manter UM produto físico, SEM clonar estoque.
2. Recuperar receitas aprovadas por fabricante da peça, família técnica, motor e geração. Consultar primeiro base de evidências/cache interno com data e validade; pesquisar fontes externas (PartSouq/EPC + CAOA/Hyundai Brasil, Kia Motors do Brasil/KMB e fabricantes) **apenas para lacunas ou dados vencidos**. Não inferir ano brasileiro de lançamento internacional.
3. Para cada referência registrar: tipo `OEM_EPC`, `CODIGO_FABRICANTE`, `REFERENCIA_COMERCIAL`, `SIMILAR` ou `SUBSTITUTO`; fonte, data, figura/posição EPC, mercado, configuração, status e confirmação humana. Evitar que OEM de short engine seja declarado automaticamente intercambiável com bloco montado com cabeçote ou motor completo.
4. Criar ficha técnica **individual** por SKU: composição real, características e diferenças, bula, contraindicações, garantia e política de consumo em linguagem clara; NCM/CFOP fiscais são COPIADOS da fonte ERP sem edição pela IA, com divergências encaminhadas ao contador; dados logísticos reais (peso, medidas de embalagem e volumes), jamais inventados. Fotos reais com licença e vínculo de SKU.
5. Criar rascunho de **oferta por aplicação brasileira** (montadora + modelo + geração/versão + tração + motor + emissões + início/fim ou pendência do período comprovados), descrição SEO, título, metadescrição, URL, banner e FAQ específicos, com links internos para o mesmo SKU físico. Dados de aplicação não confirmados ficam `a_confirmar`, `noindex` e não publicados.
6. Cruzar outras marcas pelos catálogos de seus fabricantes. `referência listada` NÃO equivale a `compatibilidade física homologada`; só homologar após evidências técnicas de composição, medidas e eventuais ensaios.
7. Gerar painel único de lotes: **aprováveis / incompletos / conflitantes / bloqueados**, comparação antes→depois, fonte, data, responsável e conjunto exato de campos. O lojista aprova itens explicitamente identificados em lote; nenhum agente autoaprova. Divergência fica em fila, sem atrasar os SKUs independentes já íntegros.

## Porteiro de segurança (regra determinística, não apenas prompt)
- A operação de proposta deve ser separada de aprovação, publicação e escrita no Bling; validar em **servidor/banco** por loja, produto e campo.
- Falta de foto real homologada, OEM confirmado ou prova do ano brasileiro **não autoriza inventar**; preservar pendência. Nunca anunciar aplicação sem homologação.
- Se `produto_automacao.pausado=true`, permitir pesquisa e relatório consultivo mas não destravar, executar ou publicar automaticamente.
- Sem duplicar estoque e sem expor custo, fornecedor privado, preço de compra ou informação fiscal restrita ao comprador e a buscadores.
- Cada oferta deve conter descrição ao consumidor fiel a **conteúdo incluído, não incluído, compatibilidade condicionada, garantia, instalação e direito de informação**. Sem cláusulas que suprimam direitos assegurados pelo CDC. Revisão jurídica/fiscal quando exigida.
- Toda ação tem auditoria por agente/modelo, identificador imutável, evidência e aprovação humana com controle de versão. Uma aprovação em lote vincula o hash e a relação de itens; itens alterados não são aprovados implicitamente.

## Caso de calibração CI003696
Produto físico: Bling id `16719530075`; marca TRIM GO, descrição `MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE`.
- Ofertas independentes: Hyundai HR e Kia Bongo K2500; **mesmo SKU e estoque**.
- `2J0224AU00A`: referência EPC do grupo `SHORT ENGINE ASSY`; manter como candidato de referência técnica, **não como equivalência direta comprovada** ao motor com cabeçote.
- Outras referências EPC por composição completa/sub-engine só podem entrar com a posição/mercado/versão e fonte.
- Mercado brasileiro: base CAOA/Hyundai e Kia Motors do Brasil (KMB/Grupo Gandini), com faixas verificadas **por versão**; não presumir fim de comercialização.
- Situação consultada em 19/11/2026: 2 aplicações `a_confirmar`, zero códigos OEM aprovados, zero fotos, `publicado=false`, `produto_automacao.pausado=true`. **Manter todas as travas.**

## Entrega técnica exigida antes de declarar pronto
1. Implementar o portão nos validadores existentes `regras_aplicacao.ts`, `regras_seo.ts`, fluxo de aprovação do banco e projeção pública; **este documento sozinho não instala o porteiro**.
2. Criar testes de rejeição: EPC internacional sem ano Brasil, motor curto vs. com cabeçote, código comercial como OEM, fim de ano inferido, foto de outro SKU, duas aplicações como dois SKUs, publicação de pendente, aprovação automática por agente.
3. Testar lote com SKUs conhecidos, limites de consultas/cache e fila de exceções. Conferir CI e auditoria. Sem merge, deploy, NCM, NF, estoque ou preço alterados por esta proposta.
