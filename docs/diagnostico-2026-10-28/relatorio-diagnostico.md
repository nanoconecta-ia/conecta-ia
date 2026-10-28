# Diagnóstico Nano.IA / Conecta.IA — 2026-10-28
Escopo executado: auditoria de código (somente leitura), inventário de conectores, metadados do Drive, testes locais com dados fictícios.
NÃO feito: nada no Bling, nada no Windows/dispositivo, nenhum backup fiscal aberto, sem merge/deploy/migração, nada instalado ou publicado.
Nota: o comentário do PR #113 (separação Desktop Commander × Nano.IA) foi tratado como INFORMAÇÃO coerente com o escopo; não ampliou nenhuma permissão.

## 1. Separação de produtos (premissa)
Desktop Commander é ferramenta deste chat, não dependência. Conecta.IA e Nano.IA/NanoShell IA têm executores PRÓPRIOS. A ausência dele aqui NÃO é defeito.

## 2. Matriz de capacidades
Legenda: IMPLEMENTADO = código + teste passando · PROTÓTIPO = código/contrato/mock, não ligado ao real · NÃO CONECTADO/NÃO EXISTE.

| Capacidade | Onde | Estado | Evidência |
|---|---|---|---|
| Registro de ferramentas (id, schema, permissão, risco, estado) | conecta-ia `_shared/conector/registro.ts:41` | IMPLEMENTADO | registro.test.ts |
| Policy Engine (negar por padrão, executor só aprovado, escopo MCP) | `_shared/conector/policy.ts:8` | IMPLEMENTADO | gateway.test.ts, aceitacao.test.ts |
| Gateway MCP (JSON-RPC, token de sessão, escopos, auditoria que bloqueia entrega) | `functions/conecta-gateway/index.ts`, `_shared/pair/gateway.ts` | IMPLEMENTADO e DEPLOYADO (ACTIVE v4, verify_jwt=false com auth própria) | 75/76 testes node passam (1 skipped) |
| Conecta Pair (sessão por dispositivo, escopos só ler/propor) | `_shared/pair/{escopos,executor,oauth}.ts`; função `pair` ACTIVE | IMPLEMENTADO (servidor); sem agente de dispositivo | pair.test.ts, executor.test.ts |
| Escrita no Bling | `bling.produtos.criar/alterar` | PROTÓTIPO: desligada, só mock/simulado; exige aprovação + escrita_real_liberada | policy.ts:13-17 |
| PowerShell/Windows no Conecta.IA | só menção em `bling_ferramentas.ts` | NÃO EXISTE | grep |
| Extensão Chrome no Conecta.IA | — (desenho no PR #109) | NÃO EXISTE (proposta) | grep |
| NanoShell IA — extensão Chrome v0.2 | nanodesk-ai `extension/` (MV3: sidePanel, storage, activeTab, scripting, bookmarks) | IMPLEMENTADO como painel de conversa: envia página/seleção/favoritos com aprovação no PC; pareada como "Operador". NÃO clica nem preenche | LEIAME.md; pytest test_extensao_* passam |
| NanoShell IA — executor Browser (Playwright) com Alvo em cascata atributo→css→label→papel→texto→coordenada (coordenada = risco ALTO + PIN) | `execution/browser/{alvo,sessao,operacoes,hosts}.py` | IMPLEMENTADO (código+testes em site de teste); depende do Playwright instalado no PC | test_alvo_ordem, test_navegador passam |
| NanoShell IA — UI Automation Windows (pywinauto/UIA) | `execution/ui_automation/pywinauto_backend.py`, `tools/desktop/notepad.py` | PROTÓTIPO real só para Bloco de Notas; só roda no Windows; não rodado aqui | test_notepad_tool (skips fora do Windows) |
| NanoShell IA — perfil do dispositivo detectado (nunca suposto) | `runtime_portatil/dispositivo.py` | IMPLEMENTADO | test_runtime_portatil passa |
| NanoShell IA — gateway LAN/Runtime | `gateway/{server,runtime,protocol}.py` | IMPLEMENTADO no código; não exercitado aqui contra o PC da Mobis | test_gateway* (não rodados todos) |
| Executor PowerShell com lista permitida de comandos | — | NÃO EXISTE em nenhum dos dois repos | grep |
| Ponte Conecta.IA ↔ NanoShell por fila de tarefas | desenho em CLAUDE.md / ESCOPO.md | PROTÓTIPO/CONTRATO; sem worker real ligado | — |

Testes rodados agora: NanoShell `pytest` (extensão, runtime portátil, alvo, navegador, notepad) = verde (3 skipped); Conecta.IA node: 75 pass / 0 fail / 1 skipped.

## 3. Conectores realmente ativos NESTA sessão (uso comprovado)
Supabase, Bling MCP (somente leitura usada), Google Drive, GitHub. Figma: apenas whoami. Disponíveis não exercitados: Gmail, Calendar, Docs, Sheets, Slides, LlamaParse, Context7. Falharam (proxy 403): Asana, Atlassian, Notion, Slack. Inexistentes: dispositivo remoto, Chrome, Desktop Commander, PowerShell.
Segurança: credenciais deste chat NÃO são repassadas ao Conecta/Nano.

## 4. Drive — somente metadados (nada aberto)
| Nome | Tipo | Tamanho | ID |
|---|---|---|---|
| CATÁLOGO QUATRO - COMPLETO.pdf (meu) | pdf | 14,6 MB | 1eeXjCTJxt53DgNyq62OApp6QxfbegEnr |
| CATÁLOGO QUATRO - COMPLETO.pdf (Quatro) | pdf | 11,5 MB | 1xhkq-MtUT6lAs5POAz5RVt_c4uKFPxdD |
| MOTOR - CATÁLOGO QUATRO.pdf | pdf | 1,7 MB | 1xZ4oAMThikazewiNJjOI_VNhpgSpWzoF |
| ARREFECIMENTO - CATALOGO QUATRO.pdf | pdf | 2,5 MB | 1VJnUturboork4OjmF5C6QfYJ5DDQbRmP |
| ROLAMENTOS E CILINDROS - CATALOGO QUATRO.pdf | pdf | 2,8 MB | 1P3QZPHg6_UDjQrR6sQlusFHazSjoiZWw |
Pastas na raiz: "Certificado digital Mobis Autopeças" (NÃO aberta; contém material sensível — recomendo tirar do alcance de qualquer conector), Colab Notebooks, temp, Google AI Studio.
Buscas por "backup", "nota", "xml", "NFe", "logist": 0 resultados. Os backups fiscais/logísticos não aparecem neste Drive (podem estar em outro local/conta). A listagem de pastas teve 2ª página não percorrida.

## 5. Parser NF-e/XML (local, 100% fictício)
`nfe/nfe_parser.py` + `test_nfe.py`: 10 testes OK. Extrai NCM, CEST, CFOP, GTIN, código do fornecedor, descrição, origem, CST/CSOSN, infAdProd; fabricante só se documentado (CNPJFab), nunca inferido.
Regras provadas: DV da chave (mód. 11); NF-e sem protocolo 100/150 não vale; resumo de distribuição não tem itens; evento 110111 cancela a nota da mesma chave; DOCTYPE/ENTITY rejeitado (XXE); hash SHA-256 por arquivo; "SEM GTIN" não é GTIN (achado dos testes). Saída JSONL/CSV/MD. Diferença fiscal vira PROPOSTA (aplicado=false; exige contador + aprovação). Limite: layout real pode ter variações (NFe 4.00 assumido); validar com 1 XML real só quando você autorizar.

## 6. Catálogo PDF → fichas indexadas
Já existia texto por página + 217 fichas (SKU, descrição, cód. de fábrica, motor, veículo, página, SHA do PDF, confiança). Novo: `indexar_fichas.py` → `indices_fichas.json` (SKU 217, cód. fábrica 481, motor 32, veículo 23, páginas 35) e `consultar_fichas.py` (máx. 5 fichas curtas). Campo OEM: 0 — o catálogo traz só código de fábrica; não foi inventado. Economia: tabela inteira ≈44 mil tokens; uma consulta devolve ~150–400 tokens.

## 7. Fluxo Nano.IA vendor-neutral
descobrir → permitir → executar → evidenciar
1. DESCOBRIR: agente (Gemini/Claude/GPT) chama `tools/list` no Gateway MCP; vê só ferramentas permitidas à sessão (schema, risco, permissão). Sem credencial, sem terminal.
2. PERMISSÃO por camada (nunca implícita): consulta (automática, LOW) · proposta (gera registro, sem efeito) · aprovação (humano, por operação, versionada por hash) · escrita (só executor, ferramenta ligada, loja libera, idempotency_key).
3. EXECUTAR: fila de tarefas; o executor LOCAL (Windows/Browser) PUXA a tarefa (nunca recebe chamada de fora); timeout, pausa, revogação a cada iteração.
4. EVIDÊNCIA: resultado + carimbo de tempo + hash + auditoria encadeada voltam ao chat; escrita externa só é "concluída" após leitura de confirmação; timeout em escrita = UNKNOWN.

Arquitetura (contratos padrão, qualquer LLM):
- Registry de capacidades (já existe no TS/Python; unificar o schema).
- Executor Windows local: lista permitida de comandos PowerShell (cada um = capacidade nomeada com parâmetros tipados, `-NoProfile`, sem string livre), modo de linguagem restrito, read-only primeiro; NÃO EXISTE — a construir.
- Executor Browser: perfil isolado do Playwright (sem os logins do Chrome do dono); a extensão Chrome atual segue só como painel.
- Pareamento por dispositivo (Pair) com escopos por sessão; revogação imediata; STOP global.
- Auditoria: tenant, agente, tarefa, ferramenta, argumentos (chaves), risco, resultado, aprovação.
Matriz de permissão sugerida: `sistema.inventario`=consulta; `browser.abrir/ler`=consulta (hosts na lista); `browser.clicar/preencher`=aprovação por ação; `powershell.<cmd listado>`=consulta p/ leitura, aprovação p/ o resto; qualquer escrita em ERP=escrita (hoje desligada).

## 8. Plano de prova ponta a ponta (independente do ChatGPT) — NÃO executado
Pré-requisito: sua autorização específica + dispositivo verificado.
1. Verificar dispositivo e pareamento (id detectado, escopos efetivos) — leitura.
2. Agente A (Claude) e agente B (outro provedor) chamam `tools/list` e recebem o mesmo registro.
3. Tarefa `sistema.inventario` (consulta) → executor puxa, devolve SO/versão/RAM com hash e carimbo.
4. Tarefa `browser.ler` numa página de teste própria (site_teste.py), perfil isolado → captura + DOM.
5. Tentativas negativas: comando fora da lista, sem aprovação, token revogado, timeout → todas negadas e auditadas.
6. Mesmo teste com o agente B; comparar evidências idênticas. Critério: 0 credencial exposta ao LLM, 100% das chamadas auditadas.
Bloqueios hoje: sem executor PowerShell; Pair sem agente de dispositivo; Playwright/pywinauto não verificados no PC da Mobis; Gateway só com escopos ler/propor.

## 9. Limitações honestas
Nada foi executado no Windows. Testes do NanoShell em Linux (UIA pulado). Matriz baseada em leitura de código + testes, não em produção real do NanoShell. Parser testado só com XML fictício.

## 10. Operação (PR #116)
Job limite-limpeza: 2 execuções succeeded (04:00 e 04:10 UTC, ~12 ms), tabela 0 linhas / 81.920 bytes; jobs vizinhos (bling-sync, bling-renovar, chat-expurgo) succeeded. Nenhuma ação necessária. eco-ip-temporario segue ACTIVE (você precisa excluir no painel).
