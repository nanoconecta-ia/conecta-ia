# Relatório de validação e preparação — PRs #23 e #24 (2026-10-18)

Escopo autorizado: validação local e planejamento. **Nada foi mergeado, publicado, migrado, nem escrito em produção ou no Bling.**
Os PRs #23 e #24 continuam separados e em rascunho; a integração abaixo foi feita só num worktree local descartável (`local/integracao-23-24`, nunca enviado).
Leituras em produção feitas: `list_edge_functions` e `get_edge_function(assistente)` (somente leitura).

## 1. CI do PR #24

| Consulta | Resultado |
|---|---|
| Check runs do PR #24 | **0** |
| Workflow runs na branch `claude/aprovacao-so-lojista` | **0** |

**Causa (não é falha):** a `main` só tem `painel-pages.yml`, que roda apenas em *push* na `main` (e faz deploy no GitHub Pages). Os workflows com testes (`funcoes-testes.yml`, `painel-ci.yml`) estão no PR #23. Logo, o #24 **não tem CI nenhum** enquanto o #23 não entrar na `main`.

Consequência prática: o único CI verde que existe vale para o #23 (3 checks no commit `65ac98c`). Para o #24 a evidência é a local (seções 2 e 3). Depois do merge do #23, atualizar a branch do #24 com a `main` dispara os 3 checks nele.

## 2. Integração local #23 + #24 (sem merge no GitHub)

