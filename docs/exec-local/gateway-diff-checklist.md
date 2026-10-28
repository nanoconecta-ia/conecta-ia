# conecta-gateway + rotas do agente — diff para revisão (NADA PUBLICADO)
PR em rascunho. Esta etapa **não** publica Edge Function, **não** aplica migração, **não** pareia o PC Mobis e **não** toca Bling/Drive.

## 1. O que muda (mínimo)
| Arquivo | Mudança |
|---|---|
| `supabase/functions/conecta-gateway/index.ts` (+10) | duas rotas do **agente**: `POST …/dispositivo/proximo` e `…/dispositivo/resultado`, antes do OAuth; usa `tratarDispositivo` (só hashes vão ao banco) e `limite_chamada` |
| `_shared/exec_local/rotas_dispositivo.ts` | autenticação pela **sessão do Conecta Pair** (`pair_validar` dentro de `exec_local_puxar/resultado`); limites: 150 req/min por sessão, 20 falhas/min por IP (429); 401 só quando o banco devolve `null` |
| `_shared/exec_local/portas_supabase.ts` (novo) | portas de produção: fila via RPC, dispositivo ativo, auditoria do despacho (só ids e motivo; nunca saída/comando) |
| `supabase/functions/conector-mcp/index.ts` (**função hoje NÃO implantada**) | entrada MCP do LLM com `tratarMcpComLocal` + `executarInline` + só executor `windows` |
| `_shared/exec_local/gateway_local.ts`, `catalogo_mcp.ts` | `fila` opcional; `dispositivo` assíncrono; `executoresAtivos` (browser **não** é anunciado nem aceito em produção) |
| `artifacts/conecta-gateway/*` | artefato autocontido **regenerado** (`gerar-pair.mjs --check` exige); +112 linhas; `pair` inalterado (`6695e1ef…`) |
| `scripts/exec-local/agente/agente.mjs` | intervalo padrão 1 s; 429/5xx → espera e continua (só 401 encerra) |
| `docs/exec-local/rollback/conecta-gateway.v4.prod.index.ts` | cópia exata do que está no ar (v4) para o rollback |

## 2. Incompatibilidades e achados (verificados)
1. **Produção ≠ `main`.** O `conecta-gateway` no ar (v4, `ezbr_sha256 5332a9a7…`, arquivo sha `e4765f13…`, 2 412 linhas) **não é** o artefato da `main` (`6bcef275…`, 2 800 linhas: inclui `reduzirJson`/`ia/reducao.ts` e outras mudanças posteriores). **Publicar este PR leva junto ~390 linhas que já estão na `main` e nunca foram publicadas**, além das 112 desta mudança. Decisão sua: aceitar (testadas no CI) ou reconstruir sobre o v4.
2. **A entrada MCP do LLM (`conector-mcp`) não está implantada**, e o `conecta-gateway` expõe ferramentas por escopo do Pair; **não existe escopo para diagnóstico local** (adicionar exige migração de `pair_escopos_validos()`). Por isso o caminho do LLM foi ligado em `conector-mcp` (apagado em produção hoje) e o `conecta-gateway` só ganha as rotas do agente. Para ativar a cadeia inteira é preciso **ou** implantar `conector-mcp` **ou** criar o escopo (migração).
3. **Falta o cliente de pareamento no agente.** O agente aceita o token do Pair por variável de ambiente (`--token-env`), mas **não implementa** o fluxo `pair` (iniciar → lojista aprova → resgatar). Sem isso o token teria de ser provisionado manualmente. Próximo PR.
4. **Limite × polling:** o agente consultava a cada 300 ms (~200/min) e a sessão aceita 150/min → 429 e desistência. Corrigido (1 s; backoff).
5. **"Online":** `pair_validar` só grava `ultimo_uso_em` a cada 30 s; a janela de "dispositivo ativo" é de **90 s** (não 15 s).
6. **Tipos/assinaturas:** `capacidade` do Pair aceita `^[a-z0-9_.:-]{3,60}$`; os ids `windows.*` casam. `exec_local_*` confere com o código (teste de integração contra o esquema real).
7. Postgres 17 (produção) × 16 (testes): só funções padrão; as 7 funções aplicadas têm md5 **idêntico** ao banco de teste.
8. O wrapper valida a chave MCP e o limite **duas vezes** em `tools/list` (uma no wrapper, outra no `tratarMcp`): custo extra de 1 RPC por chamada; não é falha de segurança.

## 3. Segurança
- Agente: só autentica por sessão do Pair; revogação/replay/loja inativa/usuário sem papel tratados em `pair_validar` (testes SQL + integração).
- Rotas: sem token/malformado/GET/rota desconhecida/corpo > 420 000 → recusado **antes** do banco; falhas por IP limitadas.
- Comando: allowlist **dupla** — banco (`exec_local_modelos`, por capacidade) e agente (modelo da capacidade informada); só as 5 consultas de leitura.
- Auditoria: DB (`enfileirada`/`concluida`/`falhou`) + despacho (`exec_local.despacho.*`: ids e motivo, **sem saída nem comando**); falha de auditoria bloqueia a entrega.
- Nada de segredo no repositório, no log ou na URL; token do agente só em variável de ambiente e memória.

## 4. Testes
- Node: 43 (`exec_local`, inclui 4 de **integração com o esquema real** via `criarPsql`: cadeia completa com as rotas, `dispositivoAtivo`, recusas do banco, revogação) + 22 do agente/runner; suíte completa de funções: **426/426** com Postgres local; `tsc` estrito limpo; `gerar-pair.mjs --check` ok.
- SQL e concorrência: já em `exec_local_fila.sql` (40), `exec_local_saida_modelos.sql` (19) e `exec_local_concorrencia.sh`.

## 5. Plano de publicação (cada passo exige autorização) e rollback
1. **Backup**: já está em `docs/exec-local/rollback/conecta-gateway.v4.prod.index.ts` (sha `e4765f1369c6…35dc`, versão 4, `verify_jwt=false`).
2. Publicar o artefato `artifacts/conecta-gateway/index.ts` (sha `33847cd4…ffa4`) com `verify_jwt=false` (como hoje). Smoke: `POST …/dispositivo/proximo` sem token → 401; com token inválido → 401; JSON-RPC existente (initialize/tools/list com sessão de teste) inalterado.
3. **Rollback (segundos):** republicar o arquivo de backup do v4 com `verify_jwt=false`. A fila e as tabelas ficam (inertes). Se necessário, rollback do banco: bloco no fim de `20261029000001_exec_local_fila.sql` (fila vazia).
4. Parear o PC Mobis (aprovação do lojista no painel), com o agente `--token-env`.
5. Prova real: um inventário de leitura pela cadeia completa, com evidência.

## 6. Checklist de revisão
- [ ] Aceita publicar junto as ~390 linhas da `main` (achado 1) ou prefere reconstruir sobre o v4?
- [ ] Caminho do LLM: implantar `conector-mcp` ou criar escopo no Pair? (achado 2)
- [ ] Autoriza o cliente de pareamento do agente (achado 3) como próximo PR?
- [ ] Autoriza **publicar** `conecta-gateway` (plano §5)? — não feito.
- [ ] Autoriza **parear** o PC Mobis? — não feito.
