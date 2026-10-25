# Teste supervisionado: KIT DE EMBREAGEM 254MM (PLATÔ/DISCO/ROLAMENTO) · 833333 · VALEO

Data da leitura: **2026-10-25**. Responsável pela leitura: **Claude (manual, via conector Bling desta sessão, somente leitura)**. Isto **não** é prova de autonomia do Nano.ia (ver seção 1).
Nada foi gravado no Bling nem no Conecta. Nenhum produto foi criado, reativado, excluído ou fundido.

## 1. Runtime: o que o Nano.ia pode fazer hoje (lido do código e do banco)

| Pergunta | Resposta verificada |
|---|---|
| Existe ferramenta para **restaurar/reativar/excluir** produto no Bling? | **Não.** Não há ferramenta `restaurar`/`reativar`/`excluir` no registro, nem endpoint de situação na matriz de campos (`matriz_bling.ts`). |
| Ferramentas de escrita no Bling | `bling.produtos.criar`, `bling.produtos.alterar`, `bling.categorias.criar`, `bling.produtos.confirmar`: **todas `desligada`** (policy). |
| Ferramentas que gravam só na camada do Conecta | `conecta.enriquecimento.definir` e `conecta.publicacao.publicar` (**ativas** no registro, mas **sem backend implantado**). |
| Proposta (sem gravar) | `bling.produtos.preparar_atualizacao` (ativa no registro; só atua sobre produto **existente no espelho**). `preparar_cadastro` está `planejada`. |
| O que o agente **publicado** (função `assistente` v6) alcança | Uma só ferramenta, `bling_consultar_produto(sku)`, que lê `produtos` (espelho) **e falha com "Produto não encontrado nesta loja" se o SKU não estiver no espelho** (`_shared/assistente/bling_consultar.ts`, linha 33). |
| Os registros deste teste estão no espelho do Conecta? | **Não** (SELECT em produção: 0 linhas para os 6 IDs e SKUs 833333/5112/4891/833333/1/89096). O sync espelha só produtos ativos. |
| Backend do Nano.ia completo (`conector-chat`) | **Não implantado** (0 tabelas `agente_*`; funções ausentes). |

**Consequência:** o teste **não pôde ser executado pelo Nano.ia**: (a) o agente publicado não enxerga produto excluído; (b) o Nano completo não está no ar; (c) não existe ferramenta de reativação nem de escrita ligada. Registro isto como **bloqueio real**; não há sucesso simulado.

## 2. Auditoria dos registros com o GTIN 3276428333335 (leitura Bling, todos `situacao = E` excluído)

O GTIN aparece em **8 registros**, não em 3. Dois deles (`89096`, "104108-2 KIT EMBREAGEM - EAT") são **outra peça** com o mesmo GTIN: **GTIN não é chave de identidade confiável aqui.**

| ID Bling | SKU | Nome | Marca | Fornecedor (cód.) | Compra / custo | Preço | Saldo (físico/virtual) | Fotos | Peso / dim. | Unid. | Observação |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **12753970402** | **5112** | 833333 KIT EMBREAGEM 254MM(PLATODISCOROLAM) | vazia | Real Moto (06276300718) | 1043,05 / 1043,05 | 1500 | **1 / 1** (dep. 1144593331) | 0 | 0 / 0x0x0 | KT | NCM 8708.93.00, CEST 01.075.00, origem 2, condição 1 |
| **8173252121** | **833333** | Kit Embreagem 254mm(...) Hyundai Hr/K2500 Euro 5 Original 833333 | VALIO (errada; o texto do cadastro diz VALEO) | Real Moto (**833333**) | 1453,52 / 1453,52 | 1950 | 0 / 0 | **3 internas** | 10,277 kg / 15x45x45 | KT | descrição: "2013-2021"; local P01; CEST vazio; origem 2; condição 1; frete grátis; 3 itens/caixa |
| **16622651374** | **833333** | (mesmo nome do anterior) | VALIO | **nenhum** | 0 / 0 | 1950 | 0 / 0 | 0 | 10,277 kg / 0x0x0 | UN | descrição curta com resíduo `&lt;`; **condição 0, origem 0**; sem CEST |
| 7538741982 | 4891 | KIT EMBREAGEM 254MM(...) HYUNDAI HR KIA BONGO EURO 5 ORIGINAL 833333 | VALIO | Real Moto (06276300718) | 808,73 / 1017,86 | 2200 | 0 / 0 | 0 | 10 kg / 45x45x12 | CJ | CEST 01.075.00; origem 2 |
| 16514593039 | 833333/1 | Kit Embreagem 254mm(...) Hyundai Hr/K2500 Euro 5 | n/c | n/c | n/c | n/c | 0 | n/c | n/c | n/c | só listagem |
| 16622651373 | 833333/1 | (idem) | n/c | n/c | n/c | n/c | 0 | n/c | n/c | n/c | só listagem |
| 16559870756 | 89096 | 104108-2 KIT EMBREAGEM - EAT | n/c | n/c | n/c | n/c | 0 | n/c | n/c | n/c | **outra peça**, mesmo GTIN |
| 16622651026 | 89096 | (idem) | n/c | n/c | n/c | n/c | 0 | n/c | n/c | n/c | **outra peça**, mesmo GTIN |

