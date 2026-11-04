# Diagnóstico da IA do Nano (correlação, latência, ferramenta única)

Origem: auditoria somente leitura de 04/11/2026 (pedido do dono, redigido pelo GPT).

## O que existe agora
- **`request_id`** (`req_` + 20 hex) por turno do chat e por chamada ao gateway MCP. Chat: gravado em `mensagens.metadados` e devolvido na resposta. Gateway: cabeçalho `x-request-id` em toda resposta e `_meta.request_id` / `_meta.latencia_ms` em `tools/call`.
- **Latência**: `latencia_ms` (turno) e `latencia_provedor[]` (provedor, ms, status; uma entrada por tentativa, inclusive a que falhou antes da troca para o gratuito).
- **Categoria de erro estável** (`diagnostico/correlacao.ts`): `limite` (429), `indisponivel` (502), `tempo_esgotado` (504), `configuracao` (401/403), 503 = `nao_configurado`, `entrada` (400/409/413), `outro`.
- **Log estruturado** (`nano_requisicao`, uma linha JSON, sem texto, chave ou token) para a plataforma casar com `function_edge_logs` pelo horário e pelo `request_id` devolvido.
- **Ferramenta única `nano.diagnostico.ia`** (chat: `diagnostico_ia`): leitura, risco LOW, mesma no chat e no MCP. Mostra provedores ativos e modo do gratuito, limite mensal, últimos turnos e latência p50/max. Lê `loja_chaves_ia` com colunas explícitas (nunca chave cifrada, final da chave nem `base_url`).

## Limites conhecidos
- Turnos anteriores a esta versão não têm `request_id`/latência.
- Chamadas MCP não gravam turno: o id vem na resposta e no log da plataforma.
- A função responde HTTP 200 mesmo com erro de provedor no chat; o status real está em `http_status` e `categoria_erro`.

## Fallback gratuito
Há dois mecanismos: `free_automatico.ts` (provedor `openrouter_free`, modos Desligado/Manual/Automático, só leitura) e `fallback_free.ts` (legado: glossário público com consentimento por pergunta). Eles já rodam em sequência dentro de um único roteador (`chat.ts`); o legado só atua se o automático não respondeu. Remover o legado exige tirar o consentimento da tela (`Assistente.tsx`) e a chave antiga `freellm`: decisão do dono, não feita aqui.
