# MOBIS — Proposta auditável de cadastro comercial CI003696
**Data:** 2026-11-19. **Status:** FICHA PREPARADA, NÃO GRAVADA NO CADASTRO PÚBLICO. `produto_automacao.pausado=true` e `publicado=false` confirmados por consulta de leitura ao Conecta.IA. Sem desbloqueio, escrita, autoaprovação, deploy ou alteração Bling.

## Produto físico (Bling API, leitura real em 19/11/2026)
- `loja=mobis`; `SKU=CI003696`; `bling_id=16719530075`; marca `TRIM GO`.
- `nome_original=MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V NOVO PARCIAL C/ CABECOTE - MARCA: TRIM GO`.
- Descrição curta do Bling: `Motor parcial com cabeçote HR/K2500 2.5 16V D4CB Euro V - Trim Go`.
- `preco_tabela_bling=R$ 18.900,00` (preço visto, não promessa promocional); `ncm_original=8408.90.90` **imutável pela IA**; `gtin=ausente`; `peso_bruto_bling=135 kg` (embalagem/logística não aferidas); `largura/altura/profundidade=ausentes`; `imagens_bling=0`.
- Não duplicar produto físico, custo ou estoque. Duas aplicações do Conecta.IA têm estado `a_confirmar`, sem indexação, sem foto e sem OEM aprovado.

## Cruzamento rápido documental HR × Bongo (19/11/2026)
**A família de motor D4CB 2.5 16V Euro V É compartilhada em aplicações de reposição nos dois veículos.** Não declarar que HR e Bongo têm famílias de motor distintas nem bloquear a segunda oferta apenas por a montadora ou a injeção veicular ser diferente. Evidências de peças-sentinela:
- **Vedamec — jogo de juntas** do motor **91606** (variações com/sem junta de cabeçote, retentores, material de junta), catálogo HYUNDAI/KIA 2023, página interna HYUNDAI 014, lista `HYUNDAI HR 2.5 16V D4CB Euro 5 13/22` e `KIA BONGO/K2500 2.5 16V D4CB Euro 5 13/22` na **mesma família de referência**: https://www.vedamec.com.br/files/catalog/HYUNDAI-2023.pdf . **2013–2022 é período de aplicação deste catálogo**, não data final de produção ou venda dos veículos.
- **Motorservice — catálogo de peça de reposição** lista a família D4CB 2.5 16V DOHC quatro cilindros para HR e Bongo K2500, em entradas `2013–2026`, como cobertura de catálogo — NÃO prova encerramento em 2026: https://www.catweb.ms-motorservice.com.br/detalhes.php?cw_pgAtual=95&cw_produtoAtivo=CodigoProduto%3C%212%21%3E5395 .
- **Filtro e injeção por versão**: catálogo Bosch de filtros da HR 2.5 Euro V D4CB desde 01/2013: https://www.boschaftermarket.com/xrm/media/images/country_specific/br/downloads_19/pdf_9/catlogo_filtros_2019_linha_leve.pdf ; ficha CAOA HR Euro V 2.5 D4CB identifica `CRDI Delphi`, enquanto a ficha Kia Bongo lista `Common Rail Bosch`: https://www.caoa.com.br/uploads/product/2021/07/13/ficha-tecnica-hr-jan-21.pdf e https://www.kia.com.br/bongo/especificacoes/ . Marca de injeção é **atributo da configuração**; comparar interfaces e periféricos do motor comercial, não presumir exclusão automática da aplicação D4CB.
- **Conclusão operacional:** `HR D4CB 2.5 16V Euro V` e `Bongo K2500 D4CB 2.5 16V Euro V` são **duas candidatas técnicas fortemente corroboradas** para oferta por aplicação; o mesmo SKU físico CI003696 atende o modelo de catálogo único. Para homologar o motor parcial **Trim Go com cabeçote**, a marca/código e o conteúdo comercial ainda precisam combinar com a peça efetivamente vendida. A aplicação de juntas/filtros por si só não homologa o conjunto montado. Manter `a_confirmar` até validação permitida; não confundir sistemas de injeção do veículo com conteúdo incluso no bloco.

