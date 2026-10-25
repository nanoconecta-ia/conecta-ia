# Teste supervisionado: KIT DE EMBREAGEM 254MM (PLATÔ/DISCO/ROLAMENTO) · 833333 · VALEO

Data da leitura: **2026-10-25**. Leitura do Bling: **Claude (manual, via conector Bling desta sessão, somente leitura)**. Leitura da fonte primária (catálogo Valeo): **verificada pelo ChatGPT pelo web do ChatGPT em 2026-10-25** (URL na seção 4); **não foi lida pelo ambiente do Claude** (host bloqueado, 403). Isto **não** é prova de autonomia do Nano.ia (ver seção 1).
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

**Teste real do Nano publicado (executado pelo ChatGPT no painel, conversa `f7ebb5aa-d43f-40e9-9c2b-b4c54a060951`, mensagem `caca3884-a95f-4853-81fc-7228cf009e40`, Gemini `gemini-3.6-flash`):** o agente respondeu "Produto não encontrado na API do Bling nesta data" e "Nenhum registro/ID foi localizado no ERP". **É um falso negativo**: a ferramenta só olha o espelho (que não tem excluídos) e nunca consultou a API; a mensagem ficou com `ferramentas=["bling_consultar_produto"]` mas `chamadas=[]` e `evidencias=[]` (ferramenta *solicitada*, não executada) e terminou **truncada** em "Preço, Custo e Estoque: Mantidos como".

**Correção em desenvolvimento: PR #83** (busca por SKU interno, referência do fabricante e GTIN, no espelho e na API, incluindo excluídos e paginação, com proveniência; contrato de falha e truncamento auditado). **Enquanto o #83 não estiver implantado e retestado, nenhuma ausência encontrada pelo Nano pode embasar cadastro.**

**Consequência:** o teste do cadastro **não pôde ser concluído pelo Nano.ia**: (a) o agente publicado não enxerga produto excluído e afirmou ausência sem verificar; (b) o Nano completo não está no ar; (c) não existe ferramenta de reativação nem de escrita ligada. Registro isto como **bloqueio real**; não há sucesso simulado.

## 2. Auditoria dos registros com o GTIN 3276428333335 (leitura Bling, todos `situacao = E` excluído)

O GTIN aparece em **8 registros**, não em 3. Dois deles (`89096`, "104108-2 KIT EMBREAGEM - EAT") têm **SKU e nome diferentes** e repetem o mesmo GTIN. Isso comprova **conflito no cadastro** (o GTIN é repetido); **o nome sozinho não prova que sejam peças fisicamente diferentes nem incompatíveis**, e o GTIN repetido também não prova que sejam a mesma peça. Conclusão: **GTIN, sozinho, não serve de chave de identidade aqui**; a equivalência precisa de evidência (catálogo, medidas, histórico).

