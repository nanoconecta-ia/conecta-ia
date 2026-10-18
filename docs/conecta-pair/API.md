# Conecta Pair — contratos de API

Tudo em JSON. Erros nunca incluem SQL, credencial, hash nem detalhe interno. Segredos: **token completo `<token>.<sal>`** (a 1ª metade nasce no dispositivo; o **sal** de 256 bits é gerado pelo servidor e devolvido uma única vez em `iniciar`; só os SHA-256 das duas metades chegam ao banco e as duas precisam bater), **código** (vai no QR), **segredo** (consulta do solicitante) e **verificação** (6 dígitos na tela do dispositivo).

## 1. Função pública `pair` — `POST /functions/v1/pair`

| `acao` | Entrada | Saída | Erros |
|---|---|---|---|
| `iniciar` | `nome` (1–80, sem `<>` nem controle), `tipo` (`navegador\|computador\|smartphone\|agente_externo\|agente_desktop`), `escopos[]` (1–12, lista abaixo), `capacidades[]` (só `agente_desktop`, ≤ 20, `^[a-z0-9_.:-]{3,60}$`), `duracao_min` (5–480, padrão 60), `renovavel` (padrão `true`), `token_hash` (SHA-256 hex da 1ª metade do token, gerada no dispositivo) | `{desafio_id, codigo, url, verificacao, segredo, sal, token_formato:"<token>.<sal>", expira_em, ttl_s:120, renovavel}` | 400 entrada inválida · 409 token já usado · 429 (10 por IP em 10 min) |
| `consultar` | `codigo`, `segredo` | `{estado:"pendente", expira_em}` · `{estado:"resgatado", loja_id, escopos, dispositivo_id, sessao_expira_em, limite_ate, renovavel}` · `{estado:"recusado\|expirado\|invalido"}` | 429 (90/min por código, 300/min por IP) |
| `renovar` | Header `Authorization: Bearer <token>.<sal>` (atual); `novo_token_hash` = SHA-256 da **nova 1ª metade** (o sal não muda) | `{ok:true, expira_em, limite_ate}` | 401 sessão inválida/expirada/revogada **ou não renovável** |
| `encerrar` | Header `Authorization: Bearer <token>.<sal>` | `{ok:boolean}` | — |

- `consultar` resgata no máximo **uma vez**; repetir (resposta perdida) devolve o mesmo resultado, **nunca** um token novo (o token nunca trafega do servidor para o dispositivo).
- `url` = `<APP_URL>/#/parear?c=<codigo>` — é exatamente o que vai no QR.
- Cada metade em base64url de 32 a 96 bytes (`^[A-Za-z0-9_-]{43,128}$`), separadas por um ponto. Token sem a 2ª metade é recusado antes de consultar o banco.

## 2. Lado do aprovador — RPC do Supabase com o JWT do lojista (`supabase.rpc`)

| RPC | Entrada | Saída |
|---|---|---|
| `pair_detalhe(p_codigo)` | código do QR | `null` (inexistente/usado/expirado) ou `{nome, tipo, escopos, capacidades, duracao_min, renovavel, expira_em, lojas:[{id,nome}]}` (só lojas em que é **lojista**; **não** revela a verificação) |
| `pair_aprovar(p_codigo, p_loja, p_verificacao, p_escopos, p_duracao_min, p_capacidades)` | escopos ⊆ solicitados; duração ≤ solicitada | `{ok:true}` ou `{ok:false, motivo}`: `desafio_invalido · desafio_ja_usado · expirado · verificacao_incorreta (+restantes; 5 erros bloqueiam) · escopo_alem_do_solicitado · duracao_invalida · capacidade_alem_da_solicitada · reconfirmacao_necessaria` · exceção `42501` sem permissão de lojista na loja |
| `pair_recusar(p_codigo)` | — | `{ok}` |
| `pair_revogar_dispositivo(p_dispositivo, p_motivo)` · `pair_revogar_sessao(p_sessao, p_motivo)` | dono ou lojista da loja | `{ok, sessoes_encerradas, propostas_canceladas}` — cancela as propostas pendentes e aprovadas-não-executadas da(s) sessão(ões) |
| `pair_revogar_todos(p_loja)` | lojista | `{ok, sessoes_encerradas, propostas_canceladas}` (botão de interrupção) |
| `aprovacao_decidir(p_id, p_hash_visto, p_decisao, p_motivo)` | `p_decisao` = `aprovar\|recusar`; `p_hash_visto` = hash da versão na tela | `{ok:true, estado}` ou `{ok:false, motivo}`: `expirada · estado_<x> · proposta_alterada · reconfirmacao_necessaria` · `42501` (não existe **ou** sem permissão — mesma resposta) |

