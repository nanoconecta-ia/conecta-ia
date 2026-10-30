# NanoIA — Code Mode (piloto isolado)

**Estado:** laboratório executável no Cloudflare Workers, com quatro operações estritamente de consulta, dados 100% fictícios e acesso desabilitado por padrão. Este protótipo **NÃO é publicado**, não executa nada no Supabase/Bling e não contém chaves reais.

Base técnica: [Cloudflare — Code Mode MCP](https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/). Foi usada a modalidade **single `code` tool**, adequada a um conjunto pequeno de ferramentas. A modalidade `search()+execute()` fica como evolução quando o catálogo de APIs crescer. A ferramenta Code Mode usa **DynamicWorkerExecutor** com `globalOutbound: null` (nenhum acesso externo direto) e `timeout: 12000`, não `eval` com credenciais do ERP.

## Arquivos

- `src/server.ts`: servidor MCP experimental via `codeMcpServer()` e `createLegacyMcpHandler()`, expõe uma ferramenta `code` sobre quatro operações.
- `src/dados-sinteticos.mjs`: duas lojas independentes com SKUs fictícios, auditoria cadastral determinística.
- `src/seguranca.mjs`: gate de ambiente desligado, tokens de laboratório por loja e limite de 12 chamadas internas por requisição.
- `test/seguranca.test.mjs`: isolamento por tenant, ausência de dados financeiros, entradas inválidas, gate e limite.
- `benchmark.mjs`: **30 cenários sintéticos**, relata diferença de bytes e estimativa de número de interações; **não mede tokens da LLM**.

## CI e protocolo realmente validados

Em 30/10/2026, o CI do laboratório executou o Worker com `wrangler dev --local`, usando duas credenciais **inventadas e exclusivas do teste**. A requisição MCP negociou `initialize`, confirmou somente a ferramenta `code`, executou `catalogo_resumo` e verificou isolamento entre A/B, rejeição de origem de navegador e tentativa de egress, **sem contatos com Bling/Supabase**. O smoke é repetido nos PRs; a aprovação não equivale a segurança ou disponibilidade em ambiente hospedado.

## Execução de testes sem dependências

```bash
cd experiments/nanoia-codemode
node --test test/*.test.mjs
node benchmark.mjs
```

## Testar Code Mode com a Cloudflare (NÃO publicar)

Requer Node 24, Workers runtime compatível com **Worker Loaders** e dependências citadas no `package.json`. Estas versões são fixas; o `package-lock.json` já está versionado e o CI usa `npm ci`. Os testes sem dependências acima funcionam independentemente disso.

1. Instalar dependências de desenvolvimento em ambiente de laboratório.
2. Configurar `PILOT_ENABLED=true` apenas localmente e gerar dois tokens aleatórios, distintos, com pelo menos 24 caracteres, em `.dev.vars` **não versionado**: `PILOT_TOKEN_A` / `PILOT_TOKEN_B`. Não usar chaves existentes.
3. Executar `npm run dev` (somente `wrangler dev --local`).
4. Enviar solicitação MCP ao endpoint local `/mcp` com um token sintético; esperar uma única ferramenta `code`.
5. Exemplo de código do modelo no sandbox:

```js
async () => {
  const l = await codemode.catalogo_listar({ busca: "D4CB", limite: 10 });
  const itens = [];
  for (const x of l.itens) {
    const p = await codemode.catalogo_ver({ sku: x.sku });
    const t = await codemode.taxonomia_motor({ motor: p.motor });
    itens.push({ sku: p.sku, pendencias: p.pendencias, homologacao: t.homologacao });
  }
  return { origem: "fixture_sintetica", itens };
};
```

Todos os resultados são ficcionais; qualquer "aplicação" retornada é **candidata sem homologação**.

## Controles e limitações

- **Nenhum caminho direto ao Bling/Supabase ou outros serviços**: nenhuma biblioteca/credencial de produção no módulo. O identificador da loja vem exclusivamente do token do piloto.
- O limite de 12 chamadas é por **requisição externa**, não quota diária. Em produção precisa de limites por conta, custo, tempo e revalidação por operação.
- **Egress:** `globalOutbound: null` é explícito, e um smoke test local verifica `fetch()` bloqueado dentro do Worker Loader. Isso **não comprova** o isolamento na Cloudflare hospedada. A Cloudflare declara que Miniflare não é uma sandbox endurecida; nenhuma chave/dado real no teste.
- A autorização por token estática é para fixtures, **não** substitui OAuth, expiração/revogação, RLS, Policy Engine, auditoria persistente ou aprovação humana.
- Não se deve conectar este Worker diretamente à API Bling; a integração futura requer um adapter server-side que revalide o escopo por operação e chame `despachar()` com auditoria.
- `workers_dev=false`, `PILOT_ENABLED=false`, ausência de rotas e separação em `experiments/` são barreiras de implantação acidental, não substituem análise de segurança.
- O Code Mode **não corrige HTTP 429/502** do provedor e não garante redução de tokens ou custos; medir num piloto autorizado depois de corrigir esses erros.
- Não criar PR de merge/deploy antes de CI e homologação. Configurar consentimento para enviar contexto técnico aos modelos; custos, fornecedores e dados fiscais nunca para provedores gratuitos.

## Aceite

- [x] Código real de Code Mode no repositório (ainda não executado em Cloudflare)
- [x] Quatro ferramentas somente leitura em fixtures; dois tenants; opção desligada por padrão
- [x] Testes Node e benchmark incluídos para CI
- [x] CI e bundling do Worker via `wrangler deploy --dry-run` (**não** é deploy)
- [x] Smoke local com `wrangler dev --local`: MCP `initialize`, `tools/list` e `tools/call` para duas lojas fictícias, autenticação, Origin, egress e limites
- [ ] Provar a política de egress, revogação e timeout em runtime **hospedado isolado de produção**; Miniflare local não é sandbox endurecida
- [ ] Medição de tokens e custo reais versus MCP tradicional
- [ ] Adaptador MCP -> Policy Engine/Despacho com credenciais autorizadas
- [ ] Contrato de autenticação/retensão/homologação e roll-back antes de qualquer publicação