| ID Bling | SKU | Nome | Marca | Fornecedor (cód.) | Compra / custo | Preço | Saldo (físico/virtual) | Fotos | Peso / dim. | Unid. | Observação |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **12753970402** | **5112** | 833333 KIT EMBREAGEM 254MM(PLATODISCOROLAM) | vazia | Real Moto (06276300718) | 1043,05 / 1043,05 | 1500 | **1 / 1** (dep. 1144593331) | 0 | 0 / 0x0x0 | KT | NCM 8708.93.00, CEST 01.075.00, origem 2, condição 1 |
| **8173252121** | **833333** | Kit Embreagem 254mm(...) Hyundai Hr/K2500 Euro 5 Original 833333 | VALIO (errada; o texto do cadastro diz VALEO) | Real Moto (**833333**) | 1453,52 / 1453,52 | 1950 | 0 / 0 | **3 internas** | 10,277 kg / 15x45x45 | KT | descrição: "2013-2021"; local P01; CEST vazio; origem 2; condição 1; frete grátis; 3 itens/caixa |
| **16622651374** | **833333** | (mesmo nome do anterior) | VALIO | **nenhum** | 0 / 0 | 1950 | 0 / 0 | 0 | 10,277 kg / 0x0x0 | UN | descrição curta com resíduo `&lt;`; **condição 0, origem 0**; sem CEST |
| 7538741982 | 4891 | KIT EMBREAGEM 254MM(...) HYUNDAI HR KIA BONGO EURO 5 ORIGINAL 833333 | VALIO | Real Moto (06276300718) | 808,73 / 1017,86 | 2200 | 0 / 0 | 0 | 10 kg / 45x45x12 | CJ | CEST 01.075.00; origem 2 |
| 16514593039 | 833333/1 | Kit Embreagem 254mm(...) Hyundai Hr/K2500 Euro 5 | VALIO | Real Moto (**833333**) | 1453,52 / 1453,52 | 1650 | 0 / 0 | **3 internas** | 10,277 kg / 15x45x45 | KT | lido em detalhe: mesmo peso, dimensões e textos do `8173252121`; local P01; NCM 8708.93.00, CEST vazio, origem 2, condição 1, frete grátis. **Não é, necessariamente, um registro pior** que o `8173252121` |
| 16622651373 | 833333/1 | (idem) | n/c | n/c | n/c | n/c | 0 | n/c | n/c | n/c | só listagem |
| 16559870756 | 89096 | 104108-2 KIT EMBREAGEM - EAT | VALIO | **POLIPECAS** (89096) | 3673,66 / 3673,66 | 6300 | 0 / 0 | **1 interna** | 10,277 kg / 15x45x45 | KT | lido em detalhe: nome "EAT", mas descrição curta e observações trazem **VALEO / 833333 / Kit Embreagem 254MM**; CEST 01.075.00, origem 2, condição 1. **Conflito de identidade/conteúdo legado** a esclarecer |
| 16622651026 | 89096 | 104108-2 KIT EMBREAGEM - EAT | VALIO | **nenhum** | 0 / 0 | 6300 | 0 / 0 | 0 | 10,277 kg / 0x0x0 | UN | lido em detalhe: nome "EAT" com descrição curta do kit Valeo 833333 (texto cortado), sem observações, sem fornecedor/fotos; condição 0, origem 0. **Conflito de identidade/conteúdo legado** |

`n/c` = não consultado em detalhe (só listagem; resta apenas `16622651373`, 833333/1). Fornecedor: `listProductSuppliers` devolveu **0 vínculos** para 12753970402 e 8173252121 (o fornecedor consta só no campo embutido do produto).

**Histórico que não foi possível verificar:** pedidos de compra do fornecedor Real Moto (`idFornecedor 1169097084`) retornaram **0 pedidos**; o conector não filtra venda/NF por produto. Vendas, notas de entrada e movimentações de estoque **não foram comparados** (lacuna). O dono pode ver "Movimentação do produto" no Bling para os IDs 12753970402, 8173252121 e 16622651374.

Indícios (**inferência, não prova**): os IDs `16622651026`, `…373` e `…374` são consecutivos, o que sugere uma operação em lote; não há prova de qual registro é origem de qual. Os registros `16514593039` e `8173252121` têm o mesmo peso, dimensões e textos e ambos têm fornecedor e fotos: **um não é, necessariamente, pior que o outro**. Os registros com nome "EAT" (`16559870756`, `16622651026`) carregam marca VALIO e texto Valeo/833333 mas outro fornecedor/SKU/preço. Isso **reforça o conflito de identidade e de conteúdo legado**, sem prova física de peça distinta.

## 3. Canônico: **não escolhido** (decisão do dono; **nenhuma ação executada**)

Esta auditoria **não indica registro canônico**. Saldo isolado (o `12753970402` é o único com saldo físico 1) **não** é critério suficiente: o saldo pode refletir apenas a última movimentação, e os registros com mais conteúdo (fotos, peso, dimensões, fornecedor) estão sem saldo. A escolha depende de **histórico de movimentação, vendas, compras e NF** de cada ID, que **não foi comparado** (lacuna) e que o dono pode ver em "Movimentação do produto" no Bling.

