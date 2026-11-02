# Balanço, cadastro inicial e notas antigas (desenho; respostas do dono registradas; balanço AINDA não implementado)

Origem: ordem do dono de 02/11/2026 (piloto Mobis). Este documento só desenha. Nenhuma tabela, ferramenta de escrita ou migração foi criada. Regras que seguem valendo: Bling só com aprovação humana por versão/hash + Policy Engine + `idempotency_key` + auditoria; estoque e fiscal nunca por conta do agente; custo/fornecedor nunca vão ao site, a clientes ou ao LLM.

## 1. Análise (o que foi pedido)
1. O agente poderia cadastrar SKU automático quando o produto não tem SKU, para nunca ficar sem referência.
2. Executar o **cadastro inicial total** do Bling (SKU, código de fábrica, EAN), saneando excluídos, duplicados e desorganizados.
3. Fazer o **balanço** da empresa (compras já feitas para a contagem; nota fiscal integrada).
4. **Notas fiscais antigas** de entrada e saída: rastrear a peça pela nota, **sem lançar tudo como compra avulsa**: datas antigas não batem com a janela mensal, semanal ou diária, então **nada é lançado sem permissão do lojista**.
5. Consultar **bancos públicos** antes de aplicar regra fiscal (inclusive os novos sistemas fiscais).
6. Produto não cadastrado: **simulação** para o lojista aceitar 1, 10, 50 ou 100. No piloto Mobis: **um por vez, até 10**.

## 2. Arquitetura (reaproveita o que existe)
| Peça | Já existe | Falta |
|---|---|---|
| Leitura do Bling e espelho | `bling_snapshots`, `bling.produtos.consultar_ativos`, `engenharia.duplicidade.detectar` | diagnóstico agregado (ver fase 0) |
| Proposta versionada com hash | `agente_propostas`, `criarPropostaVersionada`, teto de propostas por envio | tipo de item para SKU e para vínculo em lote |
| Cadastro de produto novo | `bling.produtos.preparar_cadastro` (só propõe; criação real desligada) | geração de SKU proposto |
| Vínculo com nota fiscal | `produto_vinculo_nf` (append-only, nota imutável) | leitura em janelas de NFs antigas |
| Fiscal | nada é proposto pelo agente (NCM/CEST/CFOP ficam "a confirmar") | consulta a fonte pública com fonte, data e versão; conferência do contador |
| Estoque/balanço | **nada** (estoque é proibido ao agente) | ferramenta de proposta de ajuste, **só com autorização separada** |

## 3. Regras de comportamento propostas
- **SKU automático = PROPOSTA.** O agente sugere o SKU, nunca grava sozinho. A sequência é reservada de forma atômica (sem repetir), confere duplicidade no Bling na hora e entra na fila com `idempotency_key`. O formato (prefixo e dígitos) é decisão do dono (pergunta A).
- **Piloto em lote controlado:** tamanho de lote por loja (padrão 1; teto 10 no piloto). A "simulação" é o rascunho da proposta (dry-run): nome, SKU proposto, categoria, taxonomia, marca com evidência, pendências e conflito de duplicidade. O lojista aprova **um item por vez**; subir para 10, 50 ou 100 é decisão registrada e auditada, loja a loja.
- **Notas antigas só rastreiam, não lançam.** A nota vira vínculo (`produto_vinculo_nf`, imutável) com a **data original**. Nota fora da janela do período em andamento é marcada "retroativa" e **nunca gera movimento de estoque**. Qualquer lançamento exige permissão do lojista, item a item.
- **Balanço separado de compra.** Balanço é um evento próprio (data de referência, contagem física, diferença contra o saldo do Bling). O ajuste de estoque só existe como proposta HIGH, depois de autorização específica e de ferramenta própria. O contrato da API de estoque do Bling **precisa ser conferido no OpenAPI oficial** antes (não afirmo aqui o que a API aceita).
- **Fiscal:** o agente consulta a fonte pública (tabelas oficiais de NCM/CEST e normas novas), registra URL, data e versão, e **propõe** com fonte; o contador valida. Nota emitida ou recebida nunca é alterada; campos fiscais nascidos de nota ficam travados.
- **Memória e tempo:** processamento em páginas pequenas, com ponto de retomada, respeitando o limite de chamadas do Bling (cerca de 3 por segundo) e sem carregar tudo de uma vez.
- **Excluídos e duplicados:** nunca apagar. Excluído é restaurado como **origem** de um mestre (ver `CADASTRO_MESTRE_ORIGEM_NF.md`); duplicado vira vínculo mestre→origens aprovado por pessoa.

