# Cloudflare Free — homologação isolada do Conecta.IA

Objetivo: testar build e entrega estática por Cloudflare Pages sem tocar na produção GitHub Pages, Supabase, Bling, DNS, domínios ou checkout.

## Segurança
- Projeto separado no Cloudflare Pages: `conecta-ia-homologacao-free`, preferencialmente criado com branch de produção `main`; o workflow publica na branch de **preview** `homologacao-free`.
- GitHub Environment: `cloudflare-homologacao-free`, revisor exigido: `mobispecas-rgb`.
- Pull requests executam **somente validações** sem segredos e sem deploy. O job de publicação exige evento **manual** `workflow_dispatch`, branch `main` e aprovação no Environment.
- Segredos do **ambiente**, nunca no repositório, nunca em logs: `CLOUDFLARE_API_TOKEN` (token limitado a Pages Write do projeto/conta aplicável) e `CLOUDFLARE_ACCOUNT_ID`.
- Não usar `SUPABASE_SERVICE_ROLE_KEY`, credenciais do Bling, custos, fornecedores ou dados de clientes.
- Não atribuir domínio personalizado à prévia. Não alterar DNS.

## O que essa prévia prova (e o que NÃO prova)
- Testa build do painel completo, testes de unidade e publicação de uma vitrine demonstrativa em React com dados **fictícios**.
- O `painel/src/main-homologacao.tsx` só carrega `VitrineDemo`. O build separado não carrega App, Supabase ou Bling, não recebe informações reais e falha se contiver URLs/chaves públicas operacionais.
- **Não prova** autenticação real, pareamento QR, MCP, conexão Bling, integração Supabase nem funções comerciais. Para essas funções é necessário um banco/projeto de staging independente, dados sintéticos, políticas de acesso e matriz de testes.
- A revisão obrigatória permite autoaprovação (`prevent_self_review=false`); não é revisão independente. Para segregação real, designar outro revisor e bloquear autoaprovação.

## Pré-requisitos antes de acionar o workflow
1. Criar no Cloudflare Pages um **novo** projeto Direct Upload denominado `conecta-ia-homologacao-free`. Confirmar que é separado de qualquer projeto em produção e que está no plano gratuito; definir `main` como branch de produção.
2. Criar um token de API Cloudflare **escopado**, com Pages Write, sem token global; colocá-lo apenas no Environment GitHub.
3. Confirmar o ID da conta Cloudflare e colocá-lo apenas no Environment.
4. Revisar e fazer merge desta PR, depois iniciar manualmente GitHub Actions > Cloudflare Free - homologação isolada > Run workflow.
5. Aprovar o job no Environment e checar a URL real retornada, o status 200, o aviso “dados fictícios”, e inexistência de tráfego ao Supabase ou Bling.
6. Se algo falhar, parar o workflow e eliminar a prévia sem afetar GitHub Pages.

O workflow não cria o projeto nem credenciais automaticamente para evitar usar contas ou recursos errados.
