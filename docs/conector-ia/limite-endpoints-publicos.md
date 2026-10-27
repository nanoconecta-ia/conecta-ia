# Limite de requisições nos endpoints públicos

**Estado:** código e testes no repositório. **Não implantado** — `loja-publica` e `vitrine-assistente` em produção só mudam com deploy autorizado.

## Por quê
`loja-publica` faz ~9 consultas por chamada (algumas leem até 5.000 linhas) e `vitrine-assistente` faz 4, ambas sem autenticação e com a chave de serviço no servidor. Sem limite, um raspador consome banco e cota. `vitrine-assistente` não usa LLM (custo de token zero).

## O que faz (`_shared/limite/publico.ts`)
Roda **antes de qualquer consulta ao banco**, usando a RPC que já existe (`public.limite_chamada`); **sem migração**.

| Camada | loja-publica | vitrine-assistente |
|---|---|---|
| Rajada por IP | 60 / min | 20 / min |
| Sustentado por IP | 600 / h | 120 / h |
| Teto por loja (todos os IPs) | 1.200 / min | 600 / min |
| Corpo máximo | 4 KB | 2 KB |

- Estourou: `429` + `Retry-After`, corpo genérico (não revela limites). Corpo grande: `413`.
- IP: `cf-connecting-ip` → `x-real-ip` → 1º do `x-forwarded-for`; valor inválido/ausente cai num balde próprio com **metade** do limite.
- O IP **nunca é guardado cru**: vira HMAC-SHA256 truncado. Segredo: `LIMITE_PEPPER` se existir; senão deriva do segredo de serviço já presente no runtime (não cria segredo novo, não é logado nem devolvido).
- Se a RPC falhar, a vitrine **continua** com um teto local por instância (30/min e 10/min) e registra `limite-publico limitador_indisponivel`.
- Contrato de sucesso e CORS inalterados; corpo JSON inválido continua virando `{}` (404 da loja).

## Limites honestos / pendências
1. **Cabeçalho do IP não confirmado** na borda do Supabase. Se o cliente puder forjar `x-forwarded-for`, o limite por IP é contornável; o teto **por loja** é a rede de proteção (testado), mas um ataque distribuído pode esgotar o teto de uma loja e atrapalhar clientes legítimos dela. Validar em ambiente de teste antes de confiar.
2. **`private.limite_chamadas` nunca é limpa** e passa a receber linhas por IP. Precisa de rotina de limpeza (migração em PR separado, com desenho aprovado). Antes disso, medir o tamanho atual com a consulta de leitura da proposta (não executada).
3. Cada chamada faz 3 gravações pequenas na RPC; é mais barato que as ~9 leituras que protege, mas não é zero.
4. Valores iniciais são estimativas; ajustar com dados reais.

## Teste e rollback
`node --experimental-strip-types --test supabase/functions/_shared/limite/publico.test.ts` (13 testes). Rollback: reimplantar a versão anterior das duas funções.
