# Nano.ia — contratos de API (Fase 1, desenho)

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
| `texto` | `{ delta }` — token a token quando o provedor tem streaming (adaptadores SSE implementados e testados só com fixtures; ver `provedor_capacidades`) |
| `ferramenta_inicio` | `{ id, nome, risco }` |
| `ferramenta_fim` | `{ id, nome, decisao: "permitida"|"negada"|"requer_aprovacao"|"simulada", ok, resumo }` |
| `proposta` | `{ id, versao, hash, titulo, risco, itens }` — cartão de aprovação |
| `uso` | `{ provedor, modelo, tokens (total informado pelo provedor), custo_estimado }` — `custo_estimado` é sempre `null` até existir tabela de preços confirmada |
| `aviso` | `{ mensagem, provedor? }` — o provedor escolhido falhou e outro provedor ativo respondeu (fallback; `fallback:false` desliga) |
| `erro` | `{ mensagem }` |
| `fim` | `{}` |

A esfera só muda de estado por evento `estado` vindo do servidor. Sem evento, fica ociosa. Nunca simular.
Cancelar = abortar a requisição (o servidor para o laço e registra `cancelado`).

## `conector-conversas` — POST JSON
- `{ loja_id, acao: "criar", titulo? }` → `{ ok, id }`.
- `{ loja_id, acao: "excluir", conversa_id }` → `{ ok }` (tarefas, propostas, aprovações e auditoria permanecem; só o dono exclui).
- `{ loja_id, acao: "renomear", conversa_id, titulo?, projeto? }` → `{ ok }`.
- Anexos (bucket privado `agente-anexos`; o navegador **não** escreve no Storage direto):
  1. `{ acao: "preparar_anexo", conversa_id, nome, mime, bytes }` → `{ path, token, tipo }` (caminho `<loja>/<usuario>/<arquivo>`; mimes: png, jpeg, webp, pdf, txt, csv; até 20 MB).
  2. o navegador envia com `storage.from('agente-anexos').uploadToSignedUrl(path, token, arquivo)`.
  3. `{ acao: "registrar_anexo", conversa_id, nome, mime, bytes, sha256 (hex), path }` → `{ ok, id }`.
  4. `{ acao: "baixar_anexo", anexo_id }` → `{ url, expira_em_segundos: 300 }` (só o dono da conversa).

## `conector-aprovacoes` — POST JSON (só pessoa autenticada e membro da loja; chave MCP nunca chega aqui)
Erros: `{ erro: "mensagem em português", codigo? }` com 400/403/404/409/422.
- `{ loja_id, acao: "decidir", proposta_id, versao, hash, decisao: "aprovada"|"rejeitada", itens?: uuid[], confirmacao_explicita?: boolean }` → `{ ok, estado, itens? }`. 409 `versao_ou_hash_divergente` se a proposta mudou; 403 se não for **lojista** da loja; 422 se risco HIGH/CRITICAL sem confirmação explícita ou se nada é aprovável (produtos travados).
- `{ acao: "revisar", proposta_id }` → `{ ok, proposta_id }` (nova versão em rascunho; a anterior é invalidada).
- `{ acao: "travar"|"destravar", produtos: uuid[], motivo }` → `{ ok, produtos_afetados }` (travar: lojista ou editor; destravar: só lojista).
- `{ acao: "executar_simulado", proposta_id }` → `{ ok, relatorio: { simulado: true, itens: [{ item_id, operacao, ok, motivo?, previsto?, confirmacao_simulada? }] }, semeado_de: string[], aviso }`. **Ensaio**: parte do produto real lido do Bling (só leitura), roda contra a porta SIMULADA e **não muda nenhum estado**; o relatório é gravado em `agente_simulacoes`.
- `{ acao: "executar", proposta_id }` → `{ ok, relatorio: { proposta_id, itens: [{ item_id, operacao, estado: "confirmada"|"falhou"|"desconhecida", motivo?, evidencia? }], estado_final } }`. Executa o que foi aprovado: itens **internos** (enriquecimento, publicação) rodam; itens do **Bling** continuam barrados (liberação por loja/ferramenta no banco **e** ferramenta desligada no registro) e voltam como falha com o motivo.
- `{ acao: "reconciliar", operacao_id }` → `{ ok, resultado: "gravado"|"nao_gravado"|"indeterminado", aviso? }` (para operação em estado `desconhecida`; lê o Bling e só conclui com prova).

## `conector-chaves` — POST JSON (só lojista)
`{ loja_id, acao: "criar", nome, cliente?, escopos: ["leitura"|"propor"|"simular"], expira_em (ISO; de 1 minuto a 365 dias) }` → `{ ok, id, token, prefixo, aviso }` (**o token aparece uma única vez**; só o hash sha256 fica no banco; máx. 10 chaves ativas).
`{ loja_id, acao: "revogar", id }` → `{ ok }`. Escopos `aprovar`/`executar` não existem e são recusados.

## `conector-mcp` — POST JSON-RPC 2.0 (MCP, transporte HTTP)
Cabeçalho `Authorization: Bearer <chave MCP>` (formato `cia_mcp_…`). Métodos: `initialize`, `ping`, `tools/list`, `tools/call`; notificações respondem 202. Sem lote, sem `Origin` de navegador, 100 KB por requisição, 120 chamadas/min por chave.
`tools/list` devolve só as ferramentas ativas permitidas pelo escopo da chave (nomes com `__` no lugar de `.`, ex.: `conecta__catalogo__resumo`). Toda chamada passa pelo Policy Engine e entra em `agente_chamadas_ferramenta` (origem `gateway_mcp`, com a chave).
Nenhum cliente externo recebe `service_role`, token do Bling ou acesso administrativo; **não existe** ferramenta de aprovar nem de executar para ele.
