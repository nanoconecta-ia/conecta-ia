# Cadastro mestre, origem por fornecedor e vínculo com nota fiscal (desenho para aprovação)

Decisão e pedido do dono em 02/11/2026. **Este documento é só desenho: nenhuma migração, deploy ou escrita.** Pela regra do projeto, tabelas e migrações só nascem depois da aprovação do desenho (seção 8).

## 1. Análise (o que o dono pediu)
1. O agente é "especialista sênior em cadastro": corrige marca, modelo, aplicação (ano inicial/final), tags, bula técnica, marcas cambiadas, peso e medidas, dados fiscais (com base em órgão público, consultando a web) e cadastra as imagens necessárias. **Tudo como proposta com fonte; a pessoa aprova.**
2. **Marca nunca inventada.** Nacional × importado é um campo com evidência própria. Sem fonte, fica "a confirmar". Nome de marca "fantasioso" é recusado.
3. **Produto novo** com origem no Bling (criar no Bling) e **produto novo vindo de nota fiscal** (a nota nunca é alterada; o agente só **vincula** o item da nota a um produto já cadastrado: SKU interno do importador, ex. `CI001086`, ou o código original do fabricante nacional).
4. **Mesmo produto, vários fornecedores** (cotação em dezenas de fornecedores, inclusive parceiro que revende lote): hoje isso gera SKUs duplicados. O agente monta um **produto mestre** e pendura as **origens** (fornecedor A, B, C). A origem e a nota de entrada/saída ficam resguardadas.
5. **Nunca apagar.** Produto excluído no Bling que tem nota fiscal vinculada é **restaurado** e mantido como origem, nunca descartado.
6. O raciocínio é o do mapa mental (taxonomia): mestre → origens → notas. É o componente `MapaMental` que já existe.

## 2. O que já existe e o que a nota fiscal real mostrou (leitura só-leitura, 02/11/2026)
- Ferramentas ativas: `engenharia.duplicidade.detectar`, `engenharia.taxonomia.buscar`, `engenharia.intercambio.listar`, `engenharia.aplicacoes.validar`, `bling.produtos.preparar_atualizacao`, `preparar_reativacao`. Planejadas: `bling.produtos.preparar_cadastro`, `engenharia.classificacao.propor`, `engenharia.genealogia.organizar`.
- **Nota de entrada (tipo 0) no Bling**: cada item traz `descricao`, `classificacaoFiscal` (NCM), `cest`, `cfop`, `origem` (código fiscal 0–8), peso 0, **`codigo` vazio e `gtin` vazio**. Consequências de projeto:
  - **não dá para casar item de nota com SKU pelo código**: o vínculo é uma relação proposta (descrição + NCM + nota) e aprovada pela pessoa;
  - **a marca aparece no texto da descrição** da nota do fornecedor ("… - MARCA: …"): é evidência do tipo *declarada pelo fornecedor na NF-e*, **não** verificação independente;
  - **`origem` fiscal por item é evidência objetiva de nacional × importado** (ex.: 1 = estrangeira, importação direta). O agente usa esse código e cita a nota; não "adivinha".
- As quatro propostas de `CI001086` (marca "TRIM GO") têm como fonte "Cadastro do Bling". Só a `14dc4509` registrou o "antes" correto (`" MARCA: TRIM GO"`). As outras três têm "antes" vazio e são duplicatas.

## 3. Arquitetura (componentes afetados e fluxo)
```
nota fiscal (Bling, só leitura) ─┐
cadastro Bling (espelho)         ├─► Nano.IA (proposta, nunca grava) ─► Policy Engine (risco) ─► FILA (pessoa aprova)
web pública / órgãos (fonte)     ┘                                              │
                                                                                ▼
                     executor (conector-aprovacoes) ─► Bling (alterar/criar) ─► leitura de confirmação ─► auditoria
```
- **Gênesis/Nano**: interpreta o pedido, consulta, monta proposta. **Policy Engine**: MEDIUM para campos de cadastro; **HIGH** para dado fiscal (exige confirmação explícita e conferência do contador, como já manda `docs/ARQUITETURA.md` seção "Cuidados com o enriquecimento"). **Tool Registry**: novas entradas abaixo. **Sync/Audit**: sem mudança de contrato.
- Escrita no Bling continua por ferramenta liberada **por loja e por ferramenta** (`agente_escrita_liberada`). Hoje só `bling.produtos.alterar` (Mobis). Criar produto exige liberar `bling.produtos.criar` depois do mock e da conferência do OpenAPI oficial.

