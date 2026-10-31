# Portal público Conecta.IA — aceite e privacidade (30/10/2026)

## Estado real
- Código na PR #158; a prévia pública é **estática** e não invoca Supabase, Bling nem modelos de IA.
- Os links institucionais existem em `painel/public/{institucional,privacidade,termos,seguranca,contato}.html` e CSS em `painel/public/site-publico.css`.
- A página inicial do painel administrativo continua `noindex` e requer autenticação. A página institucional é uma URL separada e pode servir como homepage OAuth após publicação em domínio próprio.
- Em preview do Cloudflare, usar `noindex,nofollow`. **Não usar a URL pages.dev como domínio de marca verificada para OAuth.**
- Não existe checkout, formulário comercial ou coleta de documentos fiscais nas páginas institucionais.

## Checklist editorial e jurídico antes da publicação ampla
1. Confirmar razão social, CNPJ, município e responsável pelo canal WhatsApp informados na página; não inventar e-mail ou endereço.
2. Definir formalmente papel de controlador/operador por cenário: plataforma, lojas parceiras, usuários do painel e titulares de dados.
3. Inventariar provedores efetivos (Supabase, Cloudflare, IA, ERP) e contratos, locais de armazenamento/transferência, prazo de retenção, logs, fluxos de exclusão e resposta aos titulares.
4. Validar política de privacidade e termos com responsável jurídico antes de coletar dados de terceiros no piloto.
5. Verificar se Analytics, Meta Pixel, Google Ads Tag, cookies não essenciais ou integrações adicionais foram instalados no domínio. Publicar informações e controles correspondentes **antes** de ativar rastreamento.
6. Verificar o funcionamento do canal de suporte e uma rotina real de resposta.
7. Conferir políticas específicas da LOJA: troca, devolução, entrega, garantia, dados da empresa, preço, disponibilidade, pagamento, dados de frete. As políticas desta plataforma não substituem as da loja.
8. Não publicar marca de certificação, selo de aprovação, `100% seguro`, `aprovação Google` ou `Google parceiro` sem prova.
9. A homepage pública precisa exibir benefícios e funções verdadeiras, limitar recursos ainda em piloto e não se tornar uma página vazia de redirecionamento.
10. Confirmar políticas de indexação: institucional poderá ser indexado após revisão; áreas administrativas e prévias jamais entram no sitemap público.

## Google Ads e OAuth
- [Requisitos de destino Google Ads](https://support.google.com/adspolicy/answer/6368661?hl=pt-BR): site útil, funcional e fácil de navegar, não apenas uma passagem a outro destino.
- [Verificação Google OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification): homepage pública, política acessível no mesmo domínio, nome/marca e links corretos, propriedade do domínio verificada no Search Console.
- O **domínio do app** deve ser próprio, configurado no Google Cloud OAuth e validado. Hospedagem Pages compartilhada não basta para comprovar domínio de propriedade.
- As páginas de vendas da Mobis possuem exigências diferentes das páginas de SaaS. Não usar o portal de software como destino de anúncio de peça que não aparece na própria página.
- Não iniciar Google Ads, Merchant Center ou verificação OAuth antes de testar HTTPS, contatos, navegação, formulário de login, OAuth, conteúdo, mobile e fluxos de privacidade.

## Validação técnica
- `cd painel && npm ci && npm test && npm run build`.
- Conferir `dist/institucional.html`, `dist/privacidade.html`, `dist/termos.html`, `dist/seguranca.html`, `dist/contato.html` e `dist/site-publico.css`.
- Testar 390 px e 1366 px, teclado, botão Voltar, links externos, contato, foco e mensagens de erro.
- Painel conectado usa Supabase Auth real; login funcional deve ser homologado com uma conta de teste autorizada, sem inserir dados fiscais no teste.
- Antes de alterar DNS ou publicar na produção, revisar o build e aprovar explicitamente a liberação.
