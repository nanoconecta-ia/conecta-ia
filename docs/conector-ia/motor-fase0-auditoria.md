# Motor de raciocínio e indexação automotiva — Fase 0: auditoria (2026-10-19)

Escopo da leitura: `CLAUDE.md` e `docs/`, 40 branches remotas, migrações, 15 Edge Functions e 76 tabelas do projeto `dsfzhsrudriqkumtlqwj` (**somente leitura**), testes locais.
Legenda: **EXISTENTE** (há no repositório ou em produção) · **FUNCIONAL** (testado e usado) · **INCOMPLETO** · **AUSENTE** · **RISCO**.
"Local" = existe só na branch `feat/conector-ia-fase1` (PR #39, rascunho), **não aplicado em produção**.

## 0. Estado de produção (leitura)
- 1 loja, 4 produtos (todos com categoria órfã 1072643), 1 conexão Bling, 0 produtos publicados, 0 enriquecimentos, 0 peças ligadas a produto, 0 aprovações, 0 conversas, **0 chaves de IA ativas**, 49 nós de taxonomia, 16 fontes, 10 montadoras/10 modelos/10 motores, 0 versões de veículo.
- 39 migrações aplicadas (até `20261018232515`); nenhuma da branch do Nano.ia está aplicada.
- 15 Edge Functions ativas (bling-*, assistente, agente, pair, conecta-gateway, loja-publica, loja-tema, ia-config…); as do Nano.ia (`conector-*`, `loja-seo`) **não** estão publicadas.
- **RLS ligada em 76 de 76 tabelas.** Única sem política: `pair_desafios` (negar tudo; acesso só pelo servidor).

## 1. Matriz por capacidade
| # | Capacidade | Situação | Evidência / lacuna |
|---|---|---|---|
| **Fase 1 — modelo de conhecimento** | | | |
| 1.1 | Índice por SKU / GTIN | EXISTENTE, FUNCIONAL | `produtos(loja_id, sku)`, `gtin`, `gtin_tributario`; detecção de duplicidade (local) |
| 1.2 | Índice por OEM / código de fabricante | EXISTENTE (prod, sem dados) + local | `pecas_ref(upper(btrim(codigo)))`; busca direta `dna_por_codigo_oem` (local) |
| 1.3 | Árvore de taxonomia | EXISTENTE, FUNCIONAL | `taxonomia_nos` (49 nós), ponte `bling_categoria_taxonomia`; árvore funcional de 3 níveis com ícone (local, proposta) |
| 1.4 | Hierarquia automotiva | EXISTENTE (prod, quase vazia) | montadora ▸ plataforma ▸ modelo ▸ geração ▸ versão ▸ motor; **0 versões**; identidade oficial do veículo (local) |
| 1.5 | Grafo de relações | EXISTENTE | tabelas de relação já cobrem o grafo: `relacoes_tecnicas`, `ref_cruzada` (sem fecho transitivo), `versao_motor`, `pecas_aplicacoes_tecnicas`, `produto_pecas_ref`. **Não há motivo para banco de grafo agora** |
| 1.6 | Filas assíncronas | INCOMPLETO | `enriquecimento_tarefas/execucoes` existem; `limite_chamada` (rate limit); **sem worker de retentativa com recuo para enriquecimento**; local: operações com idempotência e reconciliação |
| 1.7 | Máquina de estados do ciclo (identificar→pesquisar→validar→aprovar→publicar) | INCOMPLETO | prod: 4 estados de enriquecimento (`a_confirmar/aprovado/desatualizado/rejeitado`); local: proposta versionada + trava por produto. **Falta uma máquina única do pipeline por produto** |
| 1.8 | Histórico versionado | EXISTENTE, FUNCIONAL | `produto_revisoes`, `auditoria` imutável (prod); propostas com versão e hash SHA-256 (local) |
| 1.9 | Isolamento por loja | FUNCIONAL | RLS em todas as tabelas; RPCs de servidor só `service_role`; testes `rls_isolamento`, `chat_operacional`, `mcp_chaves`, `ferramentas_verificacao` |
| **Fase 2 — raciocínio** | | | |
| 2.1 | Normalização e extração (OEM, GTIN, ano, motor, emissão, NÃO SE APLICA) | EXISTENTE (local, Python) | `scripts/catalogo_ia`; 25 testes |
| 2.2 | Classe da peça (genuína/OEM/aftermarket/cruzado) com evidência | EXISTENTE | `pecas_ref.classe` + trigger `exige_fornecedor_oem` (prod); extração com lista de fornecedores com fonte (local) |
| 2.3 | Motor, geração, mercado, período no Brasil | EXISTENTE (modelo) / AUSENTE (dados) | `eventos_veiculo`, `versoes.mercado`; **sem dados do HR/K2500** (ver `periodo-brasil-hr-k2500.md`) |
| 2.4 | Detecção de aplicações conflitantes | AUSENTE | verificações atuais só confirmam; não comparam duas fontes que discordam |
| 2.5 | Pipeline único ENTRADA→…→SINCRONIZAÇÃO | AUSENTE | peças existem soltas; falta o orquestrador |
| **Fase 3 — pesquisa** | | | |
| 3.1 | Conectores modulares | INCOMPLETO | `loja_plugins` + `conecta.plugins.chamar`; busca de imagens (Google); **sem conectores de catálogo de fabricante, B2B ou base de GTIN** |
| 3.2 | IA substituível | FUNCIONAL | adaptadores Claude/Gemini/compatível OpenAI (+streaming, fixtures); **modelo local: AUSENTE**; **0 chaves ativas** |
| 3.3 | Não contornar autenticação/bloqueios | RISCO controlado | regra no prompt e nos plugins; ambiente de desenvolvimento bloqueia sites externos |
| **Fase 4 — enriquecimento** | | | |
| 4.1 | Atributo com fonte, data, confiança, aprovação | EXISTENTE | `produto_enriquecimento` (prod, 0 linhas) |
| 4.2 | Imagens com procedência e direitos | EXISTENTE (local) + prod parcial | `produto_imagens` + pipeline de direitos (local) |
| 4.3 | SEO, URL, dados estruturados | EXISTENTE (local) | `_shared/seo`, `loja-seo`; **não publicado**; páginas legais AUSENTES |
| **Fase 5 — Bling** | | | |
| 5.1 | ID estável Bling ↔ Conecta.IA | FUNCIONAL | `(loja_id, bling_id)` |
| 5.2 | Sincronização incremental | INCOMPLETO | lista tudo a cada 15 min e busca detalhe do que mudou; custo cresce com o catálogo; webhook não implementado |
| 5.3 | Conflitos e alterações | INCOMPLETO | "o Bling prevalece"; não há detecção de edição concorrente nem de divergência de enriquecimento |
| 5.4 | Escrita no ERP com aprovação | EXISTENTE (local), desligada | 3 travas independentes, hash, idempotência, leitura de confirmação, desconhecida/reconciliação |
| 5.5 | Dados fiscais protegidos | FUNCIONAL | matriz `04-matriz-bling.md`; custo/fornecedor/fiscal não copiados; o agente só vê campos permitidos |
| 5.6 | Campos conferidos na documentação oficial do Bling | **RISCO** | `developer.bling.com.br` bloqueado aqui; todos os campos de escrita `conferido:false` |
| **Fase 6 — testes** | | | |
| 6.1 | Isolamento entre lojas | FUNCIONAL | vários |
| 6.2 | Duplicidade SKU/GTIN; sem GTIN | EXISTENTE (local) | `ferramentas_verificacao.sql` |
| 6.3 | OEM conflitante | AUSENTE | falta regra e teste |
| 6.4 | Compatibilidade falsa | EXISTENTE (local) | validação por versão/mercado/ano; nunca "incompatível" |
| 6.5 | Falhas de API, limites, timeout, retentativa, sync repetida | EXISTENTE | testes do Bling e do executor (local) |
| 6.6 | Publicar sem aprovação | EXISTENTE | `publicar_produto` + `exige_requisitos_producao` (prod); trava (local) |
| 6.7 | Instrução maliciosa em página pesquisada | **INCOMPLETO** | regra "dados, não instruções" no prompt e na saída validada; **falta teste adversarial ponta a ponta** |

## 2. Achados de risco
1. **`agente_turno_iniciar` não existe** em nenhuma branch, no histórico ou em produção. O equivalente é `public.chat_iniciar` (início de turno do chat operacional). Foi testado.
   - **Defeito confirmado (baixa gravidade):** no reenvio idempotente de uma pergunta antiga **sem resposta e já vencida**, enquanto a conversa corre com um turno **mais novo**, a função devolve `em_execucao` em vez de `interrompido`, porque olha o prazo da conversa e não o da pergunta. Sem vazamento nem corrupção: o cliente fica esperando uma resposta que nunca virá até o turno novo terminar.
   - Correção proposta (não aplicada; função do núcleo do chat em produção): no ramo de reenvio, trocar `case when c.turno_ate>now()` por `case when c.turno_pergunta=q.id and c.turno_ate>now()`. Pede PR próprio e aprovação, conforme a regra do núcleo.
2. **Isolamento:** `chat_iniciar`, `chat_responder`, `aprovacao_propor` etc. recebem `p_user`/`p_loja` mas **só `service_role` pode executá-las**; as expostas a usuários logados (`pair_*`, `chat_ler_como_administrador`, `aprovacao_decidir`…) verificam o vínculo com a loja e têm teste de travessia entre lojas.
3. **Sobreposição de arquiteturas:** as migrações da branch (`…01` a `…08`) criam tabelas ao lado das do outro agente (`aprovacoes`, `conversas`). Antes de aplicar, reconciliar para não duplicar (ver `riscos-e-dependencias.md`).
4. **Sem IA ativa e sem dados:** produção tem 0 chaves de IA, 0 versões de veículo e 0 peças ligadas. O pipeline roda, mas devolve "a confirmar" até haver fontes aprovadas.
5. **Campos do Bling não conferidos** na documentação oficial; nenhuma escrita é liberada por isso.
6. **Ambiente de desenvolvimento sem acesso a sites externos** (HTTP 403): a pesquisa web real não pôde ser validada aqui.
7. **Categorias do Bling**: as 14 existentes são de 2 níveis; a árvore de 3 níveis exige criar categorias (escrita), sempre com aprovação.

## 3. Campos sincronizáveis sem tocar em fiscal
Bling → Conecta.IA (leitura): id, SKU, nome, preço, estoque, situação, categoria, marca, GTIN, descrições, peso, dimensões, volumes, unidade, formato, pai (ver `04-matriz-bling.md`).
Conecta.IA → Bling (futuro, desligado, campo a campo): descrição enriquecida e categoria. **Proibido:** custo, fornecedor, preço de compra, NCM/CEST/CST/CFOP, XML fiscal, preço e estoque por IA.

## 4. O que a Fase 1–2 precisa construir (lacunas)
1. **Máquina de estados do pipeline por produto** (tabela + transições + histórico).
2. **Orquestrador** ENTRADA → … → SINCRONIZAÇÃO reutilizando as peças existentes (extração, verificações, propostas).
3. **Detector de conflito** entre fontes (aplicação e OEM) e entre Bling e enriquecimento.
4. **Worker de fila** com recuo, limite por loja e retomada.
5. **Teste adversarial** de instrução maliciosa em página pesquisada.
6. **Demonstração** com produtos de teste e evidências de procedência.
