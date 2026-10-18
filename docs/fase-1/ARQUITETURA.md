# Fase 1 — arquitetura revisada (v2, após D1–D5)

**Status: PROPOSTA para aprovação. Nada foi aplicado, publicado, conectado ou escrito em produção/Bling.**
Substitui a v1 deste documento e o desenho de `docs/validacao-2026-10-18/FASE-1-DESENHO.md`, que previam `agente_tarefas` e leitura do lojista por RLS — ambos contrariam as condições das decisões D1–D5.
Trabalho já feito em paralelo e revisado aqui: **#26** (gerador do `assistente` autocontido + seletor), **#27** (workflow M5), **#28** (doc do Pair). Esta proposta **não os duplica**.

## 0. Critério de conclusão do marco
Usuário → Chat do Conecta.IA → **GPT real** → `bling_consultar_produto` → **Bling real (GET)** → resposta com os dados → **histórico e auditoria persistentes**. Resposta simulada não conta. Distinção REAL × SIMULADO está na §6.

## 1. Como cada decisão é atendida

| Decisão | Atendimento | Onde |
|---|---|---|
| D1 seletor GPT/Gemini/Claude com 3 estados, sem tabela desnecessária | Implementado no **#26** sobre `loja_chaves_ia`/`ia_chave_ativa`/adaptadores. Nenhuma tabela | #26; E2E §8 |
| D2 retenção 180 dias, configurável, exclusão controlada, LGPD; auditoria com política própria | `lojas.chat_retencao_dias` (coluna, 7–730, padrão 180); `conversas.expira_em`; `chat_excluir` (titular), `chat_expurgar` (prazo), `chat_definir_retencao` (auditada). Auditoria **não recebe conteúdo** e segue imutável | migração v2 |
| D3 cada usuário vê as suas; lojista só por permissão administrativa explícita e auditada; nada cruza lojas | RLS: **só o dono** (nem o lojista). Leitura alheia só por `chat_ler_como_administrador`: exige lojista **+ recurso `chat_leitura_administrativa` ligado + motivo ≥ 10 caracteres** e grava trilha (quem, de quem, motivo, nº de mensagens). Chaves compostas `(conversa_id, loja_id)` | migração v2 |
| D4 `bling_consultar_produto` por loja, só leitura, registry, origem API × espelho | Recurso `chat_consulta_bling` (desligado) impede **anúncio e execução**; §5 | §5 |
| D5 gerador autocontido + seletor, sem publicar | #26 (CI verde); validação independente na §8 | #26 |

## 2. Inventário: reutilizar × criar

