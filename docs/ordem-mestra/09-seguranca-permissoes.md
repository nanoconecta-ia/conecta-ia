# 9. Plano de segurança e permissões

## 9.1 Controles confirmados (leitura do banco e do código)
- RLS ligada em **69/69** tabelas públicas; 86 policies; `private.*` com RLS e sem policy (só servidor).
- `anon` com `SELECT` apenas em 8 tabelas (produtos, taxonomia, códigos, aplicações, revisões, supersessões, marcas, perfis), sempre filtradas por `publicado`/`aprovado` e loja ativa. **Exceção a corrigir: A1** (colunas internas de `produtos`).
- Funções `SECURITY DEFINER`: 45; só 2 executáveis por `authenticated` (`pode_administrar_loja`, `bling_app_configurado`); nenhuma por `anon`.
- Segredos: AES-256-GCM com chaveiro (`v2.<kid>…`), Vault para segredos da plataforma, chaves de loja só no servidor, `loja_mcp_chaves` guarda só hash.
- Auditoria imutável (trigger). Escrita no Bling: catálogo fechado, tudo `ativa:false`, teste garante `retry:"nenhum"` e aprovação+idempotência.
- Plugins `api`: https público, sem porta/usuário/query, sem redirecionamento, 15 s, 20 mil caracteres, só LOW.
- `bling-sync` manual: só quem administra a loja, 6/hora.

## 9.2 Matriz de papéis
| Ação | super_admin (MFA) | lojista | editor | anon (cliente) | agente admin | agente público |
|---|---|---|---|---|---|---|
| Ver dados da própria loja | ✅ | ✅ | ✅ | só publicado | ✅ (RLS do usuário) | só publicado/aprovado |
| Conectar/trocar app Bling, chaves de IA, plugins | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar propostas (Fila de enriquecimento/imagens e Central de Aprovações) | ✅ | ✅ | ❌ (decidido; na `main` a Fila ainda aceita editor até o PR #24 ser mesclado e a função publicada) | ❌ | ❌ propõe só | ❌ |
| Escrever no Bling | ❌ por padrão | só com aprovação por escrita (futuro) | ❌ | ❌ | só via Policy Engine, desligado | ❌ |
| Ver custos/fornecedor | — (não existem no espelho) | — | — | ❌ | ❌ | ❌ |
| Bloquear UF | ✅ | dentro do permitido | ❌ | ❌ | ❌ | ❌ |
**Pendência (achado 1 da revisão da PR #14):** confirmar que `bling-app`/`bling-conectar` exigem `papel = 'lojista'` (não `editor`). Verificar no código antes da Fase 1.

## 9.3 Ameaças e controles planejados
| Ameaça | Controle | Teste |
|---|---|---|
| Vazamento entre lojas | RLS + conferência de loja em RPC + chave por loja/plugin | `rls_isolamento.sql` (existe) + novo: duas lojas no chat/`mensagens`/`agente_tarefas` |
| Prompt injection via dado do catálogo/plugin | retorno de ferramenta = dado; lista fechada de ferramentas; escrita só por proposta | caso de teste com instrução embutida em `descricao` |
| Agente público manipulado a revelar custo/outra loja | contrato `publico.*` + sem acesso a tabelas proibidas (testado) | `conector.test.ts` |
| Escrita indevida no ERP | Policy Engine + `ativa:false` + aprovação + idempotência | existente + e2e com mock `test.*` |
| Custo de IA descontrolado | limite mensal por provedor (existe) + limite por plano (Fase 5) + parada de emergência | SQL: estourar limite bloqueia |
| SSRF em plugin | validação de host (existe); **não resolve DNS** | resolver e checar IP privado (melhoria) |
| Segredo em log/resposta | nunca registrar corpo/token; varredura de segredos no CI | adicionar `gitleaks` ao CI |
| Abuso nas rotas públicas | `limite_chamada` por IP nas funções sem JWT | teste de 429 |
| Perda da chave de cifra | procedimento em `BLING_RECUPERACAO_E_REVERSAO.md` | restauração trimestral |

## 9.4 Parada de emergência
Flag global + por loja (`lojas.agente_pausado`, **NOVO**, na migração da Fase 1) consultada em `assistente` antes de cada passo do laço e na fila de tarefas. Pausar não apaga histórico.

## 9.5 Plano de correções (ordem proposta; nada aplicado)
1. A1 grant de colunas de `produtos` para `anon` (ou view) — migração pequena e reversível.
2. A2 `diag-ambiente`: trazer ao repo ou remover.
3. A6 ativar proteção de senha vazada; mover `pg_net`.
4. CI: testes das funções (**neste PR**) + `gitleaks`.
5. Restringir CORS na publicação.
6. Migração da Fase 1: `conversas`, `mensagens`, `agente_tarefas`, `aprovacoes`, `agente_pausado` — **aguardando seu OK ao desenho do doc 2**.
