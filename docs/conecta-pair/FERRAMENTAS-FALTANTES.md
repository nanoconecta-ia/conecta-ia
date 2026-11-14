# Ferramentas do agente pareado: o que faltou no uso real (14/11/2026)

Levantamento feito com um agente pareado pelo QR na loja Mobis (sessão real, escopos `produtos:ler` e `bling:consultar`), em cima dos produtos CI002916 e CI003000.

## O que travou e por quê

| Situação real | O que o agente tinha | O que faltou |
|---|---|---|
| Marca e descrição gravadas no Bling não apareciam no Conecta | `bling_consultar_produto` (só SKU, nome, preço, estoque) e `get_product` (espelho) | Ver **por que** o espelho estava velho (sincronização sem concluir há horas) e pedir a releitura do SKU |
| Erros "SKU repetido entre IDs do Bling" a cada varredura | nada | Lista dos SKUs com mais de um cadastro no ERP |
| Produto não aparece na loja | `get_product` dizia "falta imagem_principal" | Ver as 5 fotos e o estado de cada uma (pendente, direitos não confirmados) |
| Nano dizia "falta descrição" com a descrição longa preenchida | `get_product` olhava só `descricao_curta` | Considerar também a descrição longa do ERP |

## Entregue neste PR (só leitura, escopo `produtos:ler`, sem migração)

- `conecta.get_sync_status`: conexão, última varredura completa, último erro, erros da última hora por tipo, SKUs repetidos no ERP (sem ID interno), quantos produtos ativos têm espelho com mais de 24 h.
- `conecta.get_product_images`: imagens do SKU com aprovada, principal, origem, direitos confirmados e se aparece na loja.
- `conecta.get_product`: "descrição" passa a contar a curta **ou** a longa; devolve `tem_descricao_longa`.

## Proposto, depende de decisão (não implementado)

**`conecta.refresh_product_from_erp`**: relê um SKU no Bling e atualiza **só o espelho** (o mesmo que o botão "Reler do Bling"). Não grava no Bling. Mesmo assim é escrita no Conecta, então:

1. Precisa de um **escopo novo** (`espelho:atualizar`), porque quem aprovou "consultar Bling (somente leitura)" não consentiu que o agente altere o espelho. Exige migração da lista `pair_escopos_validos` e do rótulo no QR.
2. Limite próprio (ex.: 10 por hora por sessão) e auditoria com SKU, antes e depois.
3. Reaproveitar `sincronizar(..., forcarSkus)` só com o SKU pedido, sem varrer o catálogo.

Fora de escopo de propósito: aprovar imagem, confirmar direitos, publicar produto e gravar no Bling. São decisões do lojista.