## 4. Fases propostas
- **F0 (só leitura):** diagnóstico do Bling: contagem de ativos, excluídos, sem SKU, sem GTIN, duplicados prováveis (SKU, GTIN, nome normalizado) e notas sem vínculo. Relatório para o dono; nada grava.
- **F1:** proposta de SKU para os sem SKU (um por vez), com a fila de aprovação existente.
- **F2:** cadastro piloto: 1 por vez até 10, com simulação e conferência de taxonomia depois de cada um.
- **F3:** vínculo de notas históricas em janelas (read-only, imutável, com data original).
- **F4:** balanço: contagem, diferença e proposta de ajuste, **somente** após autorização de estoque e validação do contador.

## 5. Riscos
| Risco | Mitigação |
|---|---|
| SKU repetido ou colidindo com o do Bling | reserva atômica + checagem na hora + `idempotency_key` |
| Lançar nota antiga como compra e inflar estoque | nota só vincula; "retroativa" nunca move estoque |
| Ajuste de estoque errado | proposta HIGH, autorização separada, data de referência, aprovação por versão/hash |
| Fiscal desatualizado | fonte pública com data e versão antes de propor; contador valida; nunca automático |
| Estourar limite do Bling ou memória | páginas, retomada, orçamento de chamadas |
| Fundir produtos diferentes por engano | só vincula; reversível; pessoa aprova |

## 6. Perguntas ao dono (bloqueiam a implementação)
- **A.** Formato do SKU automático (prefixo e quantidade de dígitos, por exemplo `CI` + 6 dígitos?) e se a numeração nativa do Bling deve ser aproveitada ou só consultada.
- **B.** Autoriza, **separadamente**, uma ferramenta de proposta de ajuste de estoque (balanço)? Sem isso a F4 não existe.
- **C.** Qual a data de referência do balanço e que período de notas antigas entra?
- **D.** Quem é o contador que valida fiscal e balanço?
- **E.** Confirma o piloto: 1 por vez, teto de 10, com parada para conferir a taxonomia depois de cada produto?
- **F.** Posso rodar a **F0** (diagnóstico só leitura do Bling, sem gravar nada)?

---

## 7. Respostas do dono (02/11/2026) e estado
Resposta ditada por voz: **"Proposta sim, pode mexer"** para A a F. Entendi assim, e o que ficou ambíguo está marcado:

| # | Pergunta | Como entendi | Estado |
|---|---|---|---|
| A | Formato do SKU automático | **Sim, a proposta: `CI` + 6 dígitos** (como CI000016 e CI001086). O agente só propõe; você aprova. | **Implementado** (`busca_segura/regras_sku.ts`, ligado a `bling.produtos.preparar_cadastro` quando o rascunho vem sem código). |
| B | Ferramenta de proposta de ajuste de estoque (balanço) | "Proposta sim": entendi que a ferramenta **só propõe**, nunca grava estoque. **Preciso que você confirme esta leitura.** | **Não implementado**: faltam C e D e a conferência do contrato de estoque no OpenAPI do Bling. |
| C | Data de referência do balanço e período de notas antigas | **Sem resposta com data.** | Pendente. |
| D | Contador que valida fiscal e balanço | **Sem resposta com nome.** | Pendente. |
| E | Piloto: 1 por vez, teto de 10, conferir taxonomia a cada um | **Sim.** | **Implementado**: o freio do piloto recusa um novo cadastro enquanto houver outro aguardando decisão (limite 1; subir até 10 é decisão do dono, loja a loja). |
| F | Diagnóstico só de leitura do Bling | **Sim.** | **Parcial**: módulo `busca_segura/diagnostico_cadastro.ts` (contagens, duplicidade provável por código e por nome, maior sequência CI; em páginas, com estado). **A execução completa no servidor ainda não existe**: a porta de leitura atual do Bling não lista produtos em páginas. |

### O que a amostra real já mostra (somente leitura, 1ª página do Bling, 100 registros)
A listagem de "todos" vem em ordem alfabética e a primeira página é **toda de produtos excluídos**, com muita repetição: o mesmo nome sob códigos diferentes (ex.: um retentor aparece 5 vezes com 5 códigos; uma correia, 10 vezes) e o mesmo código em registros diferentes (ex.: `03044-BREF`, `190191`). **Isto é uma amostra, não o catálogo inteiro e não é representativa**; serve só para confirmar que o saneamento é necessário. Nada foi alterado.

### Decisões de segurança mantidas
- SKU e preço de produto novo só entram com o produto aprovado; o SKU automático nunca reutiliza código conhecido e a sequência é conferida no Bling na hora (falha fechada se o Bling não responde).
- **Limite assumido:** a reserva atômica da sequência exige o banco; no piloto (um por vez) a colisão é evitada conferindo o espelho e o Bling. Códigos de produtos excluídos podem não aparecer na consulta do Bling (a listagem padrão traz ativos): **a conferir antes de ampliar o piloto**.
- Estoque, balanço e notas antigas continuam **sem nenhuma escrita**.