| Necessidade | Existe | Decisão |
|---|---|---|
| Provedores, chaves, limite, modelo | `_shared/ia/*`, `loja_chaves_ia`, `ia_chave_ativa`, `ia_registrar_uso`, tela *Integrações* | Reusar (#26 já usa) |
| Seletor e estados | `_shared/assistente/provedores.ts`, `painel/src/lib/provedores.ts`, `Assistente.tsx` (#26) | Reusar |
| Empacotar o `assistente` | `scripts/gerar-autocontido.mjs`, `artifacts/assistente/*`, `fase1-preparacao.yml` (#26) | Reusar |
| M5 (amr, bearer opaco, verify_jwt) | `m5-supabase-local.yml`, `scripts/m5/*` (#27) | Reusar |
| Registry/Policy do Bling | `bling_ferramentas.ts` (`bling.produtos.obter` LOW, `ativa:true`) | Reusar |
| Chamada e token do Bling | `bling_api.ts`, `bling_token.ts`, `bling_armazem.ts`, `private.bling_credenciais` | Reusar |
| Espelho / saúde da conexão | `produtos`, `bling_conexoes` | Reusar (fallback) |
| Flags por loja | `recursos_plataforma` + `loja_recursos` | Reusar (3 linhas de dados) |
| Auditoria | `auditoria` (imutável por trigger) | Reusar para metadados |
| Limite de taxa | `limite_chamadas` (#23) | Reusar quando o #23 entrar |
| Conversas e mensagens | — | **Criar 2 tabelas** (§3) |
| Registro do turno / `agente_tarefas` | — | **Não criar** (§3) |

## 3. Demonstração de que as existentes não bastam (e de que `agente_tarefas` sobra)

| Candidata | Por que não serve para conversas |
|---|---|
| `auditoria` | Tem trigger que **bloqueia UPDATE e DELETE** → impossível exclusão LGPD e expurgo por prazo; exigiria guardar texto de usuário num log que deve ser imutável e sem conteúdo (D2 pede política **distinta**); sem autoria por conversa/paginação |
| `enriquecimento_tarefas/execucoes` | `produto_id NOT NULL`: são tarefas **de produto**; um turno de chat não é isso |
| `aprovacoes` (#23) | Fluxo de proposta→decisão com hash e imutabilidade; não é histórico de conversa |
| `notificacoes` | Avisos únicos por `chave`; sem autoria nem sequência |
| `loja_plugins`, `bling_*`, `sync_*` | Domínios diferentes |

⇒ **`conversas` + `mensagens` são necessárias**: autoria, ordenação/paginação, idempotência por pergunta, retenção/exclusão e visibilidade por usuário não cabem em nenhuma tabela atual.
⇒ **`agente_tarefas` é descartada**: o que ela guardaria (provedor, modelo, id de resposta do provedor, tokens, passos, ferramentas, desfecho, erro) cabe **na própria linha do assistente em `mensagens`**, e a trilha de cada ferramenta continua na `auditoria` existente. Menos uma tabela, menos uma superfície de RLS. O que se perde: estado "em execução" persistido — mitigado porque uma pergunta sem resposta é detectável e o reenvio com a mesma chave a reprocessa.

## 4. Arquitetura e fluxo

```
Painel (Assistente.tsx, #26)  ── JWT ──►  assistente (verify_jwt=true; publicado como UM arquivo autocontido, gerador do #26)
  { loja_id, conversa_id?, texto, provedor, idempotency_key, consentimento }
   1 autentica; loja visível ao JWT (RLS)
   2 recurso `chat_persistente`? ─ sim ─► chat_iniciar(): conversa + pergunta (idempotente por loja+chave)
        └ reenvio da MESMA chave com resposta gravada ⇒ devolve a gravada; não chama o provedor de novo
   3 provedor explícito ⇒ ia_chave_ativa(loja, provedor); sem chave/limite ⇒ erro claro; NUNCA troca de fornecedor
   4 conversar(adaptador, ferramentas) — o núcleo não sabe qual provedor responde
   5 ferramenta ► Policy do registry ► execução com a LOJA DO JWT ► trilha em `auditoria` (antes de devolver o dado)
   6 chat_responder(): resposta + evidências + chamadas + resposta_id_provedor + simulado=false/true + desfecho
```
Desfechos: `ok | aguarda_aprovacao | falhou` (falha grava só `erro_codigo`, nunca corpo do provedor).

## 5. `bling_consultar_produto`
- **Entrada** `{ sku }`. O `bling_id` é resolvido por `produtos(loja_id, sku)` **dentro da loja do JWT**; o modelo não informa loja nem id → consulta cruzada é impossível por construção.
- **Gate:** recurso `chat_consulta_bling` ligado **na execução** (não só no anúncio); papel com acesso à loja (editor pode consultar; é leitura). Registry: `buscarFerramenta("bling.produtos.obter")` + `podeExecutar` (LOW, `ativa:true`).
- **Execução:** `obterAccessToken(loja)` → `blingFetch GET /produtos/{id}` (`enable-jwt: 1`, só servidor); timeout ≈ 8 s, 1 recuo; máx. 3 consultas/turno; teto por loja.
- **Saída:** `{ sku, nome, preco, estoque, situacao, origem: "bling_ao_vivo"|"espelho", consultado_em, status_http, sincronizado_em, divergencias[] }`. Sem custo, fornecedor, `bling_id`, token.
- **Origem honesta:** `bling_ao_vivo` **somente** após resposta 2xx válida; erro/timeout/429 ⇒ `espelho` com *"Consulta ao Bling indisponível; usando o último dado sincronizado em {timestamp}"* ou dado ausente. Nunca inventa.
- **Auditoria fail-closed:** grava `bling.consulta` (sku, origem, status) **antes** de devolver o dado; se a gravação falhar, a ferramenta devolve erro e o dado não chega ao modelo.
- **Sem escrita:** só GET; ferramentas de escrita seguem `ativa:false`. Conteúdo do Bling é **dado**, nunca instrução.

## 6. REAL × SIMULADO
| Elemento | REAL quando | SIMULADO quando |
|---|---|---|
| GPT | `mensagens.resposta_id_provedor` não nulo (id devolvido pela OpenAI), `modelo` devolvido, `tokens` do `usage`, `provedor_base = api.openai.com`, `simulado=false` | fake de teste (variável de ambiente que **não existe em produção**) ⇒ `simulado=true` |
| Bling | `chamadas[].origem = "bling_ao_vivo"`, `status_http=200`, `consultado_em`, hash do corpo | mock `test.*` ⇒ `origem="simulado"` |
O E2E exibe esses campos no relatório com rótulos **REAL** / **SIMULADO**, e um **controle negativo** (mesmo roteiro com fakes) tem que **falhar** o critério.

## 7. Migração v2 (`migracao-proposta/`, **não aplicada**)
Objetos: `lojas.chat_retencao_dias` (coluna), `conversas`, `mensagens` (append-only por trigger; resposta única por pergunta por índice; CHECK amarra `usuario`×`assistente`), 3 linhas em `recursos_plataforma`, `private.recurso_ativo`, `chat_iniciar`, `chat_responder`, `chat_excluir`, `chat_expurgar`, `chat_definir_retencao`, `chat_ler_como_administrador`. Funções do servidor só para `service_role`; as de titular/administrador para `authenticated` com checagem interna.
**Evidência local** (Postgres 16 + todas as migrações atuais): aplica sem erro; `teste_fase1.sql` **42/42**; rollback deixa 0 objetos; reaplicável. Cobre idempotência, reenvio sem custo, fronteira entre lojas (chave composta), imutabilidade, "lojista não vê a conversa do editor", leitura administrativa (recurso off/on, motivo, editor, outra loja), exclusão pelo titular, retenção, expurgo e auditoria sem conteúdo.
A v1 (3 tabelas, lojista via RLS) foi **descartada**; o teste da v1 achou um bug (SELECT INTO zerando variável) que não existe na v2.

## 8. Validação independente já feita sobre #26/#27 (sem alterar esses PRs)
- Gerador reproduzível em Node 22 e 24: `--check` ok; **21/21** testes do artefato; **zero** imports locais.
- **Artefato gerado rodando em Deno real + PostgREST + Postgres 16 (RLS real): 29/29** — editor 403 / lojista 200 / outra loja 404 / sem login 401 / token inválido 401; `provedores` por papel e por loja sem vazar segredo; provedor não configurado → 409; fora do enum → 400; limite mensal → 429 (ramo realmente exercitado); chave ilegível → 502 sem trocar de provedor; `sem_ia` responde local.
- Interface a 390 px: 3 estados (disponível / não configurado / indisponível), envio bloqueado até consentir, "Resumo local" sem consentimento, falha de leitura fecha o envio, sem rolagem horizontal.
- CI (#26 e #27): jobs `artefato-seguranca` e `painel` verdes; #27 acrescenta as guardas M5.
- Lacunas que **permanecem**: equivalência com a **v5 publicada** (sem fonte local para `diff`; comparar após `supabase functions download assistente` por quem tiver acesso); M5 real (Docker indisponível aqui; workflow só dispara após existir na branch padrão); GPT/Bling reais.

## 9. Riscos
| # | Risco | Mitigação |
|---|---|---|
| 1 | Sem chave OpenAI na Mobis hoje (`loja_chaves_ia` vazia) | Você cadastra em *Integrações*; eu não manuseio o segredo |
| 2 | Adaptador OpenAI envia `max_tokens`; modelos novos podem exigir `max_completion_tokens` | **Não verifiquei** na documentação; 1 chamada real sem ferramenta antes de tudo |
| 3 | Adaptador descarta `id`/`model` da resposta | Mudança pequena + teste (necessária para a prova REAL) |
| 4 | Dados da loja enviados à OpenAI | Consentimento explícito (já no #26), recurso por loja, só campos necessários |
| 5 | Rate limit do Bling | Teto por turno/loja, timeout curto, fallback |
| 6 | Conteúdo pessoal em mensagens | Retenção 180 d, exclusão do titular, auditoria só com metadados, leitura administrativa auditada |
| 7 | Artefato ≠ v5 em produção | Comparação por download autorizado + E2E no artefato + rollback v5 |
| 8 | Reprocessar pergunta em voo concorrente | Índice único de resposta por pergunta; o segundo `chat_responder` falha com 23505 |

## 10. Decisões que ainda preciso de você
- **D6** — `chat_leitura_administrativa`: ligar por loja pelo próprio lojista, ou só pela plataforma (super admin)? (proposta: pela plataforma, por ser exceção à privacidade)
- **D7** — Escopo do gateway (#23) para a consulta ao vivo (`produtos:ler_ao_vivo`): fica fora deste marco; só o chat consulta o Bling agora.
- **D8** — Prazo de retenção da **auditoria** (política própria exigida em D2): proposta de 5 anos para trilhas de acesso/decisão, sem conteúdo; confirmar com seu contador/jurídico.
