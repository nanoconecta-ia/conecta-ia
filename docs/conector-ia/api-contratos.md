# Conector IA — contratos de API (Fase 1, desenho)

Tudo abaixo é **proposta de desenvolvimento**: nenhuma Edge Function foi implantada e nenhuma migração foi aplicada em produção.
Todas as funções recebem `Authorization: Bearer <JWT do usuário>` (exceto `conector-mcp`, que usa chave MCP por loja) e respondem
`{ erro: "mensagem em português" }` com status 4xx/5xx em falha. O navegador **nunca** recebe segredo, `service_role` nem token do Bling.

## Leituras diretas pelo painel (supabase-js, protegidas por RLS)
`agente_conversas`, `agente_mensagens`, `agente_tarefas`, `agente_propostas`, `agente_proposta_itens`, `agente_aprovacoes`,
`agente_operacoes`, `produto_travas`, `agente_chamadas_ferramenta`, `provedor_capacidades` (select). `rpc('dashboard_operacional', { p_loja })`.
Conversas e mensagens: cada usuário vê só as próprias.

## `conector-chat` — POST, resposta `text/event-stream`
Corpo: `{ loja_id, conversa_id?, texto, anexos?: string[], provedor?: "claude"|"gemini"|"compativel_openai", modelo? }`.
Sem `conversa_id`, cria a conversa. `provedor` troca o modelo **desta** mensagem em diante (grava na conversa).
Eventos SSE (`event: <nome>` + `data: <json>`):

| evento | data |
|---|---|
| `conversa` | `{ id, titulo }` |
| `estado` | `{ estado }` onde estado ∈ ocioso, escutando, interpretando, consultando_ferramentas, pesquisando_fontes, preparando_proposta, aguardando_aprovacao, executando, sincronizando_bling, concluido, erro, bloqueado |
| `texto` | `{ delta }` (hoje por bloco de resposta; token a token quando o adaptador suportar — ver `provedor_capacidades`) |
| `ferramenta_inicio` | `{ id, nome, risco }` |
| `ferramenta_fim` | `{ id, nome, decisao: "permitida"|"negada"|"requer_aprovacao"|"simulada", ok, resumo }` |
| `proposta` | `{ id, versao, hash, titulo, risco, itens }` — cartão de aprovação |
| `uso` | `{ provedor, modelo, tokens_entrada, tokens_saida, custo_estimado }` |
| `erro` | `{ mensagem }` |
| `fim` | `{}` |

A esfera só muda de estado por evento `estado` vindo do servidor. Sem evento, fica ociosa. Nunca simular.
Cancelar = abortar a requisição (o servidor para o laço e registra `cancelado`).

## `conector-conversas` — POST JSON
`{ loja_id, acao: "excluir", conversa_id }` → `{ ok }` (tarefas, propostas, aprovações e auditoria permanecem).
`{ loja_id, acao: "renomear", conversa_id, titulo }` → `{ ok }`.

## `conector-aprovacoes` — POST JSON (só humano autenticado; chave MCP nunca chega aqui)
- `{ loja_id, acao: "decidir", proposta_id, versao, hash, decisao: "aprovada"|"rejeitada", itens?: uuid[], confirmacao_explicita?: boolean }`
  → `{ ok, estado, itens? }`. Falha 409 `versao_ou_hash_divergente` se a proposta mudou; 403 se não for lojista da loja.
- `{ loja_id, acao: "revisar", proposta_id }` → `{ proposta_id }` (nova versão em rascunho; a anterior é invalidada).
- `{ loja_id, acao: "travar"|"destravar", produtos: uuid[], motivo }` → `{ produtos_afetados }` (destravar: só lojista).
- `{ loja_id, acao: "executar_simulado", proposta_id }` → relatório da execução com a porta Bling simulada (Fase 1 **não** escreve no Bling real).
- `{ loja_id, acao: "reconciliar", operacao_id, resultado: "gravado"|"nao_gravado", evidencia }`.

## `conector-chaves` — POST JSON (gerência das chaves do gateway; só lojista)
`{ loja_id, acao: "criar", nome, escopos: ["leitura"|"propor"|"simular"], expira_em }` → `{ id, token }` (**o token aparece uma única vez**).
`{ loja_id, acao: "revogar", id }` → `{ ok }`. Escopos `aprovar`/`executar` não existem e são recusados.

## `conector-mcp` — POST JSON-RPC 2.0 (MCP, transporte HTTP)
Cabeçalho `Authorization: Bearer <chave MCP>`. Métodos: `initialize`, `tools/list`, `tools/call`, `ping`. `tools/list` devolve só o que o
escopo da chave permite. Toda chamada passa pelo Policy Engine e entra em `agente_chamadas_ferramenta` (origem `gateway_mcp`).
Nenhum cliente externo recebe `service_role`, token do Bling ou acesso administrativo.
