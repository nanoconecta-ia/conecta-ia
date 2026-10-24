# Revisão das funções `SECURITY DEFINER` executáveis por `authenticated` (2026-10-24)

Origem: advisor do Supabase relatado pelo GPT (17 avisos) e leitura própria do catálogo de produção, **somente leitura**. Nada foi alterado.

Leitura própria: **16** funções `public` com `SECURITY DEFINER` e `EXECUTE` para `authenticated`. Nenhuma é executável por `anon`. (A diferença para 17 pode ser contagem do advisor, que inclui funções de outros schemas ou sobrecargas; confira lado a lado antes de decidir.)

| Função | Proteção dentro do corpo | Avaliação |
|---|---|---|
| `aprovacao_decidir`, `automacao_pausar`, `bula_aprovar`, `produto_visibilidade` | `auth.uid()` + checagem de papel/loja | Adequada |
| `bling_app_configurado` | `private.pode_ver_loja(p_loja_id)` | Adequada (só diz se há app configurado) |
| `pode_administrar_loja` | `auth.uid()` + papel/loja | Adequada (é predicado de leitura) |
| `chat_definir_retencao`, `chat_ler_como_administrador` | `auth.uid()` + papel/loja | Adequada |
| `chat_excluir` | só a própria conversa (`user_id = auth.uid()`), vínculo à loja, auditoria | Adequada |
| `oauth_pair_aprovar`, `pair_aprovar`, `pair_revogar_todos`, `pair_detalhe` | `auth.uid()` + papel/loja | Adequada |
| `oauth_pair_detalhe` | exige `auth.uid()` e delega a `pair_detalhe` (que checa papel/loja) | Adequada |
| `pair_revogar_dispositivo`, `pair_revogar_sessao` | `private.pair_pode_revogar(loja, dono, uid)`; resposta igual para inexistente e sem permissão | Adequada |
| `pair_recusar` | exige ser `lojista` de **alguma** loja; recusa o desafio pelo hash do código | **Risco residual baixo** (abaixo) |

## Risco residual: `pair_recusar`
Qualquer lojista de qualquer loja que conheça o código de um pareamento pendente de outra loja poderia recusá-lo (só nega, não aprova). O código é secreto e curto, então a exploração é improvável e o dano é só negar o pareamento. Diff mínimo proposto (**não aplicado**): quando o desafio já tiver `loja_id`, exigir que `uid` seja lojista dessa loja; quando não tiver, manter o comportamento atual. Teste: lojista de B não recusa desafio da loja A.

## Recomendação
- Não revogar `EXECUTE` em lote: todas estas funções são chamadas pelo painel com o usuário logado e já se protegem por dentro. Revogar quebraria o painel.
- Se o proprietário quiser reduzir o aviso do advisor sem perder função, o caminho é mover a checagem para `SECURITY INVOKER` + RLS onde viável, função a função, com teste. Não é necessário para operar.
- As 6 INFO `rls_enabled_no_policy` e o aviso de `pg_net` no schema `public` ficam para decisão do proprietário (tabelas só do servidor e extensão instalada pela plataforma).
