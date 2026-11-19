# MOBIS — Norma proposta do porteiro para cadastro técnico em lotes
Data: 19/11/2026. Estado: rascunho de regra de negócio; **não está implantada no gateway nem no banco**. Escopo: Conecta.IA / loja MOBIS.

## Princípio de produtividade
O lojista não deve conduzir pesquisa detalhada SKU por SKU. A investigação exemplar do CI003696 calibra **receitas reutilizáveis por família técnica** (ex.: motor D4CB 16V). O agente faz pesquisa, separa evidência e pendências e propõe em lote; o proprietário revisa um resumo de diferenças e só intervém em conflitos, sendo a aprovação humana obrigatória antes de qualquer publicação ou escrita.

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
