# Experimento comparativo: sequencial × multiagente (20 produtos de teste, 2026-10-19)

**Pergunta:** a arquitetura multiagente traz benefício REAL sobre o processamento sequencial? Só se amplia a arquitetura se o teste demonstrar.
**Como reproduzir:** `node --experimental-strip-types scripts/experimento-multiagente.ts saida.json --md` · testes: `supabase/functions/_shared/multiagente/experimento.test.ts`.

## 1. O que foi comparado
Os mesmos 20 produtos, as mesmas fontes simuladas, o mesmo gabarito.
| Braço | O que é |
|---|---|
| **S0** | Pipeline sequencial atual (PR #40): passo a passo, fontes em série, **sem** Taxonomista, **sem** detecção de duplicidade, **sem** avaliação de compatibilidade, **sem** Auditor, sem orçamento. |
| **S1** | As **seis capacidades em série**, sem planejamento: todas as tarefas sempre, uma fonte por vez, um item por vez. *Controle que isola o efeito do paralelismo e do planejamento.* |
| **M** | As seis capacidades + **planejamento mínimo** + pesquisas **em paralelo** (4) + itens em paralelo (3) + **orçamento** (US$ 1). |
| **M com orçamento apertado** | M com US$ 0,05 para os 20 produtos. |

Nenhum braço usa modelo de linguagem: a classificação foi resolvida por regras em todos os casos em que a árvore tem destino (tokens = 0).

## 2. O conjunto de teste (gabarito definido pela regra de negócio, não pelo sistema)
8 produtos limpos ou com fonte oficial consistente · 2 divergências de início de período (2013 × 2014, 2012 × 2013) · 1 fonte que afirma motor que o cadastro exclui (NÃO SE APLICA) · 1 exclusão benigna · 2 duplicidades (SKU com formato diferente; mesmo GTIN) · 1 OEM conflitante · 1 peso conflitante (2,4 kg × 87 g) · 2 páginas com instrução maliciosa (uma só com dado coerente, outra com dado conflitante) · 3 cadastros incompletos (sem GTIN/peso, sem descrição, GTIN inválido) · 1 texto com dois veículos · 1 peça sem categoria na árvore · 1 fonte fora do ar. **6 produtos exigem decisão do lojista.**

## 3. Resultados
| Métrica | S0 | S1 | M | M_orcamento_apertado |
|---|---:|---:|---:|---:|
| Identificação correta (OEM, marca, classe) | 20/20 | 20/20 | 20/20 | 9/9 |
| Duplicidades evitadas / esperadas | 0/2 | 2/2 | 2/2 | 0/0 |
| Duplicidades falsas (alarme indevido) | 0 | 0 | 0 | 0 |
| Taxonomia certa (inclui abster-se quando não há regra) | 2/20 | 20/20 | 20/20 | 9/9 |
| Taxonomia errada | 0 | 0 | 0 | 0 |
| Compatibilidades confirmadas corretas / esperadas | 0/8 | 8/8 | 8/8 | 3/4 |
| Falsas confirmações de compatibilidade | 0 | 0 | 0 | 0 |
| Produtos com algum erro / taxa | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Conflitos escalados ao lojista / esperados | 6/6 | 6/6 | 6/6 | 3/3 |
| Escalonamentos desnecessários | 0 | 0 | 0 | 0 |
| Intervenções humanas: resolver conflito + aprovar | 6 + 14 | 6 + 14 | 6 + 14 | 3 + 6 |
| Itens retidos na fila por orçamento | 0 | 0 | 0 | 11 |
| Pendências registradas por produto | 1.8 | 2.75 | 2.75 | 0.95 |
| Procedência completa (fonte, data, confiança, situação) | 100% | 100% | 100% | 100% |
| Aplicações com fonte oficial | 36% | 34% | 34% | 31% |
| Evidências externas por produto | 0.95 | 0.95 | 0.95 | 0.4 |
| Chamadas de API por produto | 3.00 | 3.00 | 2.85 | 1.10 |
| Custo por produto (USD, simulado) | 0.00700 | 0.00700 | 0.00665 | 0.00250 |
| Tempo por produto (ms, mediana de 3 execuções) | 262 | 262 | 42 | 18 |
| Pico de chamadas simultâneas às fontes | 1 | 1 | 9 | 9 |

*S0: 0 confirmações porque ele não avalia compatibilidade (limite do desenho, não "erro"). Na coluna de orçamento apertado, 11 itens ficaram retidos na fila e as razões usam só os 9 processados.*

## 4. Premissas (leia antes de concluir qualquer coisa)
- **Latência das fontes é simulada** (catálogo oficial 80 ms, fornecedor B2B 120 ms, base de GTIN 60 ms) e **o custo por chamada também** (US$ 0,002 / 0,004 / 0,001). O ganho de tempo mede **orquestração**, não o desempenho de fontes reais.
- **Máquina de estados em memória** nos braços (cópia das transições do banco) para o tempo não ser dominado pelo cliente `psql` do ambiente de teste. As regras reais estão testadas no banco (`pipeline_indexacao.sql`, 31 verificações).
- **Sem LLM** em nenhum braço. Se a classificação por modelo fosse usada nos 2 produtos sem regra (P17, P18), o gasto estimado seria ~1.360 tokens, e a árvore **não tem destino** para eles: seria gasto sem ganho.

## 5. O que o experimento mostrou
1. **O ganho de precisão vem das capacidades, não do padrão multiagente.** S1 e M têm resultados **idênticos** em precisão (testado). Em relação a S0: duplicidades evitadas 2/2 (S0: 0/2), taxonomia certa 20/20 (S0: 2/20, só as duas abstenções), compatibilidades confirmadas 8/8 (S0 não avalia).
2. **O multiagente acrescentou tempo e um pouco de custo evitado.** 42 ms × 262 ms por produto (≈ 6×) com 9 chamadas simultâneas, e 5% menos chamadas de API (o planejador pulou a pesquisa de um item sem OEM/GTIN). O ganho de tempo depende das latências simuladas; com fontes reais e limites de taxa ele será menor.
3. **Os três braços escalam os mesmos 6 conflitos** e nenhum deixa vazar a instrução maliciosa. Quem detecta conflito é a comparação de fontes, comum a todos.
4. **Orçamento apertado é seguro, mas caro em fila:** 0 erros e 0 falsas confirmações, porém **11 de 20 itens ficaram retidos**. Precisa de uma política (reservar orçamento por prioridade, avisar o lojista).
5. **Intervenção humana não diminuiu:** 6 resoluções de conflito + 14 aprovações nos três braços. A auditoria não substitui a aprovação.

## 6. Defeitos que o experimento encontrou e foram corrigidos (antes dos números finais)
| # | Defeito | Correção |
|---|---|---|
| D1 | OEM conflitante entre fontes e, mesmo assim, a aplicação saía **"confirmada"** (falsa confirmação no P11). | Qualquer conflito aberto impede "confirmada" até o lojista decidir. |
| D2 | O motor que o **próprio cadastro exclui** (NÃO SE APLICA) entrava no cadastro como aplicação vinda de uma fonte divergente (P07). | A aplicação é descartada do cadastro e registrada como pendência com a fonte. |
| D3 | Com orçamento esgotado, o item seguia para aprovação **sem a pesquisa**, e 3 conflitos deixaram de ser escalados. | A pesquisa necessária adiada mantém o item na fila; ele não avança sem evidência. |
Na primeira execução S1 e M tinham 2 produtos com erro (taxa 10%); depois das correções, 0.

## 7. Limitações (não tirar conclusões além disto)
- **Os produtos e o gabarito foram escritos por mim, e as correções D1–D3 foram feitas depois de ver o primeiro resultado no mesmo conjunto.** "0% de erro" é, portanto, otimista. Precisa de **um conjunto cego**: produtos reais do catálogo da Mobis com gabarito feito por uma pessoa, sem ajustar o sistema depois.
- 20 produtos é amostra pequena; 6 casos de conflito não dão intervalo de confiança.
- Fontes reais têm erros que não simulei (HTML quebrado, dados parciais, sinônimos, bloqueios).
- Custo de IA real, tokens e qualidade de redação não foram medidos (não há chave de IA ativa).

## 8. Decisão (critério: ampliar só com benefício demonstrado)
| Item | Decisão | Base |
|---|---|---|
| Capacidades determinísticas (Identificador, Taxonomista por regras, Compatibilidade, Enriquecedor, Auditor) | **Adotar** | Benefício medido contra S0, custo zero em tokens |
| Pesquisas em paralelo com limite de taxa e orçamento | **Adotar** | Tempo ≈ 6× menor no teste, mesma precisão, sem custo extra |
| Planejamento mínimo de tarefas | **Manter** (baixo custo) | Economia pequena (5%) neste conjunto; cresce com catálogos que tenham mais itens sem identificador |
| **Agentes com LLM para classificação, leitura de documentos e redação** | **Não ampliar agora** | Nenhum ganho demonstrado; as regras resolveram tudo que a árvore comporta. Reavaliar quando houver conjunto cego real em que as regras falhem |
| Dependência externa de orquestração (Ruflo ou similar) | **Não adotar** | Ver `multiagente-estudo.md` |
| Política de orçamento por prioridade | **Construir** | 55% dos itens retidos com orçamento apertado |
