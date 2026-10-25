# Motor de indexação — modelo de dados proposto (Fase 1)

Nada aqui foi aplicado em produção. As migrações estão na branch e são testadas num Postgres local descartável.

## Reaproveitado (já existe em produção) — não foi recriado
| Conceito do briefing | Onde já está |
|---|---|
| Índices por SKU, GTIN | `produtos(loja_id, sku)`, `gtin`, `gtin_tributario` |
| Índice por OEM / código de fabricante | `pecas_ref` (índice em `upper(btrim(codigo))`), `fabricantes_peca`, `fornecedores_oem` |
| Árvore de taxonomia | `taxonomia_nos` (49 nós) e a ponte `bling_categoria_taxonomia` |
| Grafo de relações | tabelas de relação: `relacoes_tecnicas`, `ref_cruzada` (sem fecho transitivo), `versao_motor`, `pecas_aplicacoes_tecnicas`, `produto_pecas_ref`. **Decisão: não introduzir banco de grafo.** As consultas são de 1–2 saltos e cada relação já exige fonte, status e verificação; PostgreSQL com tabelas de relação cobre isso com RLS por loja. Reavaliar só se surgir caminho com 4+ saltos. |
| Histórico versionado | `produto_revisoes`, `auditoria` (imutável) |

## Novo nesta branch (propostas de migração, em ordem)
| Migração | O que cria |
|---|---|
| `…0001` a `…0008` (PR #39) | estado do Gênesis, RPCs, chaves do gateway, imagens, **árvore de sistemas com ícone, documentação técnica, identidade oficial do veículo**, **busca por código OEM**, **ferramentas de verificação** |
| `20261019000009_pipeline_indexacao.sql` (este PR) | **máquina de estados**, **histórico imutável**, **conflitos entre fontes** e **fila com recuo** |

## Máquina de estados do pipeline (por produto e loja)
```
entrada → normalizado → identificado → pesquisado → comparado ─┬→ validado → enriquecido → aguardando_aprovação ─┬→ aprovado → sincronizando → sincronizado
                                                              └→ conflito ──(lojista)──→ comparado              └→ rejeitado
                                              qualquer passo: falhas repetidas → falhou ──(lojista)──→ entrada
```
Regras impostas **no banco** (não só no código):
- Transição só existe se estiver em `pipeline_transicoes`; pular etapa é recusado.
- **Aprovar, rejeitar, resolver conflito e reabrir são exclusivos do lojista da loja.** O agente e o editor são recusados.
- `validado` só sem conflito aberto; `enriquecido` e `sincronizado` exigem **evidências**; `sincronizando` exige **proposta**; `sincronizado` exige a **leitura de confirmação**.
- No máximo **um item ativo por SKU e loja** (impede cadastro duplicado em andamento) e criação **idempotente** por chave.
- Cada transição grava ator, se foi humano, motivo e evidências em `pipeline_historico` (**imutável**: nem `update` nem `delete`).
- Controle de versão otimista: alterar com versão desatualizada é recusado (concorrência).
- **Fila:** reserva com limite de **5 itens simultâneos por loja**, recuo exponencial (10 s · 2ⁿ, teto 1 h) e parada na 5ª falha.
- RLS: usuários logados só **leem** a própria loja; as funções só rodam no servidor (`service_role`).

## Entidades do pipeline
- `pipeline_itens` (estado, versão, entrada, resultado, tentativas, proxima_tentativa, reservado_ate, proposta_id, idempotency_key).
- `pipeline_historico` · `pipeline_conflitos` (tipo: aplicação, OEM, GTIN, medidas, Bling × enriquecimento; lado A e B com fonte; decisão e quem decidiu) · `pipeline_transicoes`.

## Código (TypeScript, `supabase/functions/_shared/pipeline/`)
| Módulo | Função |
|---|---|
| `extracao.ts` | normaliza e extrai OEM, GTIN, anos, motor, emissão, veículos e **NÃO SE APLICA** (separa exclusão de aplicação). Conferido pelos **mesmos casos** da ferramenta Python (`golden_extracao.json`). |
| `saneamento.ts` | trata conteúdo externo como **dado**: remove marcação oculta e linhas com cara de comando; sinaliza. |
| `comparacao.ts` | detecta conflitos entre fontes (OEM, GTIN, peso, motor, período, **início do período**). Não resolve; só sugere precedência. |
| `periodos.ts` | confere anos contra eventos de importação/comercialização **no Brasil**. |
| `conectores.ts` | conectores de pesquisa modulares (API › navegação só se autorizada) com tempo limite; nunca contorna autenticação. |
| `cadastro.ts` | monta o cadastro enriquecido **só com o que tem fonte**; nome padronizado, descrição, SEO, medidas do Bling. |
| `pipeline.ts` | orquestrador (`executarPasso`) e worker (`processarFila`). |
