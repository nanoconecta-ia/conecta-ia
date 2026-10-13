# Conecta.IA — app web (Next.js)

Esqueleto do painel do lojista, da área do super admin e da vitrine responsiva. Sem chaves no navegador: o login e as consultas rodam no servidor.

## Rodar
```
cd web && npm install
# variáveis (só nomes em ../.env.example): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, APP_URL
npm run dev
```
Checagens: `npm run typecheck` e `npm run build`.

## Rotas
| Rota | O que é |
|---|---|
| `/entrar` | Login por e-mail/senha e Google (o provedor Google precisa ser ativado no Supabase) |
| `/painel` | Visão geral, catálogo (espelho), **Antes de publicar** (Bling × site lado a lado), conexão Bling |
| `/admin` | Lojas. Exige `app_metadata.papel = super_admin` **e** sessão MFA (aal2) |
| `/loja/[slug]` | Vitrine pública: só produtos publicados; produto com dados estruturados e botão de WhatsApp |

## Limitações atuais
- Conexão com o Bling (OAuth) ainda não existe: o painel mostra o estado e o botão fica desativado.
- Publicar/despublicar não está ligado: precisa de uma função no banco (migração a aprovar).
- Cadastro do segundo fator (MFA) do super admin: a tela `/admin/mfa` é só um aviso.
- A vitrine ainda resolve a loja por `slug`, não pelo domínio próprio do cliente.
- Exigências de publicação em `src/lib/publicacao.ts` são provisórias (decisão em aberto).
- Testado: `tsc`, `next build`, redirecionamento de rota protegida sem login e layout do login em 390 px e 1280 px. Não testado contra um Supabase real com dados.
