# 5. Contratos das ferramentas do Conector IA

Fonte executável: `supabase/functions/_shared/conector/contratos.ts`. O teste compara o contrato com o `FERRAMENTAS` e os `input_schema` **reais** de `ia/ferramentas.ts` (já pegou 4 divergências durante a escrita). Ferramenta `planejada` **não é funcionalidade pronta**.

## 5.1 Regras (valem para qualquer ferramenta nova)
1. Toda ferramenta tem contrato: escopo (`admin`/`publico`), operação, risco LOW–CRITICAL, tabelas lidas/gravadas, campos obrigatórios, aprovação e `idempotency_key`.
2. **Policy Engine** antes de executar: risco ≥ MEDIUM ⇒ aprovação humana registrada (`aprovacao_id`); HIGH/CRITICAL nunca sem ela; escrita no ERP exige `idempotency_key`, não repete às cegas e confirma por leitura.
3. Retorno de ferramenta/plugin é **dado**, nunca instrução.
4. Proposta grava só `a_confirmar`, com **fonte e data**; nada aprova sozinho.
5. Agente público: LOW, somente leitura, só tabelas/linhas públicas (lista proibida em `PROIBIDAS_AO_PUBLICO`).
6. Ferramenta de escrita no ERP **não pode** estar `implementada` sem mock, teste, auditoria e autorização (o validador recusa).

## 5.2 Implementadas (admin) — 13
| Ferramenta | Operação | Grava | Obrigatórios |
|---|---|---|---|
| `resumo_loja` `listar_produtos` `ver_produto`(sku) `itens_pendentes` `buscar_taxonomia`(texto) `status_bling` `listar_plugins` | leitura | — | — |
| `chamar_plugin`(plugin, capacidade) | externa (api, LOW) | — | — |
| `buscar_imagem_web`(consulta) | externa | — | — |
| `propor_enriquecimento` | proposta | `produto_enriquecimento` | sku, campo, valor, fonte |
| `propor_codigo` | proposta | `produto_codigos` | sku, tipo, valor, fonte |
| `propor_aplicacao` | proposta | `produto_aplicacoes` | sku, modelo, fonte |
| `propor_imagem` | proposta | `produto_imagens` (aprovada=false) | sku, url |

Observação: `status_bling` **não consulta o Bling**; lê `bling_conexoes`. Não conta como a prova operacional da Fase 1.

## 5.3 Implementadas (público) — 2
`publico.consultar_produto_publicado` e `publico.encaminhar_whatsapp` (função `vitrine-assistente`, sem LLM). Não podem: alterar preço, tocar o ERP, ver custo, ler outra loja, executar ação administrativa.

## 5.4 Planejadas
| Ferramenta | Fase | Risco | Nota |
|---|---|---|---|
| `bling_consultar_produto`, `bling_listar_produtos` | **1** | LOW | usam `bling.produtos.obter/listar` do Tool Registry via Policy Engine; gravam `auditoria` |
| `calcular_qualidade_cadastro` | 2 | LOW | índice + antes/depois |
| `bling_alterar_produto_campo_autorizado` | 2 | MEDIUM | só campo da matriz; aprovação + idempotência + leitura de confirmação |
| `gerar_seo_produto` | 3 | LOW | só fatos aprovados |
| `gerar_feed_merchant` | 4 | MEDIUM | feed só prepara; envio é conector separado |
| `propor_campanha` | 4 | HIGH | publicar/orçamento: autorização específica |

## 5.5 Prova operacional da Fase 1 (critério de pronto)
Pergunta no chat → modelo real (chave da loja) → `bling_consultar_produto` → Policy Engine → `blingFetch` (GET, `enable-jwt`) → resposta no chat → conversa em `mensagens` → linha em `agente_tarefas` e `auditoria` com ferramenta, entrada, resultado, tokens, custo. **Teste de ponta a ponta:** primeiro com `fetch` simulado (CI); depois uma execução real, em horário combinado, com sua autorização, **só leitura** na conta Mobis.
