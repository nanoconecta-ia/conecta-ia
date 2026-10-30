# NanoIA — estratégia Workers Free antes de contratar Paid

Decisão do responsável da Mobis (30/10/2026): **não ativar Workers Paid nem gerar custos até comprovar o aplicativo**.

## O que pode ser homologado no gratuito

- Painel de controle, conexões MCP, autenticação por loja, isolamento de dados de laboratório;
- Dois Workers convencionais: `staging/free-parent.ts` (MCP estático, sem geração de código) e `staging/host.ts` (HMAC/Policy Engine/Durable Objects SQLite);
- Ferramentas disponíveis: `catalogo_resumo`, `catalogo_listar` e nenhuma operação de escrita;
- Dados completamente fictícios, auditoria fail-closed, bloqueio de nonce repetido e limite deslizante de 60 consultas/minuto por chave;
- Testes automatizados no GitHub Actions sem autenticação Cloudflare, ou eventual homologação Cloudflare Workers Free **somente após credencial de CI e aprovação expressa**.

## O que Free NÃO comprova

`@cloudflare/codemode`/Dynamic Worker Loader **somente em Workers Paid**. A sandbox de código Python/JavaScript gerado por IA não será hospedada no Free. Isso não significa que o produto esteja comprovado integralmente; a produção Code Mode dependerá de prova adicional e aprovação de custo.

O frontend completo e as integrações **reais** com Bling/Supabase também exigem testes independentes de ponta a ponta com dados comerciais e aprovações controladas. Dois SKUs fictícios não comprovam um ERP funcional.

Limites Free oficiais em outubro de 2026: 100 mil requisições Workers/dia e 10ms CPU por requisição, Durable Objects com backend SQLite e franquias próprias. Exceder cotas Free pode retornar erro, não converte automaticamente para plano pago.

## Execução e segurança

```bash
cd experiments/nanoia-codemode
npm ci --ignore-scripts --no-audit --no-fund
npx wrangler deploy -c staging/wrangler-free-parent.jsonc --dry-run
node test/free-parent-smoke.mjs
```

O `wrangler-free-parent.jsonc` está deliberadamente com `workers_dev:false` e `PILOT_ENABLED:false`; `wrangler dev` o habilita **apenas para testes sintéticos locais**, com credenciais aleatórias passadas via processo.

Não há publicação hospedada, chaves Cloudflare no GitHub ou login do notebook transferido para o runner. Não fazer merge/deploy automático, não ligar Bling, não abrir CORS ou disponibilizar custo/fiscal/fornecedor a provedores gratuitos.

O workflow pago separado do PR #155 fica **suspenso** por decisão do responsável.
