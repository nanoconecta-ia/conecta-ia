# Fase B — Nano.IA → Gateway MCP real → agente Windows → PowerShell → chat
**Estado (28/10/2026):** a **migração da fila foi aplicada** no Supabase conecta-ia (`dsfzhsrudriqkumtlqwj`, versão `20261028065432`) com autorização do proprietário. **Nada mais foi publicado:** a Edge Function `conecta-gateway` e o pareamento do PC Mobis seguem pendentes de autorização separada.

### Evidência da aplicação (somente leitura após aplicar)
- 7 funções criadas; o **md5 de cada `pg_get_functiondef` é idêntico** ao do banco local de teste, assim como o md5 dos 5 modelos (`ebb70d20…`).
- Permissões: `anon` e `authenticated` sem EXECUTE e sem SELECT; `service_role` com EXECUTE nas 5 funções públicas; funções `private.*` sem EXECUTE para nenhum papel de API; RLS ligado nas 2 tabelas, 0 policies (acesso só pelas funções).
- Testes sem escrita em produção: sessão inválida → `null` em `puxar` e `resultado`; estado/cancelar de tarefa inexistente; corte de 280 000 bytes de emoji → ≤ 65 536 bytes. Fila vazia (0 tarefas) e nenhuma linha `exec_local.*` em `auditoria`.
- Advisors de segurança: apenas INFO "RLS ativo sem policy" nas 2 tabelas novas (intencional, igual a 8 tabelas existentes); nenhum alerta novo.
- Impacto: os 2 dispositivos existentes são `navegador`; nenhum dado existente foi alterado.
- **Rollback** (sem perda de dado de produto): comandos no fim do arquivo da migração. A fila está vazia.

## 1. Cadeia e o que cada peça faz
1. **Nano.IA / qualquer LLM** chama `tools/call` no Gateway MCP com a chave MCP da loja (já existe).
2. **`conecta-gateway`** (Edge Function) → `tratarMcpComLocal` com `executarInline`: policy, escopo, consentimento, auditoria e evidência (`executor.ts`, já em `main`). Anuncia as ferramentas locais só se há dispositivo `agente_desktop` pareado e ativo.
3. **`runner_db.ts`** (novo): enfileira em `exec_local_tarefas` e espera o resultado; aborta/cancela se a sessão cair; `DESCONHECIDO` nunca é repetido às cegas.
4. **Agente Windows** (`agente.mjs`, já homologado): puxa a tarefa por `POST /dispositivo/proximo`, **revalida** o comando na própria lista, roda o PowerShell, devolve por `POST /dispositivo/resultado`.
5. **`rotas_dispositivo.ts`** (novo): autentica o agente pela **sessão do Conecta Pair** (`pair_validar`), sem criar identidade nova.
6. **Chat**: `apresentacao_chat.ts` (já em `main`) com `ambiente: dispositivo_real` só quando o agente roda em Windows.

## 2. Contrato de pareamento (reaproveita o Conecta Pair)
- Dispositivo = linha de `pair_dispositivos` com `tipo = 'agente_desktop'` e `capacidades` = lista permitida (só ids `windows.*` de consulta).
- O lojista **aprova no painel** (já exige autenticação recente para `agente_desktop`); sessão = `pair_sessoes` com token `<token>.<sal>`, renovável, revogável, com replay detectado.
- O agente recebe o token por **variável de ambiente** (`--token-env`), nunca por argumento, e o mantém só em memória.
- O código de pareamento local da Fase A (`servidor_local.mjs`) **não** vai para produção.

## 3. Fila persistente (`20261029000001_exec_local_fila.sql`, NÃO aplicada)
- Tabela `exec_local_tarefas` (RLS ligado, sem policy, sem grant): `argv` travado por CHECK ao formato `powershell.exe -NoProfile -NonInteractive -NoLogo -Command <≤2000 chars, sem quebra de linha>`; `timeout_ms` 1–60 s; saída ≤ 64 KB; `idempotency_key` única por loja.
- Funções (`security definer`, `search_path=''`, **só `service_role`**): `exec_local_enfileirar` (valida loja, tipo, revogação e capacidade ∈ lista do dispositivo; fila ≤ 20), `exec_local_puxar` (`pair_validar`, `for update skip locked`, lease), `exec_local_resultado` (só o dono, só EM_EXECUCAO e dentro da lease; hash SHA-256 gravado pelo banco), `exec_local_estado`, `exec_local_cancelar`.
- Revogação: dispositivo revogado → tarefas NA_FILA viram `CANCELADA`; sessão revogada → `puxar` devolve `null` (401); lease vencida → `DESCONHECIDO`.
- Auditoria: `public.auditoria` (`exec_local.enfileirada`, `.concluida`, `.falhou`) por `private.pair_auditar`.

