# Conecta.IA / Mobis — mapeamento Graphify para agentes seniores
Data: 17/11/2026. Status: mapa de entrada baseado em caminhos confirmados no repositório + pipeline de geracao do grafo em PR. **Nao declarar grafo integral gerado ou integracao MCP ativa antes de execucao do workflow e verificacao do artefato.**

## 1. Decisao e limites

O Graphify (https://github.com/Graphify-Labs/graphify) e uma ferramenta de inteligencia de engenharia sobre o **repositorio de codigo**. Ele e auxiliar do agente de desenvolvimento, NAO o motor de aplicacoes automotivas e NAO a fonte de autoridade para alteracao de estoque/ERP.

| Camada | Fonte ou componente | Responsabilidade | Limite |
| --- | --- | --- | --- |
| Produto fisico, SKU, preco, estoque, NF, fiscal | ERP Bling | Fonte nativa da operacao | Mobis: somente leitura pelo Conecta.IA |
| Espelho e identidade por tenant | Conecta.IA + Supabase | Consultas, versoes, historico e auditoria | Nao duplicar SKU fisico, nunca sobrescrever ERP em proposta |
| Nano.IA, gateway e policy | Conecta.IA | Consulta, pesquisa autorizada, classificacao e proposta | Nao autoaprova, nao executa escrita no Bling Mobis |
| Grafo TECNICO automotivo | Dados tecnicos Conecta.IA | Veiculo/versao/motor/anos/aplicacao com fonte | Relacao provavel nao e homologada |
| Grafo de CODIGO | Graphify local | Chamada, importacao, simbolo, dependencia e caminho de impacto | Nao conhece veracidade da compatibilidade automotiva |
| Pagina e vitrine | API publica + painel | So conteudo e SKU aprovados, filtros e navegacao | Modo TESTE nao e publicacao comercial |
| Agente de engenharia | Claude, Codex ou outro, na sessao autorizada | Consulta grafo + codigo/testes; cria PR | Sem merge, deploy, DNS, SQL em producao ou publicacao automatica |

**Politica de privacidade:** a extracao base usa graphify extract . --code-only (AST local). Arquivos PDF, textos e midias **nao** recebem extracao semantica nesta etapa; qualquer backend remoto de IA para o Graphify requer autorizacao separada, selecao de arquivos e revisao de confidencialidade. Nao habilitar Graphify Cloud, indexacao remota, Postgres ao vivo ou outras integracoes externas silenciosamente.

## 2. Inventario de caminhos de maior risco

Caminhos abaixo foram confirmados no repositório via GitHub; a conectividade entre simbolos deve ser **medida** pelo graph.json gerado, nao presumida pelo nome do arquivo.

| Dominio / origem | Arquivos e rotas para inspecionar | Risco se o agente errar |
| --- | --- | --- |
| Regras permanentes | CLAUDE.md; AGENTS.md; docs/conector-ia/ADR-2026-11-13-governanca-espelho-homologacao-ferramentas.md | Contornar controles humanos |
| Integracao Bling | supabase/functions/bling-conectar/; bling-callback/; bling-renovar/; bling-sync/; bling-backup/ | Misturar tenants, quebrar sync ou revelar credenciais |
| Porta e execucao | supabase/functions/_shared/conector/porta_bling.ts; acoes.ts; executor.ts; policy.ts; mobis_politica.ts | Escrever indevidamente no ERP |
| Gateway e agentes | supabase/functions/conecta-gateway/; supabase/functions/_shared/conector/gateway.ts; prompts.ts; catalogo_ferramentas.ts; registro.ts | Fornecer ferramenta nao autorizada; prometer funcao inexistente |
| Taxonomia e relacionamentos | supabase/functions/_shared/multiagente/; taxonomia_nos; produto_codigos; produto_aplicacoes | Inferir equiv. OEM/veiculo e publicar sem fonte |
| API e gates de loja | supabase/functions/loja-publica/index.ts; loja-publicacao/index.ts; loja-seo/index.ts | Vazar rascunho, indexar em teste ou vender sem liberar |
| Telas e roteamento | painel/src/paginas/LojaMobisNova.tsx; ProdutoPublico.tsx; CatalogoAplicacao.tsx; Catalogo.tsx | Produto abrir WhatsApp diretamente; filtro textual nao estruturado |
| Banners e layout | painel/src/paginas/Banners.tsx; EditorEstruturaLoja.tsx; docs/conector-ia/fluxo-flash-mobis-sku-veiculo-20261117.md | Anuncio clonado, imagem nao licenciada ou link incorreto |
| Painel de operacao | painel/src/paginas/Aprovacoes.tsx; PublicacaoLoja.tsx; Integracoes.tsx; Assistente.tsx | Aprovar/publish sem o gate correto |
| Tests | supabase/functions/_shared/conector/mobis_politica.test.ts; scripts/tests/loja-filtros-visual.mjs; loja-mobis-v2-visual.mjs; temas-visual.mjs | CI verde sem testar comportamento exigido |
| Fluxos GitHub | .github/workflows/conector-testes.yml; painel-ci.yml; chat-operacional.yml; graphify-mapa-readonly.yml | Confundir teste de PR com deploy/publicacao |

Banco e codigo: pesquisar as migracoes SQL em supabase/migrations/ para definicao atual de produto_aplicacoes, produtos, produto_codigos, loja_banners, politicas, RLS, funcoes RPC e triggers. Nao concluir esquema de producao apenas lendo migracao ainda nao aplicada. Conferir estado efetivo antes de propor migra-lo.

## 3. Mapeamento de fluxos obrigatorios

### 3.1 Produto e estoque
Bling -> bling-sync -> tabela produtos (espelho) -> enriquecimentos/codigos/aplicacoes Conecta.IA -> API loja-publica -> LojaMobisNova/ProdutoPublico -> cliente.

**Invariantes:** um SKU fisico, um estoque; varias aplicacoes e paginas por veiculo apenas apontam para o mesmo produto_id. Pagina filha nao cria pai fisico nem estoque. Dados de NF e campo fiscal nao sao afetados por Graphify, Nano ou editor visual. Nao confundir hierarquia de taxonomia com composicao pai/filho do ERP.

### 3.2 Aplicacao por veiculo (ponto de seguranca comercial)
Versao BR (montadora, modelo, geracao, ano de fabricacao/modelo claramente discriminado, motorizacao, emissao, sistema, restricoes, chassi quando aplicavel) + referencia direta + fonte e data -> proposta -> checagem de conflito -> homologacao humana -> pagina especifica aprovada e indexavel.

Um mesmo motor D4CB entre HR e Bongo NAO prova automaticamente que a mesma peca serve aos dois. Referencias OEM cruzadas nao sao transitivas. Ano internacional nao e ano de inicio no mercado brasileiro. Nunca inventar dados em campos vazios.

### 3.3 Pagina de produto e filtros da MOBIS
- Busca e filtros acumulativos: montadora -> modelo -> ano inicial/final -> motorizacao -> sistema -> somente itens com aplicacao **aprovada**, produto **publicado** e disponibilidade validada segundo a regra comercial.
- Selecionar L200 exclui itens que tenham apenas aplicacao HR. Se houver 2 aplicacoes reais para um mesmo SKU, ele aparece nas buscas autorizadas sem duplicar produtos ou saldos.
- Clique no cartao da peca: requisito atualizado do lojista e **ficha flutuante sobre a loja** com fotos, SKU/OEM, dados tecnicos, aplicacoes, preco e atendimento. WhatsApp nao deve substituir a ficha. A rota canonica do SKU deve continuar sendo um endereco navegavel/deep link.
- **Conflito a revisar antes de mudar:** o fluxo atual do Flash (PR #424) define clique em banner -> rota canonica #/p/mobis/<SKU> sem modal intermediario. Nao alterar silenciosamente o banner nem supor que o requisito de ficha flutuante ja esteja implementado; separar cartao comum de campanha Flash e homologar ambos.

### 3.4 Travamento de escrita e aprovacao
supabase/functions/_shared/conector/mobis_politica.ts define MOBIS_LOJA_ID e blingEscritaNegadaPorPolitica; acoes.ts testa a regra antes de iniciar; executor.ts testa novamente item a item. O grafo deve mostrar as chamadas reais e seus chamadores. **Nao e aceitavel remover, simular ou trocar esse portao para liberar escrita**, nem executar fora dele. Teste negativo obrigatorio: Mobis recebe recusa para bling.* mesmo com aprovacao; outro tenant nao herda a mesma regra indevidamente.

### 3.5 Publicacao e imagens
Salvamento, revisao e aprovacao **nao** equivalem a publicar. Produto incompleto e aplicacao nao aprovada nao aparecem em endpoints anonimos. Modo de teste nao concede indexacao SEO nem checkout. Imagem precisa de direito de uso e vinculo correto ao produto. A funcao publicar_produto pode ter excecao limitada para imagem principal Mobis; isso nao elimina os demais gates de homologacao (ver PR #427 e docs/conector-ia/mobis-foto-opcional-publicacao-20261117.sql).

### 3.6 Seguranca e separacao
Conferir tenant no gateway/servidor/banco, policy engine, RLS, tokens por loja, isolamento entre NanoShell IA e Conecta.IA; proibidos log de segredo, service_role no navegador, acesso indevido a NF ou dados internos em loja-publica. Graphify nao deve ser registrado como executor Bling ou exposto ao cliente na vitrine.

## 4. Procedimento reproducivel para o agente

Pre-requisito: Python >=3.11; Graphify CLI oficial PyPI **graphifyy** (dois 'y'), versao revisada 0.9.112, command-line **graphify**.

Em ambiente autorizado de desenvolvimento, na RAIZ do repositorio:

    python -m pip install "graphifyy[sql]==0.9.112"
    graphify extract . --code-only
    graphify query "Qual caminho liga acoes ao executor e a politica Mobis?"
    graphify query "Qual codigo participa de loja-publica e de ProdutoPublico?"
    graphify explain "blingEscritaNegadaPorPolitica"
    graphify path "executarProposta" "blingEscritaNegadaPorPolitica"

Os termos de query/path sao exemplos; se houver multiplos simbolos ou nenhum resultado, desambiguar inspecionando nodes e caminhos de origem. Nunca fabricar resposta. Consultar graphify-out/GRAPH_REPORT.md para panorama, mas usar consultas focalizadas para decisoes de engenharia. Em MCP local opcional, instalar o extra mcp no ambiente da equipe e conectar **um processo separado** graphify-mcp ao graph.json local: conectar servidor MCP exige configuracao efetiva do cliente; instalar a skill Graphify **nao** cria essa conexao.

Apos editar codigo:

    graphify update .
    graphify query "Quais dependencias mudaram entre API publica e catalogo?"
    git diff --check

Se grafo ausente, ilegivel, incompleto ou referente a outra revisao: reconstruir e informar lacuna. O grafo EXTRACTED/INFERRED e somente orientacao; confirmar o codigo e os contratos diretamente. Evitar adicionar um grafo de codigo gigante ao Git: graphify-out/ permanece ignorado e os artefatos de CI sao temporarios.

## 5. Matriz de testes antes de um PR do agente

| Mudanca proposta | Verificacoes minimas |
| --- | --- |
| Bling e executor | mobis_politica.test.ts; acoes e executor (recusa escrita, simulacao e isolamento), integracao/contract do conector |
| SKU, codigos e aplicacoes | Um produto para varios veiculos; nenhum produto fantasma; nao homologar por motor ou codigos parecidos |
| Filtro montadora/ano/motor | scripts/tests/loja-filtros-visual.mjs; API com dados aprovados e excluidos; testes negativos L200 versus HR |
| Ficha de produto | Navegar sem abrir WhatsApp, abrir fotos/detalhes, fechar modal, preservar URL SKU, teclado, foco e responsividade |
| Banner Flash | Fotografia/titulo/CTA para SKU correto; foto autorizada; nenhum banner ativo de SKU nao publicado |
| Temas e telas | scripts/tests/temas-visual.mjs; WCAG AA, 360/390/412/768/1280/1920 quando aplicavel |
| SEO/publicacao | Endpoint anon so retorna publicado; aplicacao so aprovada/indexavel; teste noindex em fase TESTE; RLS |
| Migrações | Plano antes/depois, rollback, schema real e aprovacao separada antes de executar no banco |

O comando de CI existente em conector-testes.yml, painel-ci.yml e chat-operacional.yml nao pode ser substituido por Graphify: **mapa nao e suite de teste funcional**.

## 6. Verificacao de status e divergencias a nao esconder

- PRs #422, #423, #424, #425 e #427 foram vistos integrados no GitHub; PR #426 permanecia aberto durante este levantamento. PR integrado != deploy.
- Documentos anteriores registravam zero produtos publicados; isso nao e prova do contador atual da base sem consulta autorizada.
- CLAUDE.md ainda menciona dominio antigo de exemplo; docs/conector-ia/loja-fases-teste-online.md identifica mobisautopecas.com.br como dominio oficial. **Nao mudar DNS nem resolver diferenca por palpite.**
- Existem documentos historicos de arquitetura em rascunho que afirmam nao existir codigo; conferir a implementacao atual antes de confiar neles.
- O fluxo Flash da PR #424 e o pedido novo de ficha flutuante precisam de reconciliacao explicita com testes.
- Nenhum Graphify MCP foi habilitado dentro do Conecta.IA, nenhum scan real foi executado por esta documentacao e nenhuma API de produto, estoque, NF ou site foi modificada.

## 7. Regra de saida do agente senior

Em cada entrega tecnica registrar: (a) branch e commit, (b) versao/commit do mapa consultado, (c) perguntas e caminhos Graphify, (d) evidencia em codigo com arquivo/funcao, (e) risco/efeito em Bling, SKU/aplicacao, publicacao e seguranca, (f) testes executados e testes nao executados, (g) autorizacoes pendentes, (h) observacoes de integridade. Sem essa trilha, sinalizar **revisao incompleta**, nunca 'homologado'.

Referencias internas: CLAUDE.md; docs/conector-ia/ADR-2026-11-13-governanca-espelho-homologacao-ferramentas.md; docs/conector-ia/mobis-paginas-aplicacao-20261115.md; docs/conector-ia/fluxo-flash-mobis-sku-veiculo-20261117.md; docs/conector-ia/loja-fases-teste-online.md; docs/conector-ia/multiagente-arquitetura.md.
