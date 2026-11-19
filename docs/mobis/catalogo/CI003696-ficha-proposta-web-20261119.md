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