`n/c` = não consultado em detalhe (só listagem). Fornecedor: `listProductSuppliers` devolveu **0 vínculos** para 12753970402 e 8173252121 (o fornecedor consta só no campo embutido do produto).

**Histórico que não foi possível verificar:** pedidos de compra do fornecedor Real Moto (`idFornecedor 1169097084`) retornaram **0 pedidos**; o conector não filtra venda/NF por produto. Vendas, notas de entrada e movimentações de estoque **não foram comparados** (lacuna). O dono pode ver "Movimentação do produto" no Bling para os IDs 12753970402, 8173252121 e 16622651374.

Indícios (**inferência, não prova**): os IDs `16622651026`, `…373` e `…374` são consecutivos, o que sugere uma operação em lote que **copiou** `89096`, `833333/1` e `833333`; o `16622651374` seria cópia empobrecida do `8173252121` (condição/origem zeradas, sem fornecedor/fotos).

## 3. Escolha do canônico (para decisão do dono; **nenhuma ação executada**)

Critérios: identidade interna, vínculos operacionais, evidência de saldo, qualidade do cadastro, risco.
- **Proposta: `12753970402` (SKU interno 5112)** como registro canônico a ser reativado **somente se** o histórico de vendas/compras/NF confirmar. Motivos: é o **único com saldo físico (1)**; o SKU `5112` segue o padrão de **SKU interno** (como `4891`), e o `833333` é a **referência do fabricante**, que deve ficar em campo próprio (código do fabricante), nunca como SKU interno obrigatório; tem fornecedor e custo com o mesmo código de fornecedor do `4891`; mantém NCM/CEST/origem coerentes. Fraquezas: sem marca, fotos, peso.
- **`8173252121`**: melhor **fonte de conteúdo** (3 fotos internas, peso, dimensões, textos), mas com marca errada, SKU = referência do fabricante e aplicação legada; usar como **evidência a confirmar**, não fundir.
- **`16622651374`** e os demais: **não reativar** (cópias/duplicatas prováveis).