## 4. Regras que viram código (puras e testadas)
1. **`regras_marca`**: marca só vira proposta se (a) não for termo genérico (IMPORTADO, NACIONAL, GENÉRICO, ORIGINAL, SIMILAR…), e (b) tiver evidência: URL/documento externo **ou** a marca aparece literalmente no texto do próprio cadastro/nota (marcada como "declarada, não verificada"). Sem evidência: recusa. `origem` (nacional/importado) só com evidência: código fiscal `origem` da nota, ou fonte do fabricante.
2. **Produto vindo de nota**: campos que nasceram da nota (NCM, CFOP, CEST, valores, origem fiscal) ficam **travados**; a nota é imutável. O agente só propõe **vínculo** (item da nota → produto/mestre).
3. **Duplicidade**: `engenharia.duplicidade.detectar` sugere; o agente **nunca funde nem apaga**: propõe "vincular ao mestre".
4. **Nunca excluir**: não existe ferramenta de exclusão; excluído com nota → proposta de **reativação** (já existe) e marca de origem preservada.
5. **Custo e fornecedor** continuam fora de qualquer payload de IA, de mapa e de tela do site. O preço de compra por fornecedor fica numa tabela só de administração (seção 5) para o lojista comparar, nunca exposta ao agente.

## 5. Schema proposto (NÃO aplicado; aguardando aprovação)
| Tabela | Para quê | Notas |
|---|---|---|
| `produto_mestre` | identidade única: nó da taxonomia + fabricante + código original/OEM + `origem_marca` (nacional/importado/a_confirmar) | RLS por loja; sem DELETE |
| `produto_origem` | cada oferta/fornecedor ligada ao mestre: tipo (importador, fabricante, parceiro), SKU de origem, referência do fornecedor, `produto_id` do espelho, nota de entrada | **sem preço** |
| `produto_origem_custo` | preço de compra por origem e data | só administrador do lojista; **fora** de funções de IA, mapa, MCP e site |
| `produto_vinculo_nf` | item da nota (tipo entrada/saída, número, série, chave, item) ↔ produto/mestre, com evidência | **append-only** (gatilho bloqueia UPDATE/DELETE); `imutavel = true` |
| `marca_evidencia` | marca, `origem_marca`, fonte (URL/documento/nota), data, nível | toda proposta de marca aponta para uma linha |
| `produtos.protegido_por_nf` (coluna) | produto com nota vinculada nunca é descartado | usada por reativação e bloqueio de exclusão |

Estados das propostas: sem mudança na máquina existente (`pendente → aprovada → em_execucao → confirmada/falhou/desconhecida`). Novos tipos de item: `mestre.vincular`, `nf.vincular`, `marca.definir`, `bling.produtos.criar`.

## 6. Ferramentas novas ou ativadas (todas só propõem)
`bling.produtos.preparar_cadastro` (criar no Bling; antes `duplicidade.detectar` e `idempotency_key`), `conecta.mestre.propor_vinculo`, `bling.nfe.propor_vinculo` (lê a nota, nunca grava na nota), `engenharia.marca.propor` (com `regras_marca`), `engenharia.classificacao.propor`, `engenharia.genealogia.organizar` (gera o mapa mestre → origens → notas). Consulta web a órgãos públicos (NCM/CEST/CFOP) por `web.buscar` e `web.pagina.ler`, sempre citando URL e data.

## 7. Riscos
| Risco | Mitigação |
|---|---|
| Marca inventada ou trocada nacional↔importada | `regras_marca`; `origem` só com evidência; sem fonte = "a confirmar" |
| Fiscal errado | proposta HIGH, fonte pública citada, conferência do contador, nunca automática |
| Alterar nota ou dado nascido da nota | nota imutável; campos travados; vínculo append-only |
| Vazar custo/fornecedor | tabela de custo separada com RLS de admin; guarda de payload (#111) |
| Fundir produtos diferentes por engano | só **vincula**; pessoa aprova; reversível |
| Criar duplicado no Bling | `duplicidade.detectar` antes; `idempotency_key`; leitura de confirmação |
| Contrato do Bling não conferido (criar produto, notas de entrada) | conferir no OpenAPI oficial antes de ligar; mock primeiro (`test.*`) |
| Item de nota sem código | vínculo por descrição + NCM + nota, sempre aprovado por pessoa |

## 8. Fases e o que depende do dono
- **F1 (sem migração, entra já):** `regras_marca` + integração na proposta de atualização de marca; documentação.
- **F2 (migração):** tabelas da seção 5. **Depende de aprovação deste desenho.**
- **F3:** `preparar_cadastro` com mock; liberar `bling.produtos.criar` (autorização à parte).
- **F4:** vínculo de nota fiscal e mapa mestre → origens → notas.
- **F5:** imagens (busca com procedência + SHA + aprovação), já preparadas no #208 e na galeria #235.

**Perguntas ao dono:** (1) aprova o desenho das tabelas? (2) "quando vier de nota fiscal, não alterar" = nota imutável **e** campos fiscais nascidos da nota travados: correto? (3) o preço de compra por fornecedor pode ficar numa tela só sua, fora do agente? (4) política do SKU interno do importador novo (ex.: prefixo `CI` + sequência): o agente sugere ou só você define?
