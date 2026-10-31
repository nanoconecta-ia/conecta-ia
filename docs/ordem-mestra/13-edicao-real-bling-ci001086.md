# Edição real no Bling pelo Conecta.IA — caso CI001086 (marca)

Objetivo do dono (2026-10-31): provar que o Conecta.IA edita o cadastro no Bling **pelo caminho do sistema** (proposta → aprovação humana → Policy Engine → escrita → leitura de confirmação → auditoria), e não por uma ferramenta externa.

## 1. O que já existe (conferido no código desta branch)
| Peça | Onde | Estado |
|---|---|---|
| Proposta de alteração (lê o Bling na hora, monta antes/depois) | `bling.produtos.preparar_atualizacao` em `conector/registro.ts` | ativa |
| Execução `bling.produtos.alterar` (PATCH /produtos/{id}) | `conector/registro.ts` | `estado: "ativa"` |
| Campos liberados pelo dono em 2026-10-29 | `conector/bling_campos.ts` (`CAMPOS_ESCRITA_LIBERADOS`) | inclui `marca`; preço, custo, estoque, fornecedor, SKU e fiscal NUNCA |
| Porta de escrita real | `conector/porta_bling.ts` (`BlingEscritaReal`) | só escreve com o segredo `BLING_ESCRITA_REAL=1` |
| Executor: aprovação, `idempotency_key`, leitura de confirmação, "desconhecida" em timeout, reconciliação | `conector/executor.ts` | testado só com Bling simulado |
| Edge `conector-aprovacoes` | Supabase `dsfzhsrudriqkumtlqwj` | **ACTIVE v2** em 2026-10-31 (o comentário da primeira linha de `conector-aprovacoes/index.ts` diz "NÃO IMPLANTADA": está desatualizado) |

## 2. O que este PR acrescenta
`conector/caso_ci001086.test.ts` (6 testes, sem rede e sem banco): com o Bling simulado semeado só com campos públicos lidos do Bling real em 2026-10-31, prova que
1. trocar `" MARCA: TRIM GO"` por `"TRIM GO"` envia **um** campo e deixa nome, preço, categoria, código, situação e peso intactos;
2. o desfazer restaura exatamente o valor anterior (`antes`);
3. preço, custo, fornecedor, estoque, NCM ou SKU junto com a marca recusam o item inteiro, sem enviar nada;
4. marca vazia é recusada;
5. timeout depois de gravar vira "desconhecida" e a reconciliação prova "gravado" sem repetir a escrita;
6. leitura de confirmação divergente nunca vira sucesso.

Rodar: `node --test supabase/functions/_shared/conector/caso_ci001086.test.ts`.

**Evidência: MOCK.** Nada disto prova que o Bling real aceita o PATCH com o escopo atual do app.

## 3. O que falta para a execução REAL (nada disto é feito por este PR)
| # | Item | Quem | Estado |
|---|---|---|---|
| 1 | Segredo `BLING_ESCRITA_REAL=1` no Supabase | dono | **desconhecido**: segredos não são legíveis daqui; não foi ligado por mim |
| 2 | Escopo do app do Bling permite alterar produtos | dono | a confirmar (o PATCH real é o teste) |
| 3 | Tela onde o dono aprova a proposta (`/aprovacoes` ou `/central`; a Central está oculta do menu) e se o painel está publicado | dono/eu | a confirmar antes de usar |
| 4 | Criar a proposta: `bling.produtos.preparar_atualizacao` com `sku: CI001086`, `campos: { marca: "TRIM GO" }` e uma fonte | assistente | só depois do 1 a 3 |
| 5 | Aprovar a versão exata, executar, conferir no Bling e na auditoria | dono + eu | — |

Desfazer: nova proposta com `marca: " MARCA: TRIM GO"` (valor anterior guardado em `antes`), ou restaurar à mão no Bling.

## 4. Riscos
- A escrita real nunca foi exercitada; o primeiro PATCH pode ser recusado (escopo) ou devolver 4xx: o executor registra "falhou" sem repetir.
- O nome do produto também traz o texto "MARCA: TRIM GO" (limite do Bling: 120 caracteres). Esta edição NÃO altera o nome; alterar nome é outra proposta, aprovada à parte.
- Taxonomia/categoria Bling (id 14676549): não alterada; a listagem de categorias deu timeout em 2026-10-31.
