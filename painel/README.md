# Painel do lojista (site estático)

Vite + React + supabase-js. Roda inteiro no navegador; tudo privilegiado passa por Edge Functions (`supabase/functions`).
A chave usada é a **publicável** (pública por definição) e a segurança vem da RLS do banco. Nunca colocar `service_role` aqui.

- Rotas por hash: `#/`, `#/catalogo`, `#/bling`, `#/contador`, `#/entrar`, `#/recuperar`.
- Testes: `npm test`; build: `npm run build` (saída em `dist/`).
- Publicação: workflow `.github/workflows/painel-pages.yml` (GitHub Pages, ao integrar na `main`).
- Supabase > Authentication > URL Configuration: Site URL e Redirect URLs = endereço do Pages (ex.: `https://nanoconecta-ia.github.io/conecta-ia/`).
- Secret `APP_URL` das funções = o mesmo endereço (para o retorno do Bling cair em `#/bling`).
