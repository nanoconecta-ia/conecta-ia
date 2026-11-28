# Inventário patrimonial de código — checkpoint 97
Baseline: commit `b8d6b32338fa06da08c9f2d05859d9b4c22519db`, tree `7ecce655b47f25c48fbe9aac4169c06c1f8cff8b` (main/base efetiva do PR #507, ancestral do candidato, 0 commits atrás).
Candidato medido: commit `32bb5385547cf4aab816540678624e8c8af07333`, tree `a39e732719f4ff240abc7a69c8411797bb1b9afb` (96). Ambas as respostas Git Trees recursivas vieram com truncated=false. Arquivos versionados: inclui blobs e gitlinks, exclui diretórios. Caminho, modo, tipo e SHA são preservados sem leitura de conteúdo operacional. Não confundir arquivo com nó de taxonomia, ferramenta MCP ou capacidade homologada.
- 1519 entradas obrigatórias; 1500 idênticas (98,7492%); 19 alteradas; 0 ausentes; 129 novas; total candidato 1648.
- Presença estrutural 1519/1519 = 1,00; identidade de conteúdo/modo 1500/1519; alterações pendentes de revisão funcional.
- O TSV baseline contém toda a lista fixada; o TSV delta contém as diferenças do candidato 96 (inclusive alterações de modo/tipo). São instantâneos, não lista de registros operacionais. Os seis arquivos deste incremento não fazem parte do candidato medido.
- Reprodução: consultar Git Trees recursivas dos dois tree SHAs, exigir truncated=false, excluir type=tree, comparar caminho, modo, tipo e SHA. Nenhum resultado de busca parcial é aceito. Nova base requer decisão explícita, não reduzir denominador.
## Fila de revisão dos 19 arquivos legados alterados
- `.github/workflows/funcoes-testes.yml` — pendente de revisão funcional e regressão por contrato.
- `artifacts/bling-sync/index.ts` — pendente de revisão funcional e regressão por contrato.
- `artifacts/bling-sync/manifesto.json` — pendente de revisão funcional e regressão por contrato.
- `docs/identidade/mobis-ma-20261118.md` — pendente de revisão funcional e regressão por contrato.
- `painel/src/paginas/LojaMobisNova.tsx` — pendente de revisão funcional e regressão por contrato.
- `painel/src/paginas/PaginaAplicacaoMobis.tsx` — pendente de revisão funcional e regressão por contrato.
- `painel/src/paginas/Taxonomia.tsx` — pendente de revisão funcional e regressão por contrato.
- `painel/src/paginas/mobis-v3-limpo.css` — pendente de revisão funcional e regressão por contrato.
- `painel/src/paginas/taxonomia.css` — pendente de revisão funcional e regressão por contrato.
- `scripts/tests/mobis-vitrine-teste.mjs` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/bling_sync.test.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/bling_sync.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/loja/publica.test.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/loja/publica.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/seo/rotas.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/_shared/seo/sitemap.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/bling-sync/index.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/loja-publica/index.ts` — pendente de revisão funcional e regressão por contrato.
- `supabase/functions/loja-seo/index.ts` — pendente de revisão funcional e regressão por contrato.
## Próxima fase patrimonial
Extrair inventário de ferramentas MCP e seus schemas da fonte `supabase/functions/conector-mcp/index.ts` e módulos compartilhados, confrontar `docs/ordem-mestra/05-contratos-ferramentas.md`; inventariar funções/API, migrações, permissões, nós e relações em código, consumidores e integrações. Vincular capacidade a teste e evidência do mesmo SHA; mudanças de contrato, aliases e migrações exigem revisão. O inventário operacional de nós/IDs, dados, credenciais, conexões, ERP, direitos de ativos e histórico real não foi executado e não pode ser deduzido dos arquivos. Auditor independente ainda necessário.
`compararPatrimonioCodigo` oferece comparação pura e cinco testes PAT-97 sintéticos; não autentica o snapshot nem consulta Git diretamente. Não prova semântica, operação ou direitos. Não modifica funções existentes, banco, ERP, frontend, produção ou preço. CI pendente.
