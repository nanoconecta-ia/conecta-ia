# Desenho: escrever a categoria do produto no Bling

**Status (28/10/2026): código da escrita real PRONTO e DESLIGADO. Nada foi escrito no Bling; nada foi implantado.** Ver a seção 8. A autorização do dono vale para o espelhamento nos dois sentidos; a liberação de cada escrita continua passando pelas travas do projeto (CLAUDE.md, regra 7) e por autorização específica (fase P8 em `piloto-mobis.md`).

## 1. Escopo
- **Um campo só:** `categoria.id` do produto, pela ferramenta que já existe no catálogo fechado, `bling.produtos.alterar` (`PATCH /produtos/{id}`), hoje `ativa: false` e `conferido: false`.
- **Só produtos com sugestão de categoria APROVADA** pelo lojista (`produto_enriquecimento`, campo `categoria_sugerida`).
- **Nunca:** preço, estoque, custo, fornecedor, NCM/CEST/CST/CFOP, descrição ou qualquer outro campo. Lista fechada de campos permitidos: só `categoria`.

## 2. Por que a categoria é o primeiro campo
Não é fiscal, não mexe em preço nem estoque, é fácil de conferir (leitura do produto depois da gravação) e é reversível (o valor anterior fica guardado em `antes`). O espelho já usa `categoria.id` do Bling, então o ciclo fecha sozinho: depois da escrita, a sincronização traz a categoria nova e a taxonomia continua igual.

## 3. De onde vem a categoria de destino
O lojista aprovou um **nó da taxonomia**. A categoria do Bling é achada pela ponte inversa (`bling_categoria_taxonomia`): nó → categoria(s) do Bling.
- **Uma categoria só:** vira o destino.
- **Mais de uma** (ex.: nó "Pivôs e terminais" vem de "Pivôs" e "Terminais de direção"): o lojista escolhe na proposta. Nunca se escolhe sozinho.
- **Nenhuma:** o item não entra na proposta e aparece como "sem categoria equivalente no Bling".

### Prévia real (dados de 26/10/2026): 24 produtos antes sem categoria (`1072643`)
| Situação | Qtde | Detalhe |
|---|---|---|
| **Destino único** | 22 | ex.: Embreagem viscosa → 14668464; Válvula termostática → 14676556; Motor parcial → 14676530; Filtros de óleo → 14676579 |
| **Escolha do lojista** | 1 | SKU 3975 (terminal de direção): 14676575 *Pivôs* ou 14676577 *Terminais de direção*. **Decidido pelo dono em 27/10/2026: Terminais de direção (14676577).** |
| **Sem equivalente no Bling** | 1 | SKU 5339 (injetor CR): o nó aprovado "Bicos injetores" não existe no Bling. **Decidido pelo dono em 27/10/2026: usar *Injeção diesel*.** A categoria já existe no Bling (14676553) e na taxonomia, então nada foi criado; a sugestão aprovada do produto foi ajustada para "Alimentação e injeção › Injeção diesel" (auditado). |

**Fora do primeiro lote, por prudência:**
- os **11 itens provisórios ENG-1645** (o cadastro diz "sem NF-e de entrada, não usar como referência técnica confirmada");
- os **3 itens de confiança 35%** (flexível do alternador, silicone, mangueira de retorno de óleo);
- os **7 inativos** (sem efeito na loja).
Sobram os produtos ativos de confiança alta/média com NF-e: CI000054, CI000211, CI003696 e o radiador de óleo (sem SKU).

### Decisões do dono (27/10/2026)
- SKU 3975 vai para **Terminais de direção** (14676577). Na montagem da proposta entra como `escolhas: { <produto_id do 3975>: "14676577" }`.
- SKU 5339 usa **Injeção diesel** (14676553), que **já existe**; não é preciso criar categoria no Bling.

## 4. Fluxo (reaproveita o motor que já existe; nada novo de arquitetura)
1. **Proposta:** `agente_proposta_criar` + um item por produto (`bling.produtos.alterar`, campo `categoria`, `antes` = categoria atual lida do Bling, `depois` = categoria de destino). Risco **MEDIUM** (HIGH se o lote passar de 5).
2. **Envio e revisão:** o lojista vê o "antes e depois" de cada produto. Aprova a **versão exata** (hash); mudar a proposta invalida a aprovação.
3. **Liberação da escrita:** `agente_escrita_liberar` para `bling.produtos.alterar`, com referência da autorização do dono, restrita ao campo `categoria`.
4. **Validação:** relê o produto no Bling. Se a categoria já não é a de `antes` (alguém mudou no Bling), o item é bloqueado, sem sobrescrever.
5. **Ensaio (simulação):** `agente_simulacao_registrar` contra o produto real lido. Sem escrita.
6. **Execução:** `agente_operacao_abrir` com `idempotency_key` → PATCH → `marcar_enviada`.
7. **Leitura de confirmação:** lê o produto e compara `categoria.id`. Só vira "concluído" se bater. Nunca se declara sucesso pelo retorno da chamada.
8. **Timeout:** estado **DESCONHECIDO**, não falha. Reconcilia por leitura; nunca repete às cegas.
9. **Auditoria:** tudo em `agente_operacoes` e `auditoria`. **Parada de emergência:** `agente_escrita_revogar` desliga a ferramenta.

## 5. Lote
Primeiro **1 produto** (o produto de teste da fase P8), depois **até 5**, depois o resto. Ritmo de 3 requisições por segundo no máximo; sem repetição automática de escrita.

