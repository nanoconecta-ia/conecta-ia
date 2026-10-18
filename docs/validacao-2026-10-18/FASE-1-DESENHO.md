# Fase 1 — desenho técnico (para aprovação; nenhuma tabela, migração ou código foi criado)

Conforme o CLAUDE.md: *"Antes de criar tabelas ou migrações: mostre o desenho e espere aprovação."*
Itens pedidos: tabelas `conversas`, `mensagens`, `agente_tarefas`; ferramenta `bling_consultar_produto`; seletor GPT/Gemini/Claude.

## 1. Análise — o que já existe (e deve ser reaproveitado)

Levantado no código e nas migrações da árvore integrada #23+#24 e na função publicada (somente leitura).

| Necessidade | Já existe | Veredito |
|---|---|---|
| Vários provedores de IA | `_shared/ia/adaptadores.ts` (claude, gemini, compativel_openai), laço com ferramentas em `ia/claude.ts` (`conversar`), tipos canônicos em `ia/tipos.ts` | **Reusar integralmente.** Nenhum adaptador novo |
| Chave por loja, principal, modelo, limite mensal | `loja_chaves_ia` (+ `principal`, `modelo`, `base_url`, `limite_mensal_tokens`, `tokens_mes`), cofre `private.chaves_ia_segredos`, RPCs `ia_salvar_chave`, `ia_chave_ativa(p_loja, p_provedor)`, `ia_definir_principal`, `ia_registrar_uso`; função `ia-config`; tela *Integrações* | **Reusar.** `ia_chave_ativa` **já aceita o provedor pedido** — o seletor não precisa de tabela |
| "GPT" | `compativel_openai` + `base_url` (https público validado por `urlPublicaSegura`); o `check` do banco até lista `openai`/`deepseek`, mas `ia-config` e os adaptadores só conhecem os 3 ids | GPT = chave `compativel_openai` apontando para a API da OpenAI. Rótulo na tela derivado do `base_url`. Não criar provedor novo |
| Histórico de conversa | **Não persiste.** O painel (`Assistente.tsx`) manda as últimas 10 mensagens a cada chamada; o servidor guarda só metadados em `auditoria` (`assistente.consulta`: provedor, tokens, passos, ferramentas) | Tabelas novas se justificam |
| Fila de tarefas do agente | `enriquecimento_tarefas` (fila com lease, tentativas, `provedor_preferido`, executor) + `enriquecimento_execucoes` (provedor, modelo, tokens, custo) | **Não duplicar a fila.** `agente_tarefas` registra o *turno* do agente (ver §3) e aponta para a fila quando houver |
| Propor → aprovar → executar | Fila de aprovação (`produto_enriquecimento`, `produto_imagens`) e, no #23, `aprovacoes` (versão exata, hash, risco, idempotência) | **Reusar.** O agente continua só *propondo*; `aprovacao_id` opcional liga o turno à proposta |
| Auditoria | `auditoria` (já usada pelo assistente) | Reusar para cada chamada de ferramenta |
| Ferramentas do Bling | `bling_ferramentas.ts` (Tool Registry): `bling.produtos.obter`, `bling.estoque.saldos` etc. com `risco`, `ativa`, `exigeAprovacao`; `bling_api.ts` (`blingFetch`: recuos, timeout), `bling_token.ts` (`obterAccessToken`, renovação), `bling_armazem.ts` | **Reusar.** A ferramenta de chat é uma casca sobre o registry (leitura, LOW) |
| Espelho / cache local | `produtos` (+ `bling_id`, preço, estoque, sincronização) e `bling_conexoes` | É o *fallback offline* da consulta |
| Limite de taxa | `limite_chamadas` (no #23) | Reusar para o teto de consultas ao Bling por loja |
| Liga/desliga por loja | `loja_recursos`, `recursos_plataforma` | **Candidato** a flag de recurso por loja — confirmar colunas antes de usar |
| Notificação | `notificacoes` | Reusar para avisos (ex.: Bling indisponível) |

Achado que afeta a Fase 1: a **função `assistente` em produção é um arquivo autocontido** (bug de bundling documentado no cabeçalho). Qualquer ferramenta nova que importe `bling_api.ts`/`bling_token.ts` aumenta o número de módulos. Por isso o **gerador de autocontido + comparação de deriva no CI é pré-requisito** (F1.0).

## 2. Arquitetura (fluxo de dados)

```
Painel (Assistente.tsx) ── JWT do usuário ──► assistente (verify_jwt=true)
   │  { loja_id, conversa_id?, texto, provedor?, idempotency_key }
   ▼
 1. Auth + RLS: loja visível ao usuário?                       (já existe)
 2. Provedor: ia_chave_ativa(loja, provedor|principal)         (já existe)
 3. Se persistência ligada: abre/continua `conversas`, grava a mensagem do usuário
 4. Cria `agente_tarefas` (executando) — chave de idempotência evita duplicar no reenvio
 5. conversar(adaptador do provedor, ferramentas)              (já existe)
      └ ferramenta ► Policy (registry: risco/ativa) ► execução ► auditoria
           • leitura (resumo, listar, ver_produto, bling_consultar_produto): direta
           • propor_*: grava `a_confirmar` (fila existente) — nunca aprova
 6. Grava a mensagem da IA + tokens; fecha `agente_tarefas` (concluida|falhou)
 7. ia_registrar_uso (limite mensal da chave)                   (já existe)
```

Separação de responsabilidades (alinhada ao NanoDesk): o *núcleo* não sabe qual provedor responde (adaptador); o *Policy* decide o que cada ferramenta pode (registry); a *auditoria* é independente do chat; aprovação continua humana.

### 2.1 Seletor GPT / Gemini / Claude
- **Sem tabela nova.** O painel lista as chaves *ativas* da loja (via `ia-config`) e mostra um seletor; envia `provedor` ∈ {`claude`,`gemini`,`compativel_openai`}.
- O servidor valida contra o enum e chama `ia_chave_ativa(loja, provedor)`; se não houver chave ativa, responde com erro claro (nada de cair em outro provedor).
- **Sem troca silenciosa:** se o provedor escolhido falhar (401/429/5xx), a resposta informa e **oferece** trocar. Motivo: trocar sozinho envia o histórico da loja a **outro fornecedor** e muda o custo.
- **Modelo:** vem da chave (`loja_chaves_ia.modelo`, definido pelo lojista). O cliente **não** envia nome de modelo livre (evita escalar custo/forçar modelo não contratado).
- Rótulo "GPT" = chave `compativel_openai` cujo `base_url` é a API da OpenAI; qualquer outro `base_url` aparece como "Compatível OpenAI (host)".
- A conversa guarda `provedor_preferido` (continuidade ao reabrir); o provedor *efetivo* de cada resposta fica em `mensagens`.
- **Decisão sua (D1):** o painel do lojista já nomeia provedores na tela *Integrações* (ele cola a própria chave). Manter os nomes no seletor é coerente com isso; a regra do prompt do sistema ("nunca citar o provedor ao cliente final") continua valendo para a **vitrine**.

### 2.2 `bling_consultar_produto` (somente leitura)
- **Entrada:** `{ sku }` (o modelo **não** informa `bling_id`: a função resolve o `bling_id` pelo SKU **dentro da loja do JWT**, impedindo consulta cruzada entre lojas).
- **Execução:** `buscarFerramenta("bling.produtos.obter")` + `podeExecutar` (leitura, LOW, `ativa:true`) → `obterAccessToken` da loja → `blingFetch` `GET /produtos/{id}` (header `enable-jwt: 1`, credencial só no servidor). Para chat: timeout curto (≈8 s) e **1 recuo** (não os 12 s do worker), máx. **3 consultas por turno** e teto por loja via `limite_chamadas`.
- **Saída:** `{ sku, nome, preco, estoque, situacao, origem: "bling_ao_vivo"|"espelho", consultado_em, espelho: { preco, estoque, sincronizado_em }, divergencias: [...] }`. **Sem** custo, fornecedor, tokens, `bling_id`.
- **Offline-first / degradação:** se o Bling não responder (ou a conexão estiver em `reconectar`), devolve o dado do espelho com `origem:"espelho"` e a mensagem *"Consulta ao Bling indisponível; usando o último dado sincronizado em {timestamp}"*. Nunca inventa valor.
- **Auditoria:** `auditoria` com `acao='bling.consulta'`, `{ sku, origem, status_http }` — sem corpo da resposta, sem token.
- **Injeção de prompt:** nome/descrição vindos do Bling são **dados**; já cobertos pela regra do `SISTEMA`.
- **Escrita no Bling:** continua fora. Ferramentas de escrita seguem `ativa:false`.
- **Flag:** ligada por loja (`loja_recursos`, a confirmar). Desligada ⇒ a ferramenta nem é anunciada ao modelo.

## 3. Schema e estados (esboço — nada aplicado)

Uma migração futura única, `supabase/migrations/2026102x_fase1_conversas.sql`, com script de rollback, RLS ligada em todas as tabelas, sem grant para `anon`, escrita **somente** pelo serviço (a função `assistente`).

```
conversas
  id uuid pk, loja_id → lojas (cascade), user_id (quem abriu),
  titulo text (≤120), provedor_preferido text null (enum de 3),
  criada_em, atualizada_em, arquivada_em null
  RLS select: dono (user_id = auth.uid()) OU lojista da loja; insert/update: só serviço

mensagens                              -- append-only (trigger bloqueia update/delete)
  id uuid pk, conversa_id → conversas (cascade), loja_id (denormalizado p/ RLS e índice),
  papel ('usuario'|'assistente'), conteudo text (≤ limite), 
  provedor text null, modelo text null, tokens int null,
  tarefa_id → agente_tarefas null, criada_em
  unique (conversa_id, tarefa_id, papel)   -- idempotência por turno
  RLS select: mesma regra de conversas

agente_tarefas                          -- um registro por TURNO do agente (execução), não uma fila nova
  id uuid pk, loja_id, conversa_id → conversas null, user_id,
  estado ('executando'|'aguardando_aprovacao'|'concluida'|'falhou'|'cancelada'),
  provedor, modelo, passos int, tokens int, ferramentas text[], 
  erro_codigo text null (sem corpo de erro do provedor),
  idempotency_key text, unique (loja_id, idempotency_key),
  enriquecimento_tarefa_id → enriquecimento_tarefas null,
  aprovacao_id uuid null (→ aprovacoes, quando o #23 estiver aplicado),
  iniciada_em, concluida_em
  RLS select: lojista da loja; editor vê as próprias
```

Máquina de estados do turno (subconjunto formal do ciclo NanoDesk, só o que o chat usa): `executando → concluida | falhou | cancelada`, e `executando → aguardando_aprovacao → concluida` quando o turno gera proposta. Transições validadas por trigger (sem voltar de estado final).

Decisões embutidas:
- **Retenção:** `mensagens` guarda texto de conversa de negócio; propor retenção (ex.: 180 dias, configurável) e exclusão a pedido da loja. **Decisão sua (D2).**
- **Privacidade entre usuários:** por padrão cada usuário vê as suas conversas; o lojista vê todas da loja (auditoria). **Decisão sua (D3).**
- **Conteúdo sensível:** não gravar resultado bruto de ferramenta nem corpo de erro de provedor — só texto da conversa e metadados.
- Depende do #23? Só a coluna `aprovacao_id` (sem FK até a migração do Pair existir). O restante é independente.

## 4. Riscos

| # | Risco | Mitigação |
|---|---|---|
| F1 | Vazamento entre lojas via conversa/mensagem | RLS por `loja_id`; teste SQL cruzado (A não lê B; editor não lê conversa alheia) como o `rls_isolamento.sql` |
| F2 | Custo descontrolado ao trocar de provedor | Modelo vem da chave; limite mensal por chave (já existe); teto de passos/tokens por turno (já existe); sem fallback silencioso |
| F3 | Dado de loja indo para outro fornecedor sem o lojista perceber | Aviso na UI ao trocar; auditoria registra o provedor efetivo por resposta |
| F4 | Consulta ao Bling estourar limite da API / travar o chat | Teto por turno e por loja, timeout curto, fallback no espelho |
| F5 | Preço "ao vivo" divergir do espelho e o modelo apresentar o errado | Saída traz os dois + `consultado_em`; prompt manda citar a origem |
| F6 | Prompt injection via campos do produto | Já tratado como dado; saída da ferramenta sem HTML/URL executável; `propor_*` continua exigindo fonte e aprovação |
| F7 | Registro duplicado em reenvio/queda de rede | `idempotency_key` por turno; `unique` em `agente_tarefas` e `mensagens` |
| F8 | Publicar `assistente` com novos imports quebra (bundling) | F1.0 (gerador + CI + E2E sobre o autocontido) antes de qualquer deploy |
| F9 | Crescimento da tabela de mensagens | Índices `(loja_id, conversa_id, criada_em)`, retenção (D2), paginação |
| F10 | Conversa persistente muda o contrato do endpoint | Atrás de flag; sem flag o comportamento é idêntico ao de hoje |

## 5. Sequência de implantação com recuperação

Cada passo exige sua autorização específica; nenhum foi iniciado.

| Etapa | Entrega | Prova antes de seguir | Reversão |
|---|---|---|---|
| F1.0 | `gerar-autocontido` + verificação de deriva no CI | Autocontido gerado = v5 de produção + gate M6 (diff só nisso) | Remover script/workflow |
| F1.1 | **Seletor** (só `provedor` no `assistente` + UI) — sem tabela | E2E: 3 provedores com *fakes* de rede; provedor sem chave → erro claro; sem fallback silencioso | Flag/UI desligada; republicar v anterior |
| F1.2 | Migração das 3 tabelas **em ambiente de teste** + testes SQL (RLS, append-only, idempotência, estados) | Suíte SQL verde, incluindo cenário cruzado entre lojas | `DROP` do script de rollback (tabelas novas, sem dado legado) |
| F1.3 | Persistência no `assistente` atrás de flag, **desligada** | E2E com flag off = comportamento atual; flag on = turno gravado, reenvio idempotente | Flag off |
| F1.4 | `bling_consultar_produto` com *mock* `test.*` primeiro (regra do projeto), depois Bling real **somente leitura** em uma loja (piloto) | Mock: sucesso, timeout, 429, Bling fora → espelho; real: autorização sua, 1 SKU | Flag da loja off; ferramenta some do prompt |
| F1.5 | Migração em produção + publicação (janela, backup lógico antes) | Fumaça: 401 sem token, 403 editor/decidir, 200 lojista/perguntar, conversa gravada | Flag off → republicar versão anterior → rollback SQL |

Ordem sugerida: **F1.0 → F1.1** podem acontecer logo (sem migração); F1.2+ dependem da sua aprovação deste desenho.

## 6. Decisões que preciso de você

- **D1** — Nomes dos provedores (GPT/Gemini/Claude) visíveis no painel do lojista? (proposta: sim, como já é em *Integrações*)
- **D2** — Retenção das mensagens (proposta: 180 dias).
- **D3** — Visibilidade: cada usuário só as suas, lojista vê todas? (proposta: sim)
- **D4** — `bling_consultar_produto` ligado por loja via `loja_recursos` (proposta) ou global?
- **D5** — Aprova começar por F1.0 + F1.1 (sem migração)?
