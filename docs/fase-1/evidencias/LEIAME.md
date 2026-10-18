# Evidências locais (2026-10-18)

Saídas brutas de execuções **locais** (Postgres 16 + PostgREST 12.2.3 + Deno 2.1.4 com a função **real**, ou Chromium a 390 px). Dados fictícios, nada em produção, nenhuma chamada a GPT/Bling.
Os scripts de harness ficam fora do repositório (dependem de binários locais); os resultados abaixo são o registro. Os mesmos casos devem virar testes de CI no WP3/WP4 (ver `../IMPLEMENTACAO-PRIMEIRO-TESTE.md`).

| Arquivo | O que prova |
|---|---|
| `e2e-m6-integracao-23-24.txt` | M6 (editor 403 / lojista 200 / outra loja 404 / sem vínculo / sem login / token inválido) na árvore **#23 + #24 integrada** — 16/16 |
| `e2e-artefato-gerado-26.txt` | O **artefato gerado pelo #26** rodando em Deno real com RLS real: M6 + seletor de provedores (estados, 409/400/429/502, sem vazar segredo, sem troca de provedor) — 29/29 |
| `ui-fila-papeis.txt` | Fila: editor com botões desabilitados, lojista habilitado, falha de permissão fecha |
| `ui-seletor-390px.txt` | Seletor: 3 estados, consentimento obrigatório, falha de leitura fecha o envio, sem rolagem horizontal. **Rotas simuladas** (UI apenas) |
