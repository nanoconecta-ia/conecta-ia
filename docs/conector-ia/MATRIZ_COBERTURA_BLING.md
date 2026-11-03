# Matriz de cobertura: Bling ↔ Conecta.IA/Nano

Atende ao pedido da issue #278. Gerada a partir do código (`bling_ferramentas.ts`, `registro.ts`) e da documentação oficial do Bling lida em 2026-11-03.
**Só documentação. Nada aqui autoriza merge, deploy, escrita no Bling nem mudança de credenciais.**
Legenda de estado: **ativa** = funciona hoje; **planejada** = registrada, sem handler ativo; **proposta** = prepara a proposta, nada é gravado; **desligada** = escrita real bloqueada.
`conferido` = caminho verificado no OpenAPI oficial (regra zero alucinação); as demais linhas precisam ser conferidas em developer.bling.com.br/referencia antes de uso.

## Leitura (risco LOW)
| Capacidade | Endpoint Bling v3 | Ferramenta do catálogo | Ferramenta do Nano | Estado | Webhook | Observação |
|---|---|---|---|---|---|---|
| Listar produtos (ativos, inativos, excluídos) | `GET /produtos` (conferido) | `bling.produtos.listar` | espelho + `bling_consultar_produto` | **ativa** | `product.*` (não implementado ainda; PR #277 em desenho) | Varredura de 15 min mantém o espelho |
| Detalhe do produto | `GET /produtos/{id}` (conferido) | `bling.produtos.obter` | `bling_consultar_produto` | **ativa** | `product.updated` | Custo e fornecedor nunca copiados |
| Categorias | `GET /categorias/produtos` | `bling.categorias.listar` | `bling_categorias` | **ativa** | sem evento | não conferido |
| Saldo de estoque | `GET /estoques/saldos` | `bling.estoque.saldos` | `bling.estoque.consultar` | **planejada** | `stock.*`, `virtual_stock` | **Lacuna:** o Nano não responde estoque ao vivo do Bling, só o do espelho |
| Preço atual | via `GET /produtos/{id}` | `bling.produtos.obter` | `bling.precos.consultar` | **planejada** | `product.updated` | Sem preço de compra/custo |
| Contatos | `GET /contatos` | `bling.contatos.listar` | — | catálogo, sem ferramenta do Nano | — | Lacuna |
| Pedidos de venda | `GET /pedidos/vendas` | `bling.pedidos_venda.listar` | — | catálogo, sem ferramenta do Nano | `order.*` | **Lacuna** para relatório de vendas e para a venda do site |
| NF-e | `GET /nfe`, `/nfe/{id}` | `bling.nfe.listar/obter` | — | catálogo, sem ferramenta do Nano | `invoice.*` | Só consulta (decisão de 17/10); fiscal nunca vai a LLM gratuito |
| Dados da empresa | `GET /empresas/me/dados-basicos` | `bling.empresa.dados` | — | catálogo | — | Dá o `companyId` do webhook; hoje **não é gravado** em `bling_company_id` |
| Dashboards "Meu Negócio" | sem API pública garantida | — | — | — | — | Não presumir endpoint; só tela do Bling |

## Escrita (todas desligadas; exigem aprovação humana, `idempotency_key`, Policy Engine e auditoria)
| Capacidade | Endpoint | Ferramenta de execução | Proposta no Nano | Risco | Estado |
|---|---|---|---|---|---|
| Cadastrar produto novo | `POST /produtos` | `bling.produtos.criar` | `bling_propor_cadastro_produto` (mergeado) | MEDIUM | execução **desligada** |
| Reativar produto excluído | `PATCH /produtos/{id}` | `bling.produtos.alterar` | `bling_propor_reativar_produto` | MEDIUM | execução **desligada** |
| Ajustar nome, marca, GTIN, descrição, peso, medidas | `PATCH /produtos/{id}` | `bling.produtos.alterar` | `bling_propor_ajuste_produto` | MEDIUM | execução **desligada** |
| Trocar categoria em lote | `PATCH /produtos/{id}` | `bling.produtos.alterar` | `bling_propor_trocar_categoria` | MEDIUM | execução **desligada** |
| Alterar preço de venda | `PATCH /produtos/{id}` | `bling.produtos.alterar` | `bling.produtos.preparar_alteracao_preco` (registro) | MEDIUM | execução **desligada** |
| Criar categoria | `POST /categorias/produtos` | `bling.categorias.criar` | `bling_propor_categoria` | MEDIUM | execução **desligada** |
| Contatos | `POST /contatos`, `PUT /contatos/{id}` | `bling.contatos.criar/alterar` | — | MEDIUM | desligada, sem proposta |
| Lançar estoque | `POST /estoques` | `bling.estoque.lancar` | — | HIGH | desligada, sem proposta |
| Criar pedido de venda | `POST /pedidos/vendas` | `bling.pedidos_venda.criar` | — | HIGH | desligada, sem proposta |

## Webhooks do Bling e o que fazer com cada um
| Evento | Tratar? | Motivo |
|---|---|---|
| `product.created/updated/deleted` | Sim (núcleo pronto, PR #277) | Mantém o espelho em segundos |
| `stock.*`, `virtual_stock.updated` | Sim, buscando o saldo atual | Baixa do balcão (PDV) e de outros canais |
| `order.*` | Fase 2 | Relatórios e venda do site |
| `invoice.*`, `consumer_invoice.*` | Não por ora | Fiscal fica fora do Nano |
| `product_supplier.*` | **Não** | Traz custo e fornecedor, proibidos no sistema do lojista |

## O que realmente impede o Nano de trabalhar "nativo" no Bling hoje
1. **A execução real da escrita está desligada.** Ela só liga com: segredo `BLING_ESCRITA_REAL=1`, campos liberados em `CAMPOS_ESCRITA_LIBERADOS`, teste do caminho com mock, aprovação humana da versão exata e auditoria. Isso é de propósito e só você pode autorizar.
2. **Faltam ferramentas de leitura:** estoque ao vivo, preço e pedidos de venda.
3. **O gratuito só consulta** (por desenho, #274 mergeado; migração e deploys ainda pendentes).
4. **O espelho demora até 15 minutos** sem o webhook.
5. **Endpoints não conferidos** (categorias, estoque saldos, pedidos, contatos, NF-e) precisam ser conferidos no OpenAPI antes de ligar.

## Testes sugeridos em homologação (sem escrita)
- Leitura: `CI000016` (Bling ID `16721657772`, bomba d'água HR 8V; não confundir com a bomba de óleo D4CB 16V).
- Webhook: payloads simulados da documentação (assinatura, duplicado, fora de ordem) e, depois de cadastrado, evento real de `product.updated` numa peça de teste.
- Balcão: baixa pelo PDV e conferir o espelho em segundos.
- Escrita: somente com mock até autorização específica.