**Risco concreto ao reativar:** `833333` está em **dois** registros (8173252121 e 16622651374). Reativar ambos, ou usar `833333` como SKU, repetiria SKU ativo e **derrubaria o lote do `bling-sync` em produção** (índice único `(loja_id, sku)`), porque a correção de identidade (PR #63) **não está implantada**. Nunca reativar os dois.

Registro de auditoria da escolha (a ser gravado quando houver ferramenta ativa): `idempotency_key = cadastro:kit-embreagem-833333:bling-12753970402:v1` (chave interna, não o GTIN nem o código do fabricante).

## 4. Rascunho de cadastro, campo a campo (nada aplicado)

Legenda de status: **confirmado** (lido por mim no Bling) · **informado** (vem do pedido/fonte primária, **não verificado por mim**: o host do catálogo é bloqueado neste ambiente, 403) · **legado** (vem do cadastro antigo) · **a confirmar** · **vazio**.

| Campo | Valor anterior (12753970402) | Valor proposto | Evidência (fonte, data) | Status |
|---|---|---|---|---|
| SKU interno | 5112 | **5112 (manter)** | Bling, 2026-10-25 | confirmado |
| Referência do fabricante | (no nome) | 833333 | Bling (nome/obs. dos registros), 2026-10-25; catálogo (informado) | confirmado no Bling; catálogo informado |
| GTIN | 3276428333335 | 3276428333335 (manter) | Bling (8 registros), 2026-10-25; catálogo (informado) | confirmado (Bling) |
| Marca | vazia | **VALEO** | texto "MARCA VALEO" no cadastro 8173252121 (campo marca = VALIO, errado); catálogo (informado) | informado/legado; **corrigir VALIO→VALEO só com aprovação** |
| Nome | 833333 KIT EMBREAGEM 254MM(PLATODISCOROLAM) | Kit de Embreagem 254 mm (Platô + Disco + Rolamento) · 833333 · Valeo | pedido do proprietário | proposto |
| Composição | — | Platô + Disco + Rolamento | catálogo (informado) | informado |
| Diâmetro disco / platô | — | 254 mm / 254 mm | catálogo (informado); "254MM" no cadastro legado | informado |
| Estrias | — | 23 | catálogo (informado) | informado |
| Código do disco / do platô | — | HD-175 / HDC-138 | catálogo (informado) | informado |
| Observação técnica | — | Rebaixo 5 mm | catálogo (informado) | informado |
| Aplicação 1 | — | Hyundai HR Euro 5 2.5 turbo, MT, 2012> | catálogo (informado) | informado (sem ano final, sem código de motor, sem nº de válvulas) |
| Aplicação 2 | — | Kia Bongo Euro 5 P-7 2.5, MT, 2013> | catálogo (informado) | informado |
| Aplicação legada | — | "2013–2021" (Hyundai HR 2.5L Turbo Euro V; Kia Bongo) | descrição complementar de 8173252121 | **legado: divergência registrada, não mesclada** |
| Conversões OEM | — | (vazio) | catálogo: orientativas, não provam aplicação | vazio |
| Peso | 0 | 10,277 kg | 8173252121 e 16622651374 (legado; 4891 diz 10 kg) | **a confirmar** (pesar o kit) |
| Dimensões | 0x0x0 | 15x45x45 cm | 8173252121 (legado; 4891 diz 45x45x12) | **a confirmar** (medir) |
| Fotos | 0 | 3 internas do 8173252121 | Bling (links temporários), 2026-10-25 | **a confirmar** (conferir se são deste kit e direitos) |
| Fornecedor / custo | Real Moto 06276300718 / 1043,05 | **não alterar** | Bling | preservar |
| Preço, saldo, NCM/CEST, origem, condição, logística | 1500; 1; 8708.93.00 / 01.075.00; 2; 1 | **não alterar** | Bling | preservar; NCM/CEST **não são validação fiscal** |

Divergências entre registros a **resolver pelo dono** (não mescladas): preço 1500 × 1950 × 2200; custo 1043,05 × 1453,52 × 1017,86; CEST preenchido × vazio; origem 2 × 0; unidade KT × CJ × UN.

## 5. Verificação por releitura
- **Bling:** os 3 registros e o 4891 foram relidos por `getProduct`; todos seguem `situacao = E` (nada foi alterado).
- **Espelho do Conecta:** 0 linhas dos IDs/SKUs deste teste (produção, SELECT).
- **Releitura pós-alteração:** **não aplicável**, pois não houve alteração.

## 6. Entrega do teste
- **Resultado:** auditoria concluída; **teste pelo Nano.ia não executado por bloqueio real** (seção 1).
- **ID reaproveitado:** nenhum (proposta: 12753970402, condicionada ao histórico).
- **Alterações efetivas:** nenhuma.
- **Lacunas:** fonte primária não lida por mim (host bloqueado, 403); histórico de vendas/NF/movimentação; peso, dimensões e fotos; conversões OEM.
- **Para destravar sem ampliar permissões:** (1) o dono decide o canônico após ver o histórico no Bling; (2) autorização separada para **ferramenta de reativação/atualização** com teste em mock, Policy Engine e auditoria; (3) liberar o host do catálogo no ambiente de nuvem (**catalogoexpresso.com.br**, Network access) para eu ler a fonte; (4) deploy do #63 antes de reativar qualquer registro com SKU repetido; (5) backend do Nano.ia em homologação para o teste pelo agente.
