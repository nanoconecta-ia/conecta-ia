# Checklist de aceite operacional (Nano.IA → Browser/PowerShell próprios)
Legenda: ✅ provado em teste local simulado · 🟡 código existe, não provado em ambiente real · ⛔ não existe · 👤 depende do proprietário.
Nenhum item abaixo é "funcional real": os ✅ são de runner simulado (PR #118).

| Item | Estado | Evidência / o que falta |
|---|---|---|
| Ferramentas descobertas por sessão | ✅ local (composição) | `gateway_local.ts` anuncia as locais junto com as do gateway; o `gateway.ts` de produção NÃO foi alterado (ligar na Edge Function = PR/deploy próprio, 👤) |
| Sessão autorizada, escopos | ✅ simulado / 🟡 gateway | `executor.ts`; Pair real em `_shared/pair` |
| Browser navega/consulta | 🟡 | NanoShell `execution/browser` (testes em site de teste); runner do Conecta ⛔ |
| PowerShell diagnóstico permitido | ✅ local (executável FALSO) | `runner_windows.mjs`: spawn sem shell, saída limitada, abort mata o filho (6 testes); `powershell.exe` real ⛔ 👤 |
| Tempo limite / pausa / revogação | ✅ simulado | `executor.test.ts` |
| Chat exibe resultado com origem/auditoria | ✅ contrato (objeto) / ⛔ tela | `apresentacao_chat.ts` gera o cartão (origem, horário, hash, auditoria, aviso de ambiente; conteúdo externo só como trecho citado); falta renderizar na tela do chat |
| Isolamento entre lojas e dispositivos | ✅ simulado | `fila.test.ts` |
| Bling leitura real × espelho | 🟡 | `bling.produtos.consultar` (tempo real) × `conecta.catalogo.*` (espelho) já separados no registro |
| Erros e recuperação | ✅ simulado | timeout → DESCONHECIDO, auditoria falha → nada entregue |
| Fila com banco | ⛔ | exige migração: desenho + aprovação 👤 |
| Executor instalado no PC | ⛔ | 👤 autorização específica por etapa |

## Matriz de aceite atualizada (28/10) — real local × integração em produção
Legenda: ✅ comprovado · 🟡 relatado, sem a evidência em mãos · 🧪 só teste local simulado · ⛔ não existe/ não feito · 👤 depende do proprietário.

| Etapa da cadeia | Execução real local (Fase A, PC Mobis) | Integração em produção (Fase B) |
|---|---|---|
| Descoberta de ferramentas | 🟡 relatado (gateway de teste 127.0.0.1) | 🧪 código pronto; ⛔ não publicado (👤) |
| Sessão autorizada / pareamento | 🟡 código de uso único local | 🧪 Conecta Pair reaproveitado; ⛔ PC não pareado (👤) |
| PowerShell diagnóstico (5 consultas) | 🟡 PowerShell real relatado; JSON não lido por Claude | ⛔ |
| Bloqueio de comando fora da lista | ✅ testes + 🟡 relatado | 🧪 CHECK no banco + agente (SQL 33 + Node 4) |
| Revogação de sessão e dispositivo | ✅ testes + 🟡 relatado | 🧪 SQL + Node; ⛔ prod |
| Fila persistente / isolamento por loja | — | 🧪 SQL 33 verificações; ⛔ migração não aplicada (👤) |
| Auditoria | ✅ local | 🧪 `public.auditoria` no SQL; ⛔ prod |
| Resultado no chat (origem, hash, aviso) | ✅ cartão (objeto) | ⛔ renderização na tela do chat |