## Atualização do lojista: DUAS páginas independentes, uma peça física
Seguir [regra mestre de páginas por veículo com OEM e SEO](../../conector-ia/porteiro-master-ofertas-por-aplicacao-oem-seo-bling-20261119.md): a HR e o Bongo têm páginas editoriais próprias com título, meta description, termos de busca, código OEM por montadora (a confirmar no EPC), e ficha técnica específica da aplicação; ambas apontam ao estoque **CI003696**. O SKU informado em outra mensagem como `CI 0033696` diverge do SKU do Bling; **não alterar** até verificar nota fiscal/fornecedor. Catálogos de juntas confirmam família D4CB compartilhada, mas não o código OEM do motor parcial com cabeçote Trim Go. Enquanto `a_confirmar`, manter páginas não indexáveis e não anunciar compatibilidade não aprovada; catálogo geral sem foto e preço pode permanecer informativo.

## Ficha proposta do produto (não aprovada)
**Título curto:** Motor parcial com cabeçote Trim Go 2.5 D4CB 16V Euro V — HR / Bongo K2500

**Descrição técnica para análise:**
> Motor parcial novo da marca Trim Go, anunciado pelo distribuidor como conjunto **com cabeçote** para a família diesel 2.5 D4CB, 16 válvulas, Euro V. Referência de estoque MOBIS: **CI003696**. A composição exata de componentes internos e acessórios acompanha consulta/validação da embalagem e ficha do fabricante; não presumir turbina, bomba de óleo, bomba d’água, bicos, sensores, tampa, volante, sistema de injeção ou outros acessórios incluídos. Confirmar chassi, código e configuração do veículo antes da compra/instalação. A imagem está em atualização.

**Características já identificadas:** família motriz D4CB 2.5 turbo diesel; configuração veicular D4CB da HR Euro V com 4 cilindros em linha, 16 válvulas, injeção CRDI Delphi (fonte oficial CAOA para configuração da HR — não é atestado de que CI003696 contém injeção Delphi). Bongo K2500 D4CB documentado pela Kia em versões com injeção Bosch, exigindo confrontar versão e componentes de interface.

**Fontes de configuração de veículos:**
- CAOA ficha oficial HR Euro V: https://www.caoa.com.br/uploads/product/2021/07/13/ficha-tecnica-hr-jan-21.pdf (motor D4CB, 4 cil., 16v, Delphi, tração traseira 4x2).
- Kia Brasil, especificações Bongo: https://www.kia.com.br/bongo/especificacoes/ (motor D4CB, variantes Bosch; não confundir 4x2 e 4x4).
- Kia Brasil, fábrica Mercosul Bongo 4x2: https://www.kia.com.br/fabricamercosul .
- Motorservice catálogo de peças/ano: https://www.catweb.ms-motorservice.com.br/detalhes.php?cw_pgAtual=95&cw_produtoAtivo=CodigoProduto%3C%212%21%3E5395 (anos de aplicação aftermarket, não fim da comercialização).
- Mercado Livre, anúncio que menciona CI003696/PDA02560 mas marca **Pandão**, NÃO Trim Go: https://www.mercadolivre.com.br/motor-semicompleto-bongo-hr-sorento-25-16v-d4cb-euro-5/up/MLBU4972944311 . **Candidato divergente, não usar imagem e não homologar código como OEM.**
- RP Motores produto **CI003000**, marca Trim Go (produto distinto do CI003696, não usar foto nem transferir o código): https://rpmotores.com.br/produto/motor-parcial-hr-25-16v-d4cb-13%2B31776 .

## Ofertas por aplicação — propostas separadas e NÃO indexáveis
### Hyundai HR — candidato
- `slug` preservado: `ci003696-hyundai-hr-d4cb-16v-euro-v`.
- Título: **Motor parcial com cabeçote Hyundai HR 2.5 D4CB 16V Euro V — Trim Go — CI003696**.
- Chamada: **Motor parcial novo com cabeçote, família D4CB 2.5 16 válvulas. Consulte a compatibilidade exata por chassi e versão da HR antes da compra.**
- Documentação da HR Euro V CAOA valida configuração do veículo. `ano_inicio_candidato=2013` (cadastro de origem informa 13/; confirmar origem documental do início da versão); `ano_fim=null` (não inferir do catálogo Motorservice).
- `status=a_confirmar`, `noindex=true` até a aplicação específica ser homologada.

