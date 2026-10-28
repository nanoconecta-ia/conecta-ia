# Limite de requisições nos endpoints públicos

**Estado:** código e testes no repositório. **Não implantado** — `loja-publica` e `vitrine-assistente` em produção só mudam com deploy autorizado.

## Por quê
`loja-publica` faz ~9 consultas por chamada (algumas leem até 5.000 linhas) e `vitrine-assistente` faz 4, ambas sem autenticação e com a chave de serviço no servidor. Sem limite, um raspador consome banco e cota. `vitrine-assistente` não usa LLM (custo de token zero).

## O que faz (`_shared/limite/publico.ts`)
Roda **antes de qualquer consulta ao banco**, usando a RPC que já existe (`public.limite_chamada`); **sem migração**.

| Camada | loja-publica | vitrine-assistente |
|---|---|---|
| Teto por loja (todos os IPs), checado **primeiro** | 1.200 / min | 600 / min |
| Rajada por IP | 60 / min | 20 / min |
| Sustentado por IP | 600 / h | 120 / h |
| Sem IP confiável (por loja) | 300 / min | 100 / min |
| Baldes de IP por janela | 2.048 | 2.048 |
| Corpo máximo | 4 KB | 2 KB |

- Estourou: `429` + `Retry-After`, corpo genérico (não revela limites). Corpo grande: `413`.
- **Ordem:** teto da loja primeiro. Pedido negado ali grava **1 linha** (sempre a mesma da janela) e não toca nas chaves de IP.
- **Crescimento limitado:** o IP vira HMAC e cai em um de 2.048 baldes fixos; por janela e camada o número de linhas é limitado por construção, mesmo com IP girando. Pedido aceito grava 3 linhas (loja + 2 de IP); sem IP, 2.
- **IP confiável:** só o cabeçalho que a borda define, padrão `cf-connecting-ip` (configurável por `LIMITE_CABECALHO_IP`). `x-forwarded-for` e `x-real-ip` **não** são usados (o 1º item do XFF é forjável pelo cliente).
- **Sem IP confiável:** não existe balde global; vale o limite "sem-ip" próprio da loja, mais apertado que o geral.
- O IP **nunca é guardado cru**. Segredo do HMAC: `LIMITE_PEPPER` se existir; senão deriva do segredo de serviço já presente no runtime (sem segredo novo, nunca logado nem devolvido).
- Se a RPC falhar, a vitrine **continua** com um teto local por instância (30/min e 10/min; limpeza das entradas vencidas no máximo a cada 30 s e só acima de 5 mil entradas) e registra `limite-publico limitador_indisponivel`.
- **Cliente:** `Loja.tsx` e `ProdutoPublico.tsx` tratam 429/413/5xx com mensagem e "Tentar de novo" (antes: tela em branco). Teste visual `scripts/tests/loja-limite-visual.mjs`.
- Contrato de sucesso e CORS inalterados; corpo JSON inválido continua virando `{}` (404 da loja).

## Limites honestos / pendências
1. **Cabeçalho do IP na borda do Supabase não confirmado.** Se `cf-connecting-ip` não chegar, todos caem no limite "sem-ip" da loja (a vitrine segue no ar, mas o limite por IP some). Confirmar com função de eco temporária (deploy sob autorização) antes de ativar.
2. **Pré-requisito de deploy:** `private.limite_chamadas` não tem limpeza. Os baldes limitam o crescimento, mas a limpeza (migração em PR separado, desenho aprovado antes) deve vir **antes** do deploy.
3. Cada pedido aceito faz até 3 chamadas à RPC; mais barato que as ~9 leituras que protege, mas não é zero.
4. Sob ataque distribuído o teto da loja pode ser esgotado e clientes legítimos dela recebem 429 (outras lojas não são afetadas).
5. Valores iniciais são estimativas; calibrar com dados reais (modo apenas-registro antes de bloquear).

## Teste e rollback
`node --experimental-strip-types --test supabase/functions/_shared/limite/publico.test.ts` (19 testes) e `node scripts/tests/loja-limite-visual.mjs`. Rollback: reimplantar a versão anterior das duas funções.