## 6. Reversão
`antes` guarda a categoria anterior. **A confirmar:** como o Bling aceita "voltar para sem categoria" (id `1072643` ou `0`). Isso se descobre no produto de teste, não nos reais.

## 7. O que falta ANTES de ligar (nenhum item foi feito)
- [ ] Conferir no OpenAPI oficial o corpo de `PATCH /produtos/{id}` para `categoria` (hoje `conferido: false`; este ambiente não acessa developer.bling.com.br, então a conferência é do dono, como foi feita para o GET).
- [ ] Confirmar que o app do Bling tem o escopo de **escrita em produtos** (decisão do dono de 17/10: cadastro sim, nota fiscal só consulta).
- [ ] Confirmar se a Mobis usa **marketplaces ou loja virtual** ligados ao Bling: mudar a categoria pode alterar o mapeamento deles.
- [ ] Teste com simulação verde para o caso da categoria (a suíte `aceitacao.test.ts` já cobre `bling.produtos.alterar` com campo de exemplo).
- [ ] Trava no executor: só o campo `categoria` passa; qualquer outro é recusado.
- [ ] Autorização escrita do dono, com referência, para o **produto de teste**.

## 8. O que eu construiria, em PRs separados
- **PR-A (só leitura):** resolver nó → categoria(s) do Bling e gerar a proposta em **rascunho**, com os casos "escolha do lojista" e "sem equivalente". Testes.
- **PR-B:** lista de campos permitidos (`categoria`) no executor, com testes de recusa de qualquer outro campo.
- **PR-C (só após a autorização do dono):** liberar a escrita para **um** produto de teste e conferir por leitura.

## 9. Riscos
| Risco | Mitigação |
|---|---|
| Categoria errada no Bling afeta relatórios e integrações | só itens aprovados; antes/depois; 1 produto primeiro |
| Alguém mudou a categoria no Bling depois da aprovação | validação por leitura antes de gravar; bloqueia |
| Resposta do Bling perdida (timeout) | estado DESCONHECIDO; reconcilia por leitura |
| Escrita fora do escopo (outro campo) | lista fechada de campos; teste de recusa |
| Reversão não testada | descobrir no produto de teste antes do lote |

## 8. Estado em 28/10/2026 e como ligar (decisões do dono no chat)
**Decidido pelo dono:** gravar no Bling só **criação de categoria** e **categoria do produto** (primeiro lote); **cada ação aprovada por ele**; navegador do Bling **só leitura** primeiro; nota fiscal só consulta. Criação de produto, estoque, pedidos e contatos seguem **desligados**.

**O que o código faz agora** (PR de código; nada implantado): `BlingEscritaReal` (porta de escrita com lista fechada de 2 ferramentas, id numérico, corpo sem campo proibido, 1 escrita por vez a ~3/s, sem repetição, sem enviar a chave de idempotência ao Bling), `bling.produtos.alterar` e `bling.categorias.criar` **ativas no registro**, e o painel recusa executar (409, aprovação preservada) enquanto a escrita estiver desligada.

**Quatro travas, todas precisam estar abertas (qualquer uma fechada = nada é enviado):**
1. **Implantar** a função `conector-aprovacoes` (hoje não implantada). *Autorização específica do dono.*
2. **Segredo** `BLING_ESCRITA_REAL=1` nas funções. Sem ele a porta recusa antes de enviar. *Dono define.*
3. **Liberação da loja** por ferramenta: `agente_escrita_liberar` com a referência da autorização (começar pelo produto de teste). *Dono autoriza.*
4. **Aprovação da versão exata** de cada proposta, no painel. *Dono, a cada ação.*
Além disso, antes da primeira gravação: confirmar que o **app do Bling tem o escopo de escrita em produtos** e se há **marketplace/loja virtual** ligados (a categoria pode mudar o mapeamento deles); e conferir o corpo de `PATCH /produtos/{id}` e `POST /categorias/produtos` no OpenAPI oficial (os campos usados — `categoria.id`; `descricao` e `categoriaPai.id` — coincidem com o esquema do conector oficial do Bling lido em 28/10/2026).

**Desligar na hora (emergência):** remover o segredo `BLING_ESCRITA_REAL` (ou `agente_escrita_revogar` para a ferramenta). **Reverter um valor:** o `antes` de cada item fica guardado; o produto pode voltar à categoria anterior por nova proposta aprovada.

## 9. O chat do painel agora PROPÕE categorias (não grava)

Até aqui o chat do painel (`assistente`) só consultava e propunha enriquecimento; não tinha como pedir cadastro de categoria. Agora tem três ferramentas, todas pelo Policy Engine (`despachar`, origem `chat`):

| Ferramenta do chat | O que faz | Grava no Bling? |
|---|---|---|
| `bling_categorias` | lista as categorias do Bling agora (leitura) | não |
| `bling_propor_categoria` | confere duplicidade e pai no Bling agora e cria a **proposta** de criar categoria | não |
| `bling_propor_trocar_categoria` | cria a proposta de trocar a categoria de SKUs com sugestão **já aprovada** | não |

A proposta aparece na Central de Inteligência; o lojista aprova a versão exata; só o executor grava, e só com `BLING_ESCRITA_REAL=1` e a ferramenta liberada para a loja (seções 1 a 8). Cadastro de produto novo, preço, estoque e dados fiscais continuam sem ferramenta, e o prompt manda o agente dizer isso com clareza.
