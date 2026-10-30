# NanoIA Code Mode — gates de homologação Cloudflare (30/10/2026)

## Evidências implementadas

PR #153; infraestrutura do piloto em `experiments/nanoia-codemode/`.

- **Canal privado**: Worker pai → Service Binding → Worker host.
- **Autenticação**: HMAC-SHA256 sobre método, caminho, timestamp, nonce, ID da chave e SHA-256 do corpo.
- **Controle de acesso**: somente `catalogo_resumo` e `catalogo_listar`, duas lojas artificiais, nenhuma chave do Bling/Supabase.
- **Egress da IA**: `globalOutbound:null`; o código dinâmico não recebe credenciais HMAC.
- **Replay distribuído**: um Durable Object SQLite por chave/loja no host `staging/host.ts`. `INSERT OR IGNORE` bloqueia nonce reutilizado; persistência está fora da memória do processo.
- **Rate limiting**: máximo 60 requisições assinadas/minuto por chave de teste, no mesmo Durable Object.
- **Auditoria fail-closed**: chamada `agente_chamada_registrar` simulada persiste ferramenta, resultado e UUID no Durable Object. O host só permite resposta positiva se a gravação confirmar a linha via `INSERT ... RETURNING`.
- **Saída restrita**: somente totais e SKU/nome, sem custo, fornecedor, estoque, NCM ou credenciais.

Testes: `npm ci` e `node --experimental-strip-types test/staging-host-do-smoke.mjs`. Compilação sem deploy:
```bash
cd experiments/nanoia-codemode
npx wrangler deploy -c staging/wrangler-host.jsonc --dry-run
npx wrangler deploy -c staging/wrangler-parent.jsonc --dry-run
```

Os testes do `wrangler dev --local` executados em GitHub Actions comprovam os contratos **no runtime local de Workers**; ainda **não comprovam** funcionamento, isolamento, latência ou custos na Cloudflare hospedada.

## Deploy hospedado: NÃO AUTORIZADO AUTOMATICAMENTE

Este PR não contém gatilho automático de deploy. O computador desktop anteriormente autenticado pelo Wrangler não concede autorização ao runner GitHub Actions. **Nunca copiar o token OAuth do desktop**, nem colocar chaves no repo.

Preparação necessária antes de deploy isolado:

1. Criar um **Environment GitHub `cloudflare-homologacao` com reviewer obrigatório** e secret `CLOUDFLARE_API_TOKEN` restrito à conta Cloudflare de staging; cadastrar `CLOUDFLARE_ACCOUNT_ID` em environment variables, e confirmar a conta-alvo.
2. Comprovar que a conta tem os recursos/limites/billing necessários, com ciência prévia de custos. Não atualizar plano pago por automação não aprovada.
3. Gerar em runner **segredos aleatórios descartáveis** para `STAGING_HMAC_A`/`STAGING_HMAC_B` no host e as cópias idênticas `PILOT_HOST_SECRET_A`/`PILOT_HOST_SECRET_B` no Worker pai, mais `PILOT_TOKEN_A`/`PILOT_TOKEN_B`; nunca logs nem artefatos com valores. Cloudflare `wrangler deploy --secrets-file` admite upload conjunto, sem versionar valores.
4. Implantar **primeiro o Worker host** `staging/wrangler-host.jsonc` com `workers_dev:false`, depois o Worker pai `staging/wrangler-parent.jsonc`. No host não há endpoint HTTP público. O pai é acessível somente no ambiente de testes, protegido por Bearer de teste e rejeição de Origin.
5. Testar por URL hospedada: 401 sem Bearer, 403 Origin, egress isolado, duas lojas, 60/minuto, nonce repetido, expiração, token revogado, HTTP 429/502, auditoria e rollback sem efeitos na Mobis.
6. Revisar `wrangler deployments list`, logs, limites e gastos, e somente então considerar homologado. Rollback/revogação precisa ser ensaiado; **não ligar ao Bling**.

**Bloqueios atuais:** ausência de autorização CI para Cloudflare, validação hospedada pendente; PR #153 permanece draft sem merge. Nenhuma escrita, deploy, migração de banco ou ativação de serviço pago foi executada.

## Advertências operacionais

- O fixture hospedado é exclusivamente sintético e não deve ser convertido em serviço de produção removendo a palavra `staging`. A fonte de dados real, RLS, rotação de segredos, gestão de identidades e auditoria operacional real exigem nova revisão de segurança.
- `workers_dev:true` no **pai de staging** expõe somente endpoint MCP com bearer aleatório; jamais usar com chaves financeiras/ERP.
- Cloudflare Service Bindings não substituem HMAC/validação de cada chamada. O armazenamento distribuído também não substitui autorização por tenant.
- Antes do teste de hospedagem, definir teto financeiro e política de limpeza dos dados de auditoria da homologação.
