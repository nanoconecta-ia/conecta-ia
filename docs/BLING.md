# Bling API v3 — fatos confirmados na documentação oficial

Fonte: developer.bling.com.br (referência colada pelo cliente em 2026-10-13). Nada aqui é inventado;
o que a documentação não cobre fica marcado como **a confirmar**.

## OAuth 2.0 (authorization code)
- Autorizar: `GET https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=…&state=…`
- Token: `POST https://www.bling.com.br/Api/v3/oauth/token`, `Authorization: Basic base64(client_id:client_secret)`,
  `Content-Type: application/x-www-form-urlencoded`, `Accept: 1.0`, `enable-jwt: 1`.
  - `grant_type=authorization_code&code=…` ou `grant_type=refresh_token&refresh_token=…`.
- O `state` é validado no callback (cookie httpOnly, comparação em tempo constante).
- Tokens JWT têm ~1.500–3.000 caracteres: nunca truncar (colunas `text`).
- Refresh token é de uso único: ao renovar, gravar o novo par imediatamente.

## Requisições
- Base: `https://api.bling.com.br/Api/v3`; `Authorization: Bearer <access_token>` e `enable-jwt: 1` em todas.
- Limites: 3 req/s e 120.000 req/dia por conta; `429` → esperar e tentar de novo.

## Webhooks
- Assinatura: header `X-Bling-Signature-256: sha256=<hex>` = HMAC-SHA256 do corpo bruto com o client secret.
- Validar sobre o corpo **bruto**, em tempo constante, antes de processar. Idempotência pela chave do evento.
- Mapeamento `companyId` → loja: **a confirmar** (depende da migração de credenciais; ver `supabase/migrations/20261014000001_*`).

## Tipo de aplicativo
- Piloto Mobis: aplicativo **privado** (cadastrado na Central de Extensões → Área do Integrador) basta.
- SaaS multi-cliente: aplicativo público + homologação do Bling.

## Variáveis (somente nomes; valores nunca no repositório)
`BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `CREDENCIAIS_CHAVE_CIFRA` (32 bytes em base64), `APP_URL`.
URL de callback a cadastrar no Bling: `${APP_URL}/api/bling/callback`.