Merge no worktree: **limpo, sem conflito** (o #24 toca 4 arquivos; nenhum coincide com os 47 do #23).

| Verificação na árvore integrada | Resultado |
|---|---|
| Testes das funções (node), 14 arquivos | **14/14 ok** — inclui `assistente.test.ts` (que falha na `main`) e `permissao.test.ts` |
| Suítes SQL (`rodar_local.sh`) | **17/17 ok** (Pair: 176 verificações) |
| Painel: `tsc --noEmit` | ok |
| Painel: testes | 9 pass / 0 fail |
| Painel: build com e sem `VITE_PAIR_ATIVO=1` | ok / ok |

Observação: o item 13 de `docs/conecta-pair/README.md` §7 (editor aprova pela Fila) fica **desatualizado** quando o #24 entrar — ajustar o texto no mesmo momento.

## 3. Correção M6 por papel (backend real + frontend)

Backend: função `assistente` original (Deno) + PostgREST + Postgres 16 com **todas** as migrações da árvore integrada. Arquivo de evidência: `scratchpad/e2e/resultado-integrado-m6.txt` — **16/16**.

| Papel | Ação | Esperado | Obtido |
|---|---|---|---|
| Editor | aprovar enriquecimento | 403, item intacto | 403, `a_confirmar` |
| Editor | rejeitar enriquecimento | 403 | 403 |
| Editor | aprovar imagem | 403, `aprovada=false` | 403, `f` |
| Editor | PATCH direto na tabela (REST) | negado | ≥400 |
| Editor | perguntar/consultar | continua funcionando | 200 |
| Lojista | aprovar / rejeitar enriquecimento | 200 + auditoria com o user dele | ok |
| Lojista | aprovar imagem | 200 | ok |
| Lojista de **outra** loja | decidir item/imagem da loja A | 404 | 404 |
| Autenticado **sem vínculo** | decidir item / imagem | negado | 404 / 404 |
| Sem login | decidir | 401 | 401 |
| Token inválido | decidir | 401 | 401 |

Frontend (Chromium, 390 px, build integrado; `scratchpad/e2e/resultado-ui-papeis.txt`):

| Papel | Botões Aprovar/Rejeitar | Aviso |
|---|---|---|
| Editor | 4/4 desabilitados | visível |
| Lojista | 4/4 habilitados | oculto |
| Falha na checagem de permissão (RPC 401) | 4/4 desabilitados (**fail-closed**) | visível |

Limite honesto: o frontend usa rotas simuladas para o papel; a prova do backend é a que vale (a UI é só conveniência — o gate real é o 403 da função).

## 4. Plano de validação do M5 (claim `amr` + token opaco + `verify_jwt=false`)

**Por que não dá para fechar aqui:** o sandbox não alcança `*.supabase.co` (proxy recusa) e não tem daemon Docker. Tudo o que o Pair prova hoje usa o *stub* de `auth.jwt()`.

### O que precisa ser provado
| ID | Pergunta | Experimento | Aprova se | Se reprovar |
|---|---|---|---|---|
| M5-1 | O JWT real do GoTrue traz `amr` como lista de `{method, timestamp}` com `timestamp` inteiro (epoch s)? | Login por senha num ambiente de teste; decodificar o JWT; chamar `private.autenticacao_recente(300)` por RPC | `amr[].timestamp` numérico e a função devolve `true` logo após o login | Ajustar o parser em `autenticacao_recente` ao formato real |
| M5-2 | O `timestamp` **muda** depois de refresh de token? | Refresh sem novo login; repetir M5-1 após > 5 min | `timestamp` **não** avança (reconfirmação exige novo login) — é o comportamento desejado | Se avançar, a reconfirmação ficaria burlável: trocar por nonce de reconfirmação próprio |
| M5-3 | Usuário Google/OAuth e usuário com MFA: como aparece no `amr`? | Login por OAuth de teste e por TOTP | Sabe-se qual `method` aparece e se dá para reconfirmar | Definir fluxo de reconfirmação para OAuth (re-login Google) antes de ligar HIGH/CRITICAL a esses usuários |
| M5-4 | Edge Function com `verify_jwt=false` aceita `Authorization: Bearer <token>.<sal>` (não-JWT, 1 ponto)? | Função mínima `eco` com `verify_jwt=false`; chamar com bearer opaco, sem bearer, com `apikey` só | 200 e o cabeçalho chega intacto à função | Mandar o token em `x-conecta-token` (e manter `Authorization` livre), ou emitir token em formato JWT assinado pela própria função |
| M5-5 | A mesma função com bearer **JWT inválido/expirado** (`verify_jwt=false`) segue passando? | Chamar com JWT vencido | Passa (a função decide) | Documentar e tratar na função |
| M5-6 | CORS/preflight e tamanho de cabeçalho | `OPTIONS` + bearer de ~100 e ~3000 chars | sem rejeição | Reduzir/mover o token |
| M5-7 | `verify_jwt=true` continua negando chamadas sem JWT em `assistente` | Chamada sem/ com bearer opaco | 401 do gateway | — |

### Onde executar (do mais barato ao mais caro)
1. **CI do GitHub (gratuito para o repo, sem tocar no Supabase):** job `m5-supabase-local` com `supabase start` (Docker já existe no runner `ubuntu-latest`) — sobe GoTrue, PostgREST e edge-runtime **reais** localmente, aplica as migrações e roda M5-1…M5-7. Cobre quase tudo; o que não cobre é o *gateway* de nuvem (M5-4/M5-7 no edge da plataforma).
2. **Máquina do dono com Docker:** mesmo roteiro, `supabase start`.
3. **Projeto Supabase descartável no plano gratuito:** só para M5-4/M5-7 (gateway de nuvem). Exige sua autorização e checagem do limite de projetos da organização.
4. **Branch do Supabase:** **gera custo** — não criar sem autorização expressa.

Entrega proposta (precisa de autorização para commitar workflow): `.github/workflows/m5-supabase-local.yml` (manual, `workflow_dispatch`) + `supabase/tests/m5/*.mjs`. Nenhum segredo de produção; tudo contra o stack local do runner.

## 5. Procedimento de publicação da função `assistente` (anti-bundling)

### O que a leitura de produção mostrou
- `assistente` em produção: **v5**, `verify_jwt=true`, `import_map=false`, `ezbr_sha256=805dabfb…58fba1`, **arquivo único `index.ts` autocontido** (~25 KB).
- O cabeçalho do arquivo documenta a causa: o bundler da plataforma falhou com *"module not found"* **no primeiro `import` relativo de `_shared/*`**, em deploys multi-arquivo repetidos, independentemente do arquivo. A fonte modular do repo (`assistente/index.ts` + `_shared/*`) **não é o que está no ar**.
- **Consequência para o PR #24:** o `assistente/index.ts` do repo agora importa `../_shared/assistente/permissao.ts`. Publicar esse arquivo como está **reproduz o problema** (ou, pior, uma versão que quebra o chat do lojista). Isso vale já hoje para qualquer deploy da fonte modular.
- A cópia autocontida é mantida à mão → risco de deriva (A3 da auditoria, mesmo padrão do `bling-sync`).

### Procedimento recomendado (nada disso foi executado)
0. **Pré-condição:** autorização expressa sua para publicar.
1. **Âncora de rollback:** salvar a fonte da v5 (`get_edge_function`) em arquivo versionado fora do repo de produção + registrar `ezbr_sha256`. Rollback = republicar esse arquivo (vira v6 com o conteúdo da v5; a plataforma não "desfaz" versão).
2. **Gerar o autocontido por script, não à mão:** `scripts/gerar-autocontido.ts` que concatena `_shared/*` na ordem de dependência (como o cabeçalho de seções `// ---------- _shared/x.ts ----------` que a v5 já usa), remove `import` relativos e `export`. O CI compara o autocontido gerado com o último publicado (acusa deriva).
3. **Diferença mínima esperada para o M6** no autocontido: (a) incluir `MSG_SO_LOJISTA` + `podeDecidir` (≈10 linhas, seção `_shared/assistente/permissao.ts`); (b) a linha do gate antes dos blocos `decidir`/`decidir_imagem`. Mais nada deve mudar — qualquer outra diferença entre fonte modular e v5 é deriva a investigar **antes** de publicar.
4. **Prova offline do artefato que será publicado:** rodar o E2E de M6 (`e2e3.mjs`/`e2e4.mjs`) contra **o arquivo autocontido** (não contra a fonte modular) — 16/16 antes de publicar. `deno check` do arquivo e `deno info` mostrando zero imports locais.
5. **Publicar com `verify_jwt=true`** (mantém a v5) usando um único arquivo; conferir `version` = 6 e `verify_jwt` inalterado na resposta.
6. **Fumaça pós-publicação (sem escrever dados):** (a) chamada sem token → 401; (b) editor tenta `decidir` → 403; (c) lojista `perguntar` → 200. Se (c) falhar ou o log mostrar erro de módulo: **rollback imediato** (passo 1).
7. **Janela:** fora do horário de uso; o `assistente` não tem estado, então não há migração de dados envolvida.
8. Ordem relativa às migrações: **independente** (M6 não depende de SQL novo). Pode sair antes ou depois do Pair.

## 6. Reuso e desenho da Fase 1

Ver `docs/validacao-2026-10-18/FASE-1-DESENHO.md` (mapa do que já existe, tabelas, ferramenta Bling, seletor de modelo, riscos e sequência com recuperação). **Aguarda sua aprovação antes de qualquer migração** (regra do CLAUDE.md).

## 7. Riscos consolidados

| # | Risco | Mitigação |
|---|---|---|
| R1 | #24 sem CI até o #23 entrar | Evidência local acima; merge do #23 primeiro |
| R2 | Publicar `assistente` modular quebra o chat (bundler) | Autocontido gerado por script + E2E sobre o artefato + rollback v5 |
| R3 | `amr` real diferente do assumido | M5-1…3 antes de ligar HIGH/CRITICAL |
| R4 | Bearer opaco barrado pela plataforma | M5-4 antes de publicar `pair`/`conecta-gateway` |
| R5 | Usuário Google não reconfirma | Definido em M5-3; até lá HIGH/CRITICAL só para quem tem senha |
| R6 | Dois PRs editam `docs/conecta-pair/README.md` §7 | Ajustar o item 13 no merge do #24 |

## 8. Sequência de implantação com recuperação (tudo sujeito à sua autorização por etapa)

| Etapa | Ação | Reversão |
|---|---|---|
| 1 | Revisar/aprovar #23; **merge do #23** | `git revert` do merge; nada em produção ainda |
| 2 | Atualizar #24 com a `main` → CI roda; merge do #24 | `git revert` |
| 3 | Rodar M5 no stack local (CI) | descartável |
| 4 | Gerar `assistente` autocontido + provar offline | descartável |
| 5 | Publicar `assistente` (v6) | republicar v5 salva |
| 6 | Aplicar migração do Pair em **ambiente de teste** (não produção) | `ROLLBACK` incluído na migração; recriar o ambiente |
| 7 | Aplicar migração do Pair em produção (janela, backup lógico antes) | script de rollback da migração; funções do Pair ainda não publicadas = sem efeito |
| 8 | Publicar `pair` e `conecta-gateway` (verify_jwt=false) | despublicar/desativar; flag `VITE_PAIR_ATIVO` desligada no painel |
| 9 | Ligar `VITE_PAIR_ATIVO=1` no painel | desligar a flag |
| 10 | Fase 1 conforme desenho aprovado | por etapa, no próprio documento |