## 3b. Revisão técnica do PR (item a item) — corrigida em `1b8d52a`
| # | Alegação | Verificado | Estado |
|---|---|---|---|
| 1 | hash de `saida` pode não corresponder ao valor persistido | **Não procede**: o hash era do valor truncado já persistido. Mas o limite era em **caracteres** (até 262 144 bytes com emoji) | corrigido: teto em **BYTES** (CHECK `octet_length ≤ 65536`), corte em fronteira UTF-8 (`private.exec_local_cortar_bytes`), colunas `saida_truncada` e `saida_bytes_originais`; testes com 1, 2, 3 e 4 bytes/char, 65536 e 65537 bytes, hash do valor exato e prefixo do original |
| 2 | teto em bytes no runner, agente e SQL | **Procede** (runner e rota usavam caracteres) | corrigido: runner corta em bytes (UTF-8, marca `…[truncado]` incluída, `truncada: true`); rota aceita até 420 000 chars de JSON (64 KB escapam até 6×); banco corta em 65536 bytes e sinaliza; auditoria não carrega a saída (teste) |
| 3 | allowlist por capacidade: o CHECK só vê a estrutura | **Procede**: o agente aceitava o modelo de QUALQUER capacidade para um job, e o banco não ligava comando a capacidade | corrigido: tabela `exec_local_modelos` (regex por capacidade, gerada de `capacidades.ts`; teste de deriva) checada em `exec_local_enfileirar`; agente exige `job.capacidade` = capacidade cujo modelo casa. Provado: comando diferente de formato válido, comando de outra capacidade, parâmetro fora do padrão e `\n` são recusados no SQL e no agente |
| 4 | limite de 20 sob concorrência | **Procede, reproduzido**: sem lock, 40 enfileiramentos simultâneos geraram **39** linhas (e 10 erros de índice único na mesma `idempotency_key`) | corrigido: `pg_advisory_xact_lock` por dispositivo antes da checagem; `exec_local_concorrencia.sh` (conexões reais, barreira) dá exatamente 20, 1 linha por chave e 1 única puxada; com `SEM_LOCK=1` o mesmo teste FALHA (prova que ele detecta a corrida); entra no CI |

## 4. Testes (todos locais)
- SQL em Postgres 16 descartável: `supabase/tests/exec_local_fila.sql` — **40 + 19 verificações** (duas suítes) e o script de concorrência real (isolamento por loja e dispositivo, sem dupla retirada, idempotência, CHECK do argv, revogação, lease, limite de fila, privilégios `anon`/`authenticated`, auditoria).
- Node: `scripts/exec-local/agente/faseb.test.mjs` (4) — MCP → fila → rotas → **agente real** → PowerShell falso, recusa no agente de comando fora da lista, revogação por 401, rotas recusam token ausente/malformado. Banco **simulado em memória**: a semântica real é a do SQL acima.
- Suíte `exec_local` (34) segue passando. Lista restrita de comandos preservada (5 consultas; escrita desligada).

## 5. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Servidor comprometido manda comando | CHECK no banco + lista no agente (revalida) |
| Token do agente vaza | só memória/env; sessão curta renovável, revogável; replay revoga a sessão |
| Fila enche/flood | limite 20 por dispositivo, NA_FILA expira em 2 min, rate limit já existente no gateway |
| Resultado duplicado/forjado | só o dono do dispositivo, só EM_EXECUCAO e na lease; segundo resultado é ignorado |
| Timeout vira repetição | `DESCONHECIDO`, nunca volta para a fila |
| Vazamento entre lojas | todas as consultas filtram `loja_id`; teste cobre loja B × A |
| Conteúdo da saída tenta "instruir" o LLM | saída é dado; cartão do chat só mostra trecho citado limpo |

## 6. O que depende de aprovação separada (NÃO feito)
1. **Aplicar a migração** no Supabase de produção (diff acima; rollback no próprio arquivo: `drop function …; drop table public.exec_local_tarefas;` — não afeta dado de produto).
2. **Publicar a Edge Function** `conecta-gateway` com `tratarMcpComLocal` + a rota `/dispositivo/*` (no repositório não há mudança em `gateway.ts`/`index.ts`; a ligação é um PR próprio com diff e rollback = redeploy da versão atual).
3. **Parear** o PC Mobis pelo Conecta Pair (aprovação do lojista no painel, autenticação recente).
4. Rodar a prova real: um inventário de leitura pela cadeia completa, com evidência.

## 7. Limitações
Banco simulado nos testes Node; Postgres local ≠ Supabase (sem `pg_net`/`vault`); polling a cada 250 ms por chamada (aceitável para diagnóstico, não para volume); sem assinatura de código no agente.
