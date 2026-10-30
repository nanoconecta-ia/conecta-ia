# Code Mode ↔ Policy Engine: contrato de integração e homologação

> Estado (30/10/2026): código de **ponte servidor-local + testes**, sem endpoint ou conexão Cloudflare→Supabase/ERP. Nenhuma publicação, alteração de tabela ou escrita no Bling.

## O que foi implementado

`supabase/functions/_shared/conector/codemode_bridge.ts` prepara a fronteira de segurança no host Conecta.IA. A sandbox Code Mode **não importa** esse módulo, não recebe `ContextoDespacho`, não recebe token MCP, não acessa Supabase, Bling ou `fetch()` arbitrário. O host oferece apenas duas operações de leitura (mínimo viável):

- `catalogo_resumo` → `conecta.catalogo.resumo`
- `catalogo_listar` → `conecta.catalogo.listar`

Para **cada** operação: (1) limite de chamadas e prazo de execução; (2) valida identidade fixa da loja e usuário; (3) chama callback do servidor que **revalida a chave MCP no banco**, inclusive revogação e escopo; (4) restringe o contexto a `origem=gateway_mcp`, `escopos=['leitura']` e `mcpChaveId` confirmado; (5) encaminha a `despachar()` para policy, esquema, handler e auditoria; (6) exige `ok=true`, `decisao=permitida`, nenhuma falha de auditoria; (7) reduz o resultado a uma allowlist de campos públicos.

**Nunca** retornar o objeto original da ferramenta ao sandbox: os handlers existentes de catálogo podem conter preço/estoque, e o Bling pode carregar dados de fornecedores ou fiscais. A ponte publica somente `sku`, `nome`, contagens auditadas e marca de não homologação técnica. A saída não contém custo, fornecedor, NCM, CFOP, preço, estoque ou chaves.

A ponte não expõe nenhum id de ferramenta arbitrário: tentativas de chamar `bling.produtos.alterar`, `conecta.proposta.criar` ou `catalogo_ver` são negadas, mesmo que o agente tente diretamente. A ausência de `propor` no escopo da sandbox é deliberada: **criação de propostas permanece na API normal, depois de aprovação e contexto humano**.

## Diagrama do futuro fluxo

```text
ChatGPT / NanoIA / outro modelo
                |
     MCP Code Mode (sandbox, sem rede)
                |
         RPC host autenticado
                |
     revalidar chave MCP por operação
                |
  criarAdaptadorCodeModeLeitura(ctx)
                |
  despachar() -> Policy Engine -> esquema
             -> handler -> auditoria
                |
      espelho da loja RLS/tenant
                |
       resposta pública mínima
```

## Decisões e limites de segurança

- **Tenant:** identidade obtida do token MCP (não de parâmetros da IA). O contexto servidor-local deve vir do gateway autorizado e só para a mesma loja.
- **Revogação:** em cada chamada, reconsultar `mcp_chave_validar` pelo hash, com verificação de expiração e revogação; não cachear permissões entre operações. Uma revogação **durante** uma chamada em andamento não a cancela magicamente: o mecanismo futuro deve suportar cancelamento/reaplicação do resultado.
- **Auditoria:** `despachar()` registra cada chamada. Se não confirmar auditoria, o resultado é descartado e a execução falha fechada. A aplicação não deve repetir requisições com efeito automaticamente.
- **Budget:** no máximo 12 chamadas internas por execução, prazo total até 12 s e máximo 4 KiB por parâmetros; esses limites complementam, mas não substituem, rate limit por usuário/loja e circuit-breakers.
- **Sem cache de credenciais:** manter tokens no host, nunca em mensagens de retorno ou na sandbox.
- **Privacidade:** não transmitir custos, fornecedores, NCM/CFOP, números fiscais ou credenciais a LLM gratuito. Histórico/estado operacional requer opt-in independente.
- **Tratamento de erros:** devolver códigos genéricos; não expor detalhe interno de RPC, queries ou erro do Postgres.

## O que NÃO foi implementado (bloqueia produção)

1. Transporte RPC autenticado de um Worker Code Mode hospedado para o host Conecta.IA e validação de origem/mTLS/token de serviço (sem túnel genérico).
2. Proteção real de tempo de processamento de handlers/timeout e cancelamento em cenários de rede degradada.
3. Homologação de Worker Loader hospedado com destino de rede controlado para validar bloqueio de egress, criptografia, isolamento e tentativas adversariais.
4. Teste de revogação real de duas chaves e duas lojas em banco descartável integrado ao Worker; testes de unidade da ponte não substituem isso.
5. Comparação com modelos reais: tokens, latência p50/p95, 429/502, throughput e custos (não extrapolar benchmark de bytes simulados).
6. Política de publicação e reversão, observabilidade de acesso, quotas comerciais e validação de conexão no ChatGPT elegível.

## Matriz automatizada

`codemode_bridge.test.ts` testa: duas operações estritamente permitidas; negação de escrita/propostas/nome desconhecido; saída com allowlist; revalidação a cada operação; chave revogada, trocada, escopo retirado e loja incompatível; limite de 12; argumentos excessivos; falha de auditoria; prazo; execução através do `despachar` **real** com política/esquema/auditoria em mocks. O smoke Code Mode anterior em Miniflare local mantém isolamento por duas credenciais fictícias, limites e egress conforme configuração.

## Sequência de liberação

**Etapa A (esta branch):** código + CI e revisão da fronteira; sem publicar.

**Etapa B:** ambiente descartável com nenhuma credencial real, provar rede e transporte RPC, simular revogação e falhas de backend.

**Etapa C:** habilitar somente consultas ao catálogo real, com chave de leitura por loja, RLS e audit trail completo, e observar falhas.

**Etapa D:** comparar com MCP tradicional. Só expandir Code Mode se houver ganho líquido e segurança equivalente, sem novos privilégios.

**Etapa E (posterior):** cadastro/propostas sempre versionadas, com fontes e aprovação explícita; nenhuma escrita no Bling por código gerado.
