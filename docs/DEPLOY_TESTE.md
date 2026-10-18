# Deploy de teste do app (endereço provisório)

Objetivo: ter um endereço no ar para o lojista entrar, ver as telas e para o callback do Bling. **Não altera DNS nem o
site atual da Mobis.** Autorizado pelo dono em 2026-10-14; quem executa é o dono (a conta de hospedagem é dele).

## Passos (exemplo com Vercel; outra hospedagem Next.js serve)
1. Criar conta na hospedagem e importar o repositório `nanoconecta-ia/conecta-ia`, **pasta raiz `web`**.
2. Variáveis de ambiente (somente no painel da hospedagem; nunca no repositório, chat ou log):
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (apenas servidor), `APP_URL` (o endereço da
   hospedagem, ex.: `https://conecta-ia-xxxx.vercel.app`), `CREDENCIAIS_CHAVE_CIFRA` (32 bytes em base64, gerada por você),
   `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `INGEST_KEY_PEPPER`, `FRESCOR_MAX_MINUTOS`.
3. Supabase → Authentication → URL Configuration: Site URL = `APP_URL`; Redirect URLs = `APP_URL/auth/callback` e
   `APP_URL/redefinir-senha`. Para entrar com Google, habilitar o provedor Google (credenciais do dono).
4. Publicar e abrir `APP_URL/entrar`. Criar o primeiro usuário pelo painel do Supabase e avisar o assistente para
   vincular a loja `mobis` ao login.
5. No Bling (Cadastro de aplicativos, tipo **Privado**, só leitura): URL de callback `APP_URL/api/bling/callback`.
6. A loja continua com `ambiente = teste`: o visitante vê o aviso de teste até todos os requisitos de produção.

## Cuidados
- Sem proteção de acesso na URL pública do callback, o Bling não consegue chamar: use o deployment de produção do
  projeto (sem domínio próprio ainda), não os previews protegidos.
- A chave `service_role` e os segredos do Bling nunca vão para o navegador.
- Domínio próprio da Mobis só depois de DNS e SSL verificados e com plano de volta (site atual no ar).
