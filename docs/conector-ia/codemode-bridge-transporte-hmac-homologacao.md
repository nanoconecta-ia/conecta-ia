# Homologação do canal Code Mode → host autorizado (HMAC)

**Situação:** implementação de laboratório na branch do PR #153, sem merge, sem publicação Cloudflare/Supabase, sem credenciais comerciais ou dados da Mobis. A execução por GitHub Actions é **local/descartável**, não homologação hospedada.

## Componentes

- `experiments/nanoia-codemode/src/bridge-auth.mjs` — contrato de assinatura e verificação HTTP `POST /v1/codemode/consulta`. A autenticação HMAC-SHA256 vincula método, caminho, timestamp, nonce, identificador de chave e SHA-256 dos bytes exatos do corpo.
- `experiments/nanoia-codemode/src/server.ts` — no **Worker pai**, quando `PILOT_ENABLED=true` e `PILOT_BRIDGE_ENABLED=true`, duas ferramentas Code Mode (`catalogo_resumo` e `catalogo_listar`) chamam o host por HTTP assinado. Os segredos ficam no Worker pai, não no Worker dinâmico. `globalOutbound: null` permanece habilitado para o código não confiável. Essa opção está **desligada por padrão**.
- `supabase/functions/_shared/conector/codemode_bridge.ts` — no host, revalida a chave e a loja para **cada chamada**, roda `despachar()` com Policy Engine, esquema e auditoria, retorna exclusivamente contagens/SKU/nome. Nenhuma operação de escrita é exposta.
- `experiments/nanoia-codemode/test/bridge-host-fixture.mjs` — host fictício HTTP apenas em `127.0.0.1`, com duas lojas e RPC de auditoria mock. **Nunca usar como serviço público**; o armazenamento de nonces é apenas memória local.
- `experiments/nanoia-codemode/test/bridge-runtime-smoke.mjs` — sobe host e Worker separados em CI e prova o caminho completo; os segredos HMAC são gerados com aleatoriedade a cada execução.
- `experiments/nanoia-codemode/test/bridge-auth.test.mjs` — contrato de assinatura, replay, expiração, revogação, destino e falha fechada.

## Segurança adotada e limitações

**Identidade:** `x-nano-key-id` identifica uma chave do host; o host **não confia** em `loja_id` incluído na mensagem. O ID da loja advém exclusivamente da chave autenticada, e a ponte revalida o escopo `leitura`. A chave e a conta MCP reais continuam indisponíveis para a sandbox.

**Assinatura:** HMAC-SHA256 `v1=...`, tolerância de ±30 segundos, nonce UUID único, corpo até 4096 bytes, comparação constante de assinaturas. Corpo alterado, assinatura inválida, método/caminho incorreto, timestamp expirado ou repetição são recusados.

**Replay:** a memória do host-fixture serve SOMENTE aos testes. Hospedagem **multi-instância** exigirá armazenamento atômico compartilhado, por exemplo Durable Object/Redis, com TTL e idempotência. Sem isso, o canal **não deve ser publicado**.

**Transporte:** HTTPS é obrigatório em host remoto, URL fixa fornecida por configuração confiável, redirects proibidos; `http://127.0.0.1` é permitido **exclusivamente quando uma flag local de teste é explicitamente ativada**. Em hospedagem, configurar credenciais via secret store e validar a cadeia TLS. HMAC comprova integridade/autenticidade de cada chamada, mas **não substitui** TLS, autorização por operação ou observabilidade.

**Saída:** respostas do host devem continuar estritamente minimizadas; não transportar preço, custo, estoque, fornecedor, NCM/CFOP, tokens ou segredos para código gerado ou provedores gratuitos.

**Execução:** sandbox Code Mode sem egress direto (`globalOutbound: null`), timeout de 12 s, até 12 chamadas internas por execução. O host recebe requisições do **handler confiável no Worker pai**, não do JS arbitrário executado no sandbox.

**Limitações da homologação local:** não comprova isolamento do runtime hospedado, alto volume/concor­rência, replay entre instâncias, latência de rede, rotação real de segredos, cancelamento de chamadas em andamento ou revogação distribuída.

## Critérios obrigatórios antes de staging hospedado

1. Criar **contas/projeto temporários de homologação separados** de produção, sem vínculo a dados reais. Nenhuma chave de Bling, Supabase da Mobis ou fornecedor deve ser provisionada.
2. Criar um host de homologação HTTPS com armazenamento **durável, atômico e distribuído** de nonces (por chave + nonce + TTL), autenticação e revogação persistente, rate limit por chave/loja e logs de auditoria sem dados sensíveis.
3. Guardar HMACs por identidade no secret store; plano de rotação e revogação. Credenciais de Worker pai não podem ser disponibilizadas ao Worker dinâmico.
4. Implantar primeiro o host e depois **somente o Worker de teste**, usando binding `LOADER` e `globalOutbound: null`. Testar assinatura, replay sob concorrência, mudança de escopo, egress `fetch/connect`, timeout, 401/403/429/500 e rollback.
5. Aceite exige CI verde no mesmo commit, trilha de auditoria por chamada, nenhum acesso cruzado, zero permissões de escrita e verificação da versão efetivamente hospedada.
6. Somente numa etapa posterior, após autorização específica e revisão de segurança, habilitar consultas RLS ao catálogo real em leitura, **sem habilitar ações no Bling**.

## Como reproduzir (CI)

```bash
cd experiments/nanoia-codemode
npm ci --ignore-scripts --no-audit --no-fund
node --test test/bridge-auth.test.mjs
node --experimental-strip-types test/bridge-runtime-smoke.mjs
```

O teste sobe processos locais descartáveis, não cria serviços externos nem altera o ERP.

## Estado de aceite

- [x] Contrato HMAC independente do modelo e da loja
- [x] Host mock aplica a ponte existente e `despachar()` real, com dados artificiais
- [x] Testes automatizados de falsificação, replay, timestamp, separação entre A/B e revogação definidos
- [ ] Confirmar execução CI e logs do smoke HMAC no commit final
- [ ] Host hospedado HTTPS com replay durável e chaves gerenciadas
- [ ] Homologação Cloudflare real (sem segredos comerciais), evidências de rede e cancelamento
- [ ] Monitoramento p50/p95, erros, custos, desempenho comparativo e reversão testada