Observações neutras para a decisão: o SKU `5112` segue o padrão de SKU interno (como `4891`), e `833333` é a **referência do fabricante**, que deve ficar em campo próprio e não ser SKU interno obrigatório; `8173252121` e `16514593039` são os mais completos em conteúdo (3 fotos, peso, dimensões, textos); `16622651374` e `16622651026` são os mais empobrecidos (sem fornecedor/fotos, condição e origem zeradas). Nada disso é equivalência nem prova de duplicata.

**Risco concreto ao reativar:** usar `833333` como SKU de **um** registro **não** é, por si, duplicação, se não houver outro registro **ativo** com o mesmo SKU. O risco é **ativar duplicados sem controle**: `833333` está em **dois** registros excluídos (8173252121 e 16622651374) e `833333/1` em outros dois; reativar ambos repetiria SKU ativo e **derrubaria o lote do `bling-sync` em produção** (índice único `(loja_id, sku)`), porque a correção de identidade (PR #63) **não está implantada**. Regra: reativar **no máximo um** registro por SKU e conferir antes que não haja outro ativo com o mesmo SKU.

Registro de auditoria da escolha (a ser gravado quando o dono decidir e houver ferramenta ativa): a `idempotency_key` deve usar o ID Bling escolhido, por exemplo `cadastro:kit-embreagem-833333:bling-<id escolhido>:v1` (chave interna, não o GTIN nem o código do fabricante).

## 4. Rascunho de cadastro, campo a campo (nada aplicado)

Legenda de status: **confirmado** (lido por mim no Bling) · **verificado pelo ChatGPT** (lido na fonte primária pelo web do ChatGPT, URL abaixo, 2026-10-25; **não** lido pelo ambiente do Claude) · **legado** (cadastro antigo) · **a confirmar** · **vazio**.

A coluna "Valor anterior" usa o `12753970402` apenas como **base de comparação**; isso não é escolha do registro canônico (seção 3).

Fonte primária (ChatGPT, 2026-10-25): https://catalogoexpresso.com.br/valeo/detalhes?cw_filtros=PCs%3C%212%21%3E833333%3C%21TAB%21%3E&cw_produtoAtivo=CodigoProduto%3C%212%21%3E18793&retornaJSON=true

| Campo | Valor anterior (12753970402) | Valor proposto | Evidência (fonte, data) | Status |
|---|---|---|---|---|
| SKU interno | 5112 | **5112 (manter)** | Bling, 2026-10-25 | confirmado |
| Referência do fabricante | (no nome) | 833333 | Bling (nome/obs. dos registros), 2026-10-25; catálogo (verificado pelo ChatGPT) | confirmado no Bling; verificado pelo ChatGPT |
| GTIN | 3276428333335 | 3276428333335 (manter) | Bling (8 registros, conflito de cadastro), 2026-10-25; catálogo (verificado pelo ChatGPT) | confirmado (Bling) e verificado pelo ChatGPT |
| Marca | vazia | **VALEO** | texto "MARCA VALEO" no cadastro 8173252121 (campo marca = VALIO, errado); catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT; **corrigir VALIO→VALEO só com aprovação** |
| Nome | 833333 KIT EMBREAGEM 254MM(PLATODISCOROLAM) | Kit de Embreagem 254 mm (Platô + Disco + Rolamento) · 833333 · Valeo | pedido do proprietário | proposto |
| Composição | — | Platô + Disco + Rolamento | catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT |
| Diâmetro disco / platô | — | 254 mm / 254 mm | catálogo (verificado pelo ChatGPT); "254MM" no cadastro legado | verificado pelo ChatGPT |
| Estrias | — | 23 | catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT |
| Tecnologia do disco / do platô | — | HD-175 / HDC-138 | catálogo, campos "Tecnologia Disco" e "Tecnologia Platô" (verificado pelo ChatGPT) | verificado pelo ChatGPT. **São tecnologias, não códigos de componente.** |
| Código Valeo do disco / do platô / do rolamento | — | (vazio) | catálogo: os três campos "Código Valeo Disco/Platô/Rolamento" estão **vazios** (verificado pelo ChatGPT) | **vazio**; não preencher com HD-175/HDC-138 |
| Observação técnica | — | Rebaixo 5 mm | catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT |
| Aplicação 1 | — | Hyundai HR Euro 5 2.5 turbo, MT, 2012> | catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT (sem ano final, sem código de motor, sem nº de válvulas) |
| Aplicação 2 | — | Kia Bongo Euro 5 P-7 2.5, MT, 2013> | catálogo (verificado pelo ChatGPT) | verificado pelo ChatGPT |
| Aplicação legada | — | "2013–2021" (Hyundai HR 2.5L Turbo Euro V; Kia Bongo) | descrição complementar de 8173252121 | **legado: divergência registrada, não mesclada** |
| Conversões OEM | — | (vazio no cadastro) | catálogo: conversões **orientativas**, não provam aplicação por si | vazio (não promover a aplicação) |
| Peso | 0 | 10,277 kg | 8173252121 e 16622651374 (legado; 4891 diz 10 kg) | **a confirmar** (pesar o kit) |
| Dimensões | 0x0x0 | 15x45x45 cm | 8173252121 (legado; 4891 diz 45x45x12) | **a confirmar** (medir) |
| Fotos | 0 | 3 internas do 8173252121 | Bling (links temporários), 2026-10-25 | **a confirmar** (conferir se são deste kit e direitos) |
| Fornecedor / custo | Real Moto 06276300718 / 1043,05 | **não alterar** | Bling | preservar |
| Preço, saldo, NCM/CEST, origem, condição, logística | 1500; 1; 8708.93.00 / 01.075.00; 2; 1 | **não alterar** | Bling | preservar; NCM/CEST **não são validação fiscal** |

Divergências entre registros a **resolver pelo dono** (não mescladas): preço 1500 × 1950 × 2200; custo 1043,05 × 1453,52 × 1017,86; CEST preenchido × vazio; origem 2 × 0; unidade KT × CJ × UN.

## 5. Verificação por releitura
- **Bling:** os registros `12753970402`, `8173252121`, `16622651374`, `4891`, `16514593039`, `16559870756` e `16622651026` foram lidos/relidos por `getProduct`; todos seguem `situacao = E` (nada foi alterado).
- **Espelho do Conecta:** 0 linhas dos IDs/SKUs deste teste (produção, SELECT).
- **Releitura pós-alteração:** **não aplicável**, pois não houve alteração.

## 6. Entrega do teste
- **Resultado:** auditoria concluída; **teste pelo Nano.ia não executado por bloqueio real** (seção 1).
- **ID reaproveitado:** nenhum; **canônico não escolhido** (depende do histórico de movimentação).
- **Alterações efetivas:** nenhuma.
- **Lacunas:** histórico de vendas/NF/movimentação; peso, dimensões e fotos; códigos Valeo de disco/platô/rolamento (vazios na fonte); conversões OEM (só orientativas). A fonte primária **foi lida pelo ChatGPT**, não pelo ambiente do Claude (host bloqueado, 403).
- **Para destravar sem ampliar permissões:** (1) o dono decide o canônico após ver o histórico no Bling; (2) autorização separada para **ferramenta de reativação/atualização** com teste em mock, Policy Engine e auditoria; (3) **deploy do #83** (busca com proveniência) e novo teste real do Nano com os 8 candidatos, antes de qualquer cadastro; (4) deploy do #63 antes de reativar qualquer registro com SKU repetido; (5) backend do Nano.ia em homologação para o fluxo completo pelo agente. (Liberar o host do catálogo no ambiente de nuvem só é necessário se o Claude precisar reler a fonte; não é pré-requisito para corrigir a busca.)
