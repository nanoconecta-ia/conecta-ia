# Edge Functions (Supabase)

| Função | verify_jwt | Função |
|---|---|---|
| `bling-conectar` | sim | POST `{loja_id}` com o login do usuário; devolve a URL de autorização do Bling (state assinado) |
| `bling-renovar` | não (autenticação própria: `x-cron-segredo`) | Chamada pelo cron a cada 30 min; renova o token do Bling que vence em até 60 min. Publicada em 2026-10-17; migração `20261018000001` aplicada (reserva, Vault e cron). Sem os segredos do Bling responde 503 |
| `assistente` | sim | Assistente do lojista: responde só com dados da própria loja e registra Aprovar/Rejeitar da fila (grava via service role e audita). Sem provedor de IA: intenção por palavras-chave |
| `vitrine-assistente` | não (público, só lê produto publicado e fato aprovado) | Assistente da página do produto para o cliente: nunca inventa, leva ao WhatsApp quando não há confirmação |
| `bling-callback` | não (autenticação própria: state assinado, 10 min) | Troca o código por tokens no servidor, cifra e grava via RPC |

Secrets (painel do Supabase > Edge Functions > Secrets; nunca no repositório): `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`,
`ESTADO_SEGREDO`, `CREDENCIAIS_CHAVE_CIFRA` (32 bytes em base64) e, opcional, `APP_URL` (para redirecionar ao painel).
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções.

Testes locais (Node 22): `node --experimental-strip-types --test supabase/functions/_shared/shared.test.ts`.
Publicadas em 2026-10-14 (versão 1 de cada). Sem secrets, ambas respondem 503 "ainda não configurada".