### Kia Bongo K2500 — candidato
- `slug` preservado: `ci003696-kia-bongo-k2500-d4cb-16v-euro-v`.
- Título: **Motor parcial com cabeçote Kia Bongo K2500 2.5 D4CB 16V Euro V — Trim Go — CI003696**.
- Chamada: **Conjunto diesel D4CB anunciado para K2500. A equivalência deve ser confirmada por ano-modelo, tração, sistema de injeção, composição física e chassi.**
- `ano_inicio_candidato=2013` conforme rascunho atual e suporte em documentação de revisão da Kia; não aplicar cegamente ao 4x4 introduzido posteriormente. `ano_fim=null`; `status=a_confirmar`, `noindex=true`.
- Fonte Kia: https://www.kia.com.br/revisoes/ e https://www.kia.com.br/bongo/especificacoes/ .

## OEM e imagem — pendências explícitas
- `OEM_EPC`: NENHUM homologado. `2J0224AU00A` corresponde a `SHORT ENGINE ASSY` em consulta EPC histórica: candidato de contexto, **não** declarar equivalência ao motor **com cabeçote**.
- `foto_pendente=true`. No Bling e no Conecta.IA não há imagem. Pesquisa pública encontrou anúncios de peças semelhantes, mas nenhum comprovadamente do **mesmo SKU + marca Trim Go + composição com cabeçote**, com direito de reprodução.
- Firecrawl: `loja_busca_firecrawl.ativa=true` verificado, mas **nenhuma chamada ao próprio Firecrawl foi realizada nesta sessão** (buscador via chat interno `conecta.imagem.buscar_web`, não exposto a este agente externo). Quando retomado, executar busca `CI003696 TRIM GO motor parcial com cabecote D4CB 16v` no chat Nano.IA; filtrar por SKU+marca+composição e submeter somente candidato com fonte/direitos pelo porteiro. Se não achar, manter placeholder.
- NCM não confirma aplicação, conteúdo ou classificação editorial; não alterar tributo/categoria.
- Necessário validar componentes inclusos/exclusos, ficha técnica do conjunto Trim Go, peso de transporte e dimensões reais da embalagem, homologação de cada versão, marca e código de fabricante aprovado, bula/garantia aprovada.

## Ação permitida na situação consultada
O produto **JÁ EXISTE** no Conecta.IA como registro interno e duas ofertas **pendentes**. `produto_automacao.pausado=true` impede que o agente proponha/escreva no cadastro. **Não executar SQL de atualização manual nem contornar a pausa/Policy Engine.** Para continuar, o proprietário deve retomar a automação do SKU na interface autorizada; então Nano.IA pesquisa com Firecrawl, gera propostas, usuário aprova campos e utiliza o portão de publicação. A falta de imagem, isoladamente, não bloqueia publicação na MOBIS após os demais requisitos aprovados, segundo a política atual.

## Declaração técnica do lojista em 21/11/2026 — detalhamento do que acompanha o conjunto

**Origem da informação:** relato direto do lojista em conversa, recebido em 21/11/2026. **Evidência da composição física para fins de anúncio: ainda pendente** de conferência com a nota/embalagem/lista do fabricante/importador do **mesmo SKU CI003696 e mesma versão física**. Este trecho complementa, mas **não substitui**, a validação e o aceite do porteiro. Não gravar no ERP, no site, em produto_aplicacoes ou na bula aprovada enquanto a automação deste SKU estiver pausada.

### Descrição comercial explicativa — texto proposto, não publicado

**Motor parcial importado TRIM GO D4CB 2.5 16V Euro 5, com cabeçote montado — CI003696.**

Para que o cliente compreenda o fornecimento, o motor parcial é descrito como um **conjunto do bloco do motor e do cabeçote montado**, com componentes internos e elementos de montagem declarados abaixo. Ele **não deve ser anunciado como um motor completo pronto para funcionar** sem documento que relacione os sistemas periféricos incluídos.

O conjunto do **cabeçote montado** é informado com válvulas de admissão e escape, **dois comandos de válvulas**, tuchos, **balancins de admissão e escape** e **retentores das hastes de válvula**. Para a união entre o cabeçote e o bloco, foram declarados **junta metálica de cabeçote** e **parafusos de fixação do cabeçote**. No conjunto inferior foram declarados **bloco do motor, virabrequim, bronzinas de biela e mancal, arruelas de encosto do virabrequim** e **bicos injetores de óleo para resfriamento dos pistões (jet coolers), com os respectivos parafusos de fixação**.

**Atenção ao cliente:** a compatibilidade com Hyundai HR ou Kia Bongo K2500 depende da versão, do ano-modelo, do código do motor e da documentação da peça. As duas aplicações permanecem `a_confirmar`. A relação acima é uma composição **informada pelo lojista, ainda a validar documentalmente**, e não confirmação de fornecimento do fabricante.

