# Extração técnica do vídeo 470348.mp4 — Code Mode para NanoIA

## Evidência e objetivo

O vídeo (104,5 s) apresenta o padrão **server-side Code Mode** divulgado pela Cloudflare. Os quadros em 15–40 s mostram o problema de declarar muitas ferramentas e das sucessivas idas e voltas ao modelo; em 50–68 s, código executado em sandbox encadeia operações; em 75–95 s, aparecem `search()` e `execute()`, e uma comparação ilustrativa do consumo de tokens.

A fonte oficial (Cloudflare, 2026-02-20) descreve a abordagem: https://blog.cloudflare.com/code-mode-mcp/ .
Documentação atualizada 2026-10-27: https://developers.cloudflare.com/agents/model-context-protocol/guides/build-codemode-mcp-server/ .
A Cloudflare chama Code Mode de **experimental** e alerta que há possibilidade de mudanças incompatíveis.

O MCP **não acabou**: o Code Mode é uma forma de expor/consolidar ferramentas em um servidor MCP. No exemplo da Cloudflare, a cobertura de mais de 2.500 operações passa por uma superfície compacta (search/execute). O benchmark divulgado **não é uma previsão** de economia na API do Conecta.IA.

## Qual padrão adotar

| Escala | Alternativa | Recomenda-se |
|---|---|---|
| Ferramentas limitadas, já expostas via MCP | `codeMcpServer()` — uma ferramenta de código sobre conjunto tipado | **Piloto** do Conecta.IA, após homologação de isolamento |
| API grande com contrato OpenAPI 3.x | `openApiMcpServer()` — `search()` + `execute()` | Fase posterior, quando a base de ações crescer |
| Poucas consultas estáveis, sem sandbox | Gateway atual de ferramentas normais | **Manter**, como referência e fallback |

**Não** ligar diretamente `https://mcp.cloudflare.com/mcp` ao Bling esperando acesso ao ERP: aquele endpoint é da **API Cloudflare**, e não uma ponte para o Conecta.IA. Para a Mobis é preciso criar o adaptador próprio, a documentação OpenAPI ou o wrapper das ferramentas existentes.

## Arquitetura alvo (não implementada)

```text
ChatGPT / GPT API / Gemini / Claude
              |
      MCP server público
     Code Mode (opt-in)
              |
  Worker isolado sem segredos,
  sem rede arbitrária e sem FS
              |
  callback host: operação tipada
              |
  autenticação por loja e escopo
              |
 policy.ts -> schema.ts -> despacho.ts
              |
       auditoria por ação
              |
        +-----+-------+
        |             |
   Bling somente GET  Supabase somente leitura
                      catálogo / taxonomia
              |
    resultado minimizado
              |
          modelo LLM
```

O código gerado pelo modelo não terá acesso a `SUPABASE_SERVICE_ROLE_KEY`, OAuth do Bling, `Deno.env`, `fetch` aberto, arquivos, comandos OS ou JavaScript na mesma execução da Edge Function administrativa. `eval`, `new Function` e shell remoto sob credenciais privilegiadas são proibidos. O isolamento deve ocorrer em executor específico de sandbox, ex. Cloudflare Dynamic Worker Loader, ou equivalente comprovado.

Cada `request()` interno atravessa **o Policy Engine** e recebe `requestId`/correlação, `loja_id` do token verificado (nunca do código do modelo), checagem de esquema, escopo, timeout, limites por loja, quota e auditoria. Não permitir URL genérica ou operação SQL arbitrária. A orquestração de várias requisições **não** é uma transação atômica no Bling.

## Exemplo prático (pseudocódigo, não é endpoint existente)

Pergunta: “Encontre produtos do motor HR D4CB com problemas cadastrais e prepare uma proposta com fontes, sem cadastrar duplicatas.”

```ts
// Executado em worker isolado, por meio de métodos tipados *aprovados*.
const itens = await conecta.catalogo.listar({ busca: "HR D4CB", limite: 20 });
const resultados = [];
for (const item of itens) {
  const p = await conecta.catalogo.ver({ sku: item.sku });
  const taxonomia = await conecta.taxonomia.buscar({ termo: p.nome });
  resultados.push({
    sku: p.sku, nome: p.nome,
    faltantes: p.faltando_para_publicar,
    nos_candidatos: taxonomia.map(x => ({ nome: x.nome, status: x.status }))
  });
}
return resultados;
```

