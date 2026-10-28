# Checklist de aceite operacional (Nano.IA → Browser/PowerShell próprios)
Legenda: ✅ provado em teste local simulado · 🟡 código existe, não provado em ambiente real · ⛔ não existe · 👤 depende do proprietário.
Nenhum item abaixo é "funcional real": os ✅ são de runner simulado (PR #118).

| Item | Estado | Evidência / o que falta |
|---|---|---|
| Ferramentas descobertas por sessão | ✅ simulado | `catalogo_mcp.ts` (4 testes); falta ligar ao `tools/list` do gateway (PR próprio, mexe em produção) |
| Sessão autorizada, escopos | ✅ simulado / 🟡 gateway | `executor.ts`; Pair real em `_shared/pair` |
| Browser navega/consulta | 🟡 | NanoShell `execution/browser` (testes em site de teste); runner do Conecta ⛔ |
| PowerShell diagnóstico permitido | ✅ simulado | lista fixa + validação; execução real ⛔ (👤 autorização + dispositivo) |
| Tempo limite / pausa / revogação | ✅ simulado | `executor.test.ts` |
| Chat exibe resultado com origem/auditoria | ⛔ | evidência (hash, carimbo) existe; falta o painel no chat |
| Isolamento entre lojas e dispositivos | ✅ simulado | `fila.test.ts` |
| Bling leitura real × espelho | 🟡 | `bling.produtos.consultar` (tempo real) × `conecta.catalogo.*` (espelho) já separados no registro |
| Erros e recuperação | ✅ simulado | timeout → DESCONHECIDO, auditoria falha → nada entregue |
| Fila com banco | ⛔ | exige migração: desenho + aprovação 👤 |
| Executor instalado no PC | ⛔ | 👤 autorização específica por etapa |