### Composição detalhada para a aba "O que acompanha"

| Grupo | Item declarado | Como explicar ao comprador | Evidência/status |
| --- | --- | --- | --- |
| Cabeçote montado | Cabeçote com válvulas de admissão e escape | Parte superior do motor onde ficam as válvulas | Relato do lojista / conferir fabricante |
| Comando de válvulas | Dois comandos | Acionam o sistema de abertura das válvulas | Relato do lojista / conferir fabricante |
| Acionamento das válvulas | Tuchos | Componentes do mecanismo de acionamento das válvulas | Relato do lojista / conferir fabricante |
| Acionamento das válvulas | Balancins de admissão e escape | Integram o mecanismo de acionamento das válvulas | Relato do lojista / conferir fabricante |
| Vedação de válvulas | Retentores de haste das válvulas | Ajudam a controlar a passagem de óleo nas hastes | Relato do lojista / conferir fabricante |
| Vedação entre conjuntos | Junta metálica do cabeçote | Vedação na união do cabeçote com o bloco | Relato do lojista / conferir material e código |
| Fixação | Parafusos do cabeçote ao bloco | Fixam o cabeçote sobre o bloco | Relato do lojista / conferir se acompanham o kit |
| Estrutura inferior | Bloco do motor | Corpo estrutural do conjunto inferior | Relato do lojista / versão exata a conferir |
| Mancais internos | Bronzinas de biela | Elementos de apoio entre biela e virabrequim | Relato do lojista / conferir quantidade e medidas |
| Mancais internos | Bronzinas de mancal | Elementos de apoio entre virabrequim e bloco | Relato do lojista / conferir quantidade e medidas |
| Controle axial | Arruelas de encosto do virabrequim | Controlam a folga axial do virabrequim | Relato do lojista / conferir jogo e especificação |
| Lubrificação e resfriamento | Jet coolers (bicos de óleo) | Direcionam óleo para auxiliar o resfriamento dos pistões | Relato do lojista / conferir presença e modelo |
| Fixação de lubrificação | Parafusos dos jet coolers | Fixação dos bicos de óleo ao bloco | Relato do lojista / conferir presença |
| Conjunto rotativo | Virabrequim | Eixo principal do conjunto rotativo | Relato do lojista / conferir versão |

**Itens informados anteriormente e ainda por reconciliar na versão final da composição:** **bielas** e **pistões com anéis**, citados em briefing anterior. Não os apagar da pesquisa técnica, mas **não os prometer no anúncio definitivo** até confirmação de que acompanham este exato SKU, inclusive quantidades e estado de montagem.

**Itens que NÃO devem ser presumidos como inclusos, por ausência de comprovação:** turbocompressor, injetores, bomba de alta pressão, sistema de injeção, sensores, coletores, volante, alternador, motor de partida, bomba de água, bomba de óleo e periféricos. Esta lista **não afirma que estejam ausentes**: sua inclusão/exclusão deverá ser documentada expressamente pelo fabricante/fornecedor.

### Porteiro — validações obrigatórias antes da aprovação da bula

1. Solicitar **packing list, catálogo, nota de entrada, declaração de composição ou fotos reais da peça** identificando SKU/código do fabricante, versão D4CB e ano da aplicação. Fotos de motores semelhantes não provam a composição.
2. Conferir individualmente os itens da tabela e decidir `inclui`, `nao_inclui` ou `nao_confirmado`; quantidades/medidas desconhecidas ficam vazias, nunca inventadas.
3. Resolver os itens do briefing anterior (bielas e pistões com anéis) sem apagar nem declarar inclusão até evidência da composição.
4. Confirmar **Euro 5/16V** para a peça física; não relacionar a versão Euro 3/8V por simples semelhança de motor ou de fotografia.
5. Separar identidade do produto (`TRIM GO`) de montadoras Hyundai/Kia, do distribuidor e da informação de **importação** (declarada pelo lojista; comprovação aduaneira/fiscal antes de afirmar origem ao consumidor).
6. As páginas individuais Hyundai HR e Kia Bongo K2500 devem reutilizar **exatamente a mesma composição homologada do SKU físico**, sem adicionar ou retirar componentes por montagem do veículo; manter `status=a_confirmar` e `noindex` até validação de compatibilidade independente.
7. Nunca confundir descrição proposta neste arquivo com `produto_enriquecimento` aprovado, sincronização de descrição com Bling, anúncio publicado ou homologação de OEM.
