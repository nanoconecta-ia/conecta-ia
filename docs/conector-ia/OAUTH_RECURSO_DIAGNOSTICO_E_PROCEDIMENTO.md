# OAuth com recurso (migração 20261103000002) — diagnóstico de compatibilidade e procedimento seguro

> Data: 2026-11-02. **Nada foi aplicado em produção por este documento.** Todas as provas abaixo foram feitas em Postgres descartável (local) ou por consulta só de leitura ao projeto `dsfzhsrudriqkumtlqwj`.

## 1. Consumidores das funções (repositório + produção)

**Código publicado**: conecta-gateway v5, assistente v20, conector-mcp v3 (lidos de produção e procurados por nome de função); versões históricas do assistente (14, 15, 18) também. **Banco**: busca por nome no corpo de funções, views, gatilhos e `pg_depend` (consulta de leitura).

| Função alterada | Quem chama (produção) | Como chama | Dependentes no banco |
|---|---|---|---|
| `oauth_pair_iniciar` | só `conecta-gateway` v5 (`index.ts`) | RPC, 8 argumentos nomeados | **nenhum** (sem view, gatilho nem outra função) |
| `agente_chamada_registrar` | `assistente` (v14/15/18/20) e `conector-mcp` v3, via `despacho.ts` | RPC, 13 argumentos nomeados | **nenhum** |
| `pair_validar` | `conecta-gateway` v5; `conector-mcp` v3 (porta do agente local) | RPC | `pair_renovar`, `exec_local_puxar`, `exec_local_resultado` (mantêm a assinatura; passam pela nova validação) |
| `oauth_pair_trocar`, `oauth_pair_detalhe`, `pair_escopos_validos` | via `conecta-gateway`/painel | RPC | nenhum além do acima |

Nenhuma view, gatilho ou dependência registrada impede o `DROP FUNCTION` das duas funções recriadas (consulta a `pg_depend` vazia).

**Produção bate com o banco de teste**: as definições (`md5` de `pg_get_functiondef`) das 6 funções existentes em produção são **idênticas** às do banco local montado só com as migrações do repositório. As permissões (ACL) também, com uma exceção irrelevante: em produção `oauth_pair_detalhe` é executável também pelo `service_role` (padrão do Supabase); como a migração usa `CREATE OR REPLACE` nela, a ACL de produção é preservada.

## 2. Compatibilidade das assinaturas e permissões (testado)
- `oauth_pair_iniciar`: nova assinatura com 9º parâmetro **com padrão** → chamada antiga de 8 argumentos continua válida (teste "chamada antiga").
- `agente_chamada_registrar`: 14º parâmetro com padrão → chamada antiga de 13 argumentos continua válida (teste dedicado).
- `pair_validar`, `oauth_pair_trocar`, `oauth_pair_detalhe`, `pair_escopos_validos`: mesma assinatura (`CREATE OR REPLACE`, ACL preservada).
- **Permissões**: toda função nova ou recriada tem `REVOKE ... FROM PUBLIC, anon, authenticated` explícito e `GRANT` só ao `service_role` (conferido por ACL após aplicar: `{postgres=X, service_role=X}`). Atenção: o Supabase concede EXECUTE por padrão a `anon/authenticated/service_role` em função nova; por isso o `REVOKE` explícito é obrigatório e deve ser **reconferido em produção depois de aplicar**.

### Ordem de publicação (comportamento medido por leitura do código)
| Situação | Resultado |
|---|---|
| Migração aplicada, código **antigo** (v5/v20/v3) | tudo funciona (provado acima) |
| Código **novo** publicado **antes** da migração | `conecta-gateway` novo envia `p_recurso` sempre → função inexistente → **todo OAuth devolve 503**; `assistente`/`conector-mcp` novos enviam `p_pair_sessao` sempre → **o registro de auditoria falha em silêncio** (`auditoria_falhou`), mesmo sem OAuth |
| Qualquer redeploy de `assistente` ou `conector-mcp` a partir da `main` **hoje** | cai no caso acima: a `main` já está à frente do esquema de produção |

**Conclusão**: a migração precisa entrar **antes** de qualquer novo deploy dessas três funções, e a `main` não deve ser republicada antes disso.

## 3. Transação e atomicidade (provado)
Ensaio em banco com todas as migrações **menos** esta (`psql -1`, uma transação):
1. Arquivo + um comando que falha no fim (`select 1/0`) → erro, e o estado ficou **idêntico** ao anterior (definições, ACLs, colunas): rollback total.
2. Aplicação limpa → sucesso; as 2 colunas novas e a função nova existem; ACLs corretas.
3. Suítes depois de aplicada: `oauth_recurso_mcp` 27 verificações, `oauth_agente` 44, `conecta_pair` 182 — todas ok.
Lock/duração: `ADD COLUMN ... DEFAULT <constante>` é só de metadados (PostgreSQL ≥ 11; produção usa 17); tabelas pequenas (`pair_sessoes`: 2 linhas, nenhuma ativa). Risco de bloqueio: desprezível.

## 4. Rollback (provado) — `docs/conector-ia/OAUTH_RECURSO_REVERSAO.sql`
- Transação única; **aborta** se houver sessão OAuth ativa do `conector-mcp` (testado: com uma sessão ativa o script foi bloqueado e nada mudou; após revogar, rodou).
- Restaura as 7 definições anteriores, recria as duas funções com as assinaturas antigas e remove função e colunas novas.
- Prova: estado depois da reversão **idêntico** ao anterior à migração (mesmo `md5` das definições e mesmas ACLs); suítes antigas depois da reversão: `oauth_agente` 44, `conecta_pair` 182, `exec_local_fila` 40 — ok. Reaplicar depois de reverter gera o mesmo estado da primeira aplicação.
- Não apaga auditoria já gravada; só perde o vínculo da coluna `pair_sessao_id` (as chamadas continuam registradas).