Leitura (RLS): `pair_dispositivos`, `pair_sessoes` (sem colunas de hash), `aprovacoes`, `notificacoes`.

## 3. Servidor (service_role; nunca expostas ao navegador)

`pair_iniciar` (recebe `p_sal_hash`) · `pair_consultar` · `pair_validar(token_hash, sal_hash)` (a cada chamada do gateway) · `pair_renovar(token_hash, sal_hash, novo_hash)` · `pair_encerrar(token_hash, sal_hash)` · `aprovacao_propor` (teto `54000`: 20 pendentes por sessão, 200 por loja) · `aprovacao_consumir(id, hash)` · `aprovacao_concluir(id, ok, resultado)`. As funções auxiliares em `private` não são executáveis por `authenticated`.

## 4. Gateway MCP — `POST /functions/v1/conecta-gateway`

Headers: `Authorization: Bearer <token>.<sal>`, `Content-Type: application/json`. Corpo ≤ 64 KB. Métodos: `initialize`, `ping`, `tools/list`, `tools/call`; notificações → `202`; lotes (arrays) recusados; `GET` → 405. `401` + `WWW-Authenticate: Bearer` sem sessão válida; `429` (120 chamadas/min por sessão; 30 falhas/5 min por IP).

| Ferramenta | Escopo | Argumentos (todos validados; qualquer outro, inclusive `loja_id`, é recusado) | Efeito |
|---|---|---|---|
| `conecta.list_products` | `produtos:ler` | `busca?` ≤80, `apenas_publicados?`, `limite?` 1–20 | lista (nome, SKU, preço, estoque, marca, publicado, situação) |
| `conecta.get_product` | `produtos:ler` | `sku` | detalhe + o que falta para publicar |
| `conecta.propose_enrichment` | `enriquecimento:propor` | `sku, campo (lista fechada), valor ≤2000, fonte (obrigatória), confianca? 0–1` | grava `a_confirmar` na **Fila de aprovação** existente |
| `conecta.propose_banner` | `banners:propor` | `titulo ≤80, imagem_url (https público), subtitulo?, link_url?, link_sku?, inicio?, fim?, idempotency_key?, versao_de? (grupo_id)` | cria aprovação `banner_publicacao` (MEDIUM+). **Não publica** |
| `conecta.get_pending_approvals` | `aprovacoes:ler` | `limite?` | metadados das pendentes (sem o conteúdo das propostas) |
| `conecta.get_task_status` | `tarefas:ler` | `id` (UUID) | estado de uma aprovação ou tarefa de enriquecimento **da loja da sessão** |

Erro de ferramenta → resultado `isError:true` com mensagem curta. Ferramenta desconhecida/método desconhecido → erro JSON-RPC (`-32602`/`-32601`).

**Escopos** (`pair_escopos_validos`): `produtos:ler · enriquecimento:propor · banners:propor · categorias:propor · paginas:propor · catalogo:propor · campanhas:propor · aprovacoes:ler · tarefas:ler`. Não existe escopo de aprovar, executar ou administrar. (`categorias/paginas/catalogo/campanhas:propor` já podem ser pareados; as ferramentas correspondentes ainda **não existem** no gateway.)

## 5. Exemplo (cliente MCP genérico)

```http
POST /functions/v1/conecta-gateway
Authorization: Bearer <token>.<sal>
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"conecta.propose_banner",
 "arguments":{"titulo":"Promo de freios","imagem_url":"https://cdn.exemplo.com/freios.png"}}}
→ {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\"id\":\"…\",\"versao\":1,\"hash_proposta\":\"…\",\"estado\":\"pendente\",\"mensagem\":\"Pedido enviado à Central de Aprovações. Nada foi publicado…\"}"}]}}
```
