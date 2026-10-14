# Arquitetura só com Supabase + GitHub (proposta; aguarda aprovação do dono)

Restrição do dono: nada no Render (nem outra hospedagem); somente Supabase e GitHub.
O app Next.js atual (branches `feat/app-esqueleto` e `feat/bling-conexao`) precisa de um servidor Node, que nenhum dos dois
oferece. Proposta:

| Peça | Onde roda | Observação |
|---|---|---|
| Painel do lojista (login, aprovações, configurações, ajuda) | GitHub Pages (SPA estática: Vite + React + supabase-js) | Lê o banco direto com RLS; operações privilegiadas via Edge Functions |
| Login | Supabase Auth (e-mail/senha, Google, MFA do super admin) | Já existe |
| Conexão Bling (OAuth) | Edge Functions `bling-conectar` e `bling-callback` | Callback = `https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/bling-callback`; state assinado (HMAC) com loja e usuário; tokens cifrados via RPC |
| Webhook do Bling | Edge Function `bling-webhook` | Valida HMAC `X-Bling-Signature-256` sobre o corpo bruto |
| API/MCP do agente | Edge Function `agente` | Chave por loja (hash); só rotas da fila |
| Vitrine pública (SEO) | Páginas estáticas geradas por GitHub Actions (build lê produtos publicados com a chave pública) e republicadas por agenda e a cada publicação | Evita página renderizada só no navegador, que prejudica o SEO |
| Segredos (Bling, chave de cifra, service role) | Secrets das Edge Functions no painel do Supabase | Nunca no repositório, no chat ou no navegador |

## Limites e decisões do dono
- GitHub Pages em repositório **privado** exige plano pago do GitHub; em repositório público o código fica visível (sem segredos).
- Domínio da Mobis só depois de DNS e SSL verificados e com plano de volta; o site atual continua no ar.
- Edge Functions têm limite de tempo por execução; sincronização grande roda em lotes.
- Reaproveita a lógica de `web/src/lib/bling/*` (cifra, OAuth, cliente, assinatura) portada para as Edge Functions.
