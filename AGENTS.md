# Conecta.IA — regras para agentes de engenharia (Graphify-first)

Este projeto e isolado de NanoShell IA. Este arquivo complementa CLAUDE.md e as politicas de servidor; nao substitui autorizacoes, testes ou homologacoes.

## Antes de QUALQUER alteracao tecnica
1. Ler CLAUDE.md e docs/conector-ia/graphify-mapeamento-agente-senior-20261117.md. Confirmar o repositorio, tenant e objetivo exato.
2. Se graphify-out/graph.json existir, verificar se representa a revisao atual; atualizar o grafo apos alteracoes de codigo com graphify update . . Nao afirmar cobertura quando o grafo estiver ausente, parcial ou desatualizado.
3. Se nao houver grafo e a CLI estiver autorizada/disponivel, gerar localmente com graphify extract . --code-only . Nao enviar codigo, documentos, PDF ou credenciais a servicos externos. Nao habilitar backend sem autorizacao.
4. Antes de editar, consultar grafo com graphify query "<pergunta de impacto>", graphify explain "<simbolo>" e graphify path "<origem>" "<destino>" quando aplicavel. Se houver MCP Graphify real conectado, usar as ferramentas que esse servidor anuncia em lugar de fingir que o CLI local e o MCP sao a mesma coisa.
5. Para cada aresta, distinguir EXTRACTED de INFERRED. Nenhum desses marcadores atesta que uma aplicacao automotiva esta homologada. Abrir os arquivos citados e conferir a semantica real, testes, contratos, validacao em banco e efeitos colaterais.
6. Listar impacto em API, banco/migracoes, auth/RLS, produtos, estoque, aplicacoes, frontend, SEO e testes. Mudanca de comportamento exige teste positivo, negativo e de isolamento por loja.
7. Se a CLI/MCP nao estiver disponivel, usar inspecao direta de codigo e declarar a lacuna; NAO inventar consultas ao grafo nem considerar uma arquitetura desenhada como implementacao real.

## Barreiras inegociaveis para a Mobis
- Bling e fonte de produto, preco, estoque, dados fiscais e NF. NUNCA duplicar SKU/estoque por montadora, modelo ou pagina de aplicacao.
- A politica absoluta em supabase/functions/_shared/conector/mobis_politica.ts proibe operacoes bling.* no executor para a Mobis, mesmo apos aprovacao. Nao contornar via gateway, MCP, agente, SQL ou ferramenta externa.
- Propostas de enriquecimento nao aprovam, nao publicam, nao emitem NF, nao transferem estoque e nao alteram fiscal.
- Compatibilidade exige evidencias independentes por versao, motor, ano e mercado brasileiro. Compartilhar D4CB ou OEM semelhante nao e prova. Mantem-se fonte, data, restricoes e auditoria.
- Publicacao comercial so apos homologacao de produto, aplicacao, imagem/licenca, politica e dominio. Modo TESTE nao libera rascunho, checkout nem SEO indexavel.
- Nao mexer no projeto Supabase NanoShell IA. Nao trocar DNS, credenciais, migrar banco, fazer deploy, merge ou publicacao sem autorizacao explicita.
- Conflitos entre documentos e codigo (p.ex. dominios antigos ou exigencia de modal versus rota de SKU) exigem leitura da implementacao atual e decisao documentada; nunca resolver silenciosamente.

## Fluxos que exigem mapa de impacto
- Bling/ERP: bling-sync, porta_bling.ts, acoes.ts, executor.ts, mobis_politica.ts, testes de politica e reconciliacao.
- Aplicacoes: produto_aplicacoes, produto_codigos, taxonomia_nos, API loja-publica e ProdutoPublico/LojaMobisNova.
- Vitrine/Flash: loja_banners, EditorEstruturaLoja, Banners, LojaMobisNova e rotas SKU/aplicacao.
- Publicacao: loja-publicacao, loja-seo, gates de banco, RLS e testes de API.
- Interface: temas-visual.mjs, loja-filtros-visual.mjs, loja-mobis-v2-visual.mjs e CI apropriado.

Entregar sempre: revisao/commit do grafo, nos e caminhos consultados, arquivos afetados, evidencias diretas versus inferencias, testes executados, resultado, riscos e autorizacoes pendentes. Grafo e ferramenta de navegacao do codigo, nao substitui verificacao de fatos nem a politica do Conecta.IA.