## 5. Fluxo oficial de migrations — análise
- **O que o projeto documenta**: `apply_migration` do Supabase, uma migração por vez, na ordem; **nunca `db push` genérico** (os nomes/versões remotos diferem dos arquivos locais; ex.: `cadastro_mestre_origem_nf` está como `20261102131719` em produção e `20261102000001` no repositório).
- **`db push` pela CLI**: exigiria a senha do banco (não há segredo para isso no GitHub; só `SUPABASE_ACCESS_TOKEN`) e o histórico remoto desalinhado a tornaria arriscada. **Não recomendado.**
- **Por que o `apply_migration` travou**: o servidor pediu uma confirmação que eu não vejo (duas tentativas, 60 s cada, sem resposta). **Hipótese não confirmada**: o `DROP FUNCTION`. Indício: todas as migrações que apliquei por esse caminho hoje (tabelas, colunas, gatilhos, `CREATE OR REPLACE`) passaram sem pergunta; esta é a única com `DROP`.

### Recomendação: tornar a migração só de expansão (sem `DROP`) — padrão expandir/contrair
Mudanças propostas (ainda **não implementadas**; dependem do seu aval porque alteram o PR já mergeado):
1. Manter `oauth_pair_iniciar` (8 argumentos) e `agente_chamada_registrar` (13) **intactas**.
2. Criar funções novas com outro nome: `oauth_pair_iniciar_recurso` (9 argumentos) e `agente_chamada_registrar_sessao` (14).
3. O código só chama as novas quando necessário: `conecta-gateway` usa `oauth_pair_iniciar_recurso` apenas para o recurso `conector-mcp`; `despacho.ts` usa `agente_chamada_registrar_sessao` apenas para sessão OAuth. **Efeito colateral bom**: a ordem deixa de importar para os caminhos antigos (chat, chave MCP, OAuth do gateway): o código novo é compatível com o esquema antigo e vice-versa.
4. Sem `DROP` → muito provavelmente sem confirmação interativa. **Não garantido**: só se confirma ao tentar.
5. Fase "contrair" (remover as funções antigas) só depois, com ordem separada.
Fallback se ainda houver confirmação: aplicar o mesmo arquivo no editor SQL do painel do Supabase (dentro de `begin; … commit;`), com você vendo a pergunta.

## 6. Plano de testes de autenticação (separar sintético, local, homologação, real)
| Teste | Nível | Estado |
|---|---|---|
| Recurso cruzado nos dois sentidos (`pair_validar` recusa token do MCP; `oauth_validar_para_recurso` recusa token do gateway) | SQL local | **feito** (27 verificações) |
| Escopos: `mcp:*` só no recurso MCP; antigos só no gateway; pedido com todos os escopos concede só os do recurso; escopo desconhecido recusado | unidade + SDK MCP real em loopback | **feito** (oauth.test 11, `oauth-mcp-sdk`) |
| Revogação, expiração, duração vencida, perda de papel, rotação de refresh, isolamento entre lojas | SQL local | **feito** |
| Auditoria por sessão e compatibilidade das chamadas antigas | SQL local | **feito** |
| Descoberta (`oauth-protected-resource` do conector-mcp, `resource_metadata` no 401) | unidade | **feito**; em produção depois do deploy (chamada pública, sem credencial) |
| Fluxo completo com cliente OAuth sintético contra o projeto real | homologação | **pendente** |
| Cliente real (ChatGPT/Claude), leitura do CI000016, sem Bling | real | **pendente** (plano e liberação do provedor não verificados) |

Conferências **depois** de aplicar (somente leitura): colunas e função novas existem; ACLs das funções novas só com `service_role`; `list_migrations` registra a migração; advisors de segurança sem novo alerta; contagem de sessões inalterada.

## 7. Procedimento seguro de execução (portões)
1. **Portão A** — você aprova o desenho "sem DROP" (seção 5) **ou** escolhe o editor SQL com o arquivo atual. Se aprovar, eu preparo o PR, repito as provas locais (transação, reversão, suítes) e peço nova revisão.
2. **Portão B** — confirmar que `main` não será republicada até a migração entrar (risco da seção 2).
3. Aplicar a migração (uma vez). Reconferir o estado em leitura (lista acima).
4. Só então: `conecta-gateway` (fluxo de deploy já pronto em `ci/deploy-conecta-gateway`, com cópia do código atual e prova pública de que o código novo está no ar), depois `conector-mcp`.
5. Cada deploy de função exige o seu clique de aprovação no GitHub.
6. Reversão: seção 4 (migração) e artefato `conecta-gateway-antes-do-deploy` (código).

## 8. Riscos
- **R1** `main` à frente do esquema de produção (qualquer redeploy de `assistente`/`conector-mcp` antes da migração quebra a auditoria em silêncio). Mitigação: seção 5 e portão B.
- **R2** Confirmação interativa do `apply_migration` fora da minha vista. Mitigação: migração sem `DROP`; fallback no editor SQL.
- **R3** Padrão do Supabase concede EXECUTE a `anon/authenticated`: o `REVOKE` explícito é obrigatório (conferir depois).
- **R4** `conecta-gateway` de produção está defasado (v5, 19/10): republicar traz correções acumuladas e pode afetar o Guardião.
- **R5** Compatibilidade real com ChatGPT/Claude **não verificada**.