Somente o resultado reduzido volta ao modelo. Não usar `Promise.all` irrestrito contra o Bling: limitar concorrência e paginação. A ausência de SKU não prova inexistência no ERP. O modelo não pode inferir OEM, GTIN, NCM, medidas ou compatibilidade pela similaridade nominal.

## Mapeamento à base existente (PR #153)

- `supabase/functions/_shared/conector/registro.ts`: lista de definições, riscos, permissão e schemas → origem da descoberta de ferramentas.
- `supabase/functions/_shared/conector/handlers.ts`: ações atuais → callback tipado no host, **nunca** executadas diretamente pelo código da IA.
- `supabase/functions/_shared/conector/policy.ts` e `despacho.ts`: manter a decisão central, validação e auditoria por ação.
- `supabase/functions/_shared/conector/gateway.ts`: manter MCP normal para clientes que não suportem Code Mode; opcionalmente um segundo gateway/rota para Code Mode.
- `supabase/functions/_shared/conector/chat.ts`: não misturar saída de ferramentas e resposta parcial de dois modelos; memória técnica permanece opt-in.
- `painel/src/paginas/GptWorkspace.tsx`: futuro indicador de economia de tokens/latência, estado do sandbox, auditoria de chamadas e seletor *normal*/*code mode*. Não ligar o toggle sem backend homologado.

## Regras de segurança e negócio — sem exceção

1. **Leitura primeiro**: Bling GET, catálogo, categorias, taxonomia e pendências. Custo, fornecedor, dados fiscais e credenciais não devem entrar no sandbox nem no prompt de provedores gratuitos.
2. **Propostas não são escritas**: executar programa que prepara sugestão não autoriza alteração de produto, preço, estoque, categoria ou publicação.
3. **Dois níveis de aprovação**: eventual operação de alto impacto exige ação explícita humana sobre versão exata e execução pelo componente autorizado, fora do sandbox.
4. **Memória segregada**: Code Mode não cria memória do ChatGPT. Usar histórico do Conecta.IA e conhecimento validado apenas conforme consentimento, retenção e isolamento de tenant.
5. **Observabilidade**: medir ferramentas anunciadas, tokens de instruções, número de idas/voltas ao modelo, quantidade de chamadas reais à API, taxa de 429/502, p50/p95, custo e resultados com fonte.
6. **Antirrepetição**: se auditoria ou rede falhar após chamada interna, status é indeterminado; não repetir operação com efeitos automaticamente. Usar chave de idempotência quando houver suporte.

## Matriz de aceite do protótipo isolado

- [ ] Rodar Code Mode **sem produção, sem segredos e sem alterações no Bling**, com mocks de pelo menos 2 lojas.
- [ ] Testar `search` ou `code` sobre registro tipado com descoberta progressiva e resposta limitada.
- [ ] Testar `execute` em isolate: negar rede externa, acesso a env, execução infinita, payload oversized, reentrância e argumentos não autorizados.
- [ ] Garantir que cada operação do código passe por `policy.ts`, `schema.ts`, `despacho.ts` e auditoria; revogação impede a próxima chamada interna.
- [ ] Verificar perfis somente leitura, aprovação humana e logs dos resultados por chamada; não devolver segredos, custo/fornecedor ou NCM.
- [ ] Comparar pelo menos 30 tarefas reais/sintéticas do piloto executadas pela API MCP padrão **versus** Code Mode: tokens enviados ao modelo, chamadas LLM, chamadas ao Bling, duração, sucesso, erros e segurança.
- [ ] Definir critérios quantitativos antes do teste (sugerido: redução mediana de pelo menos 20% de tokens de ferramentas, sem piora de confiabilidade nem aumento de chamadas à API Bling).
- [ ] Validar custo/limites do runtime e compatibilidade com o cliente ChatGPT antes de publicar.

## Decisão

**Extrair o padrão, não copiar a propaganda.** O Code Mode pode ser vantajoso para processos complexos da taxonomia e cadastro, mas não corrige as falhas 429/502 do provedor, não substitui segurança/ERP, não homologa uma aplicação técnica e não torna o MCP obsoleto. O piloto deverá ser componente isolado e reversível, preservando o gateway atual.
