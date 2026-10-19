# Riscos e dependências

| # | Risco / dependência | Impacto | Mitigação já construída | O que ainda falta / decisão |
|---|---|---|---|---|
| 1 | **Bug do bundler de deploy multi-arquivo** do Supabase (visto em `assistente` e `bling-sync`) | Deploy falha ou fica divergente da fonte | `scripts/empacotar-funcao.mjs` gera um arquivo autocontido por função, verificado sem imports relativos | Tentar deploy multi-arquivo primeiro; usar o empacotado se falhar; checar se o bundle implantado corresponde à fonte (hash) |
| 2 | Código das Edge Functions novas **nunca executou em Deno real** (não há Deno aqui) | Erro só aparece no deploy | Tipos estritos checados com shim (`tsconfig.check.json`); lógica de negócio roda sob Node contra Postgres real; `node --check` nos bundles | Smoke test no deploy de homologação (projeto de branch/preview, não produção) |
| 3 | **Streaming** (Claude/OpenAI-compatível/Gemini) testado só com fixtures SSE | Formato real do provedor pode diferir | Parser robusto, erros 502 em stream incompleto, cancelamento e timeout | Teste manual com chave real no ativação do 1º LLM |
| 4 | **Mapeamento de campos do Bling `conferido: false`** | Corpo de escrita pode ser recusado/gravar campo errado | Escrita desligada; leitura de confirmação detecta divergência; allowlist fechada | Conferir cada campo na doc oficial (ver `bling-mapeamento.md`); escolher pesoBruto vs pesoLiquido |
| 5 | **Escopos do app Bling** não verificados para escrita | Escrita recusada (403) | Nada é enviado hoje | Conferir escopos do app no painel do Bling; testar em produto de teste |
| 6 | Idempotência no Bling | A API pode não aceitar chave de idempotência | Reconciliação por leitura antes de qualquer repetição; mesma chave interna | Documentar comportamento real do Bling para POST/PATCH |
| 7 | **Nenhuma chave de IA** cadastrada | O agente nunca rodou com LLM real | Plano de ativação (`ativacao-primeiro-llm.md`) | Dono cola a chave (BYOK) e valida o piloto |
| 8 | Custo de IA | Gasto por loja | Limite mensal de tokens por chave; tokens por mensagem; custo `null` até haver tabela de preços confirmada | Definir preços/limites por loja |
| 9 | **Taxonomia** com 49 nós, nenhum aprovado | Filtros e classificação fracos | Modelo canônico proposto (migração 0002) + ponte Bling→taxonomia (PR #22) | Conteúdo real (montadoras/modelos/gerações) com fonte e aprovação humana — não será inventado |
| 10 | **Imagens**: direitos de uso | Risco legal | Constraints de proveniência/cruzamento; URL de terceiros nunca pública; retirada (takedown) | Fonte autorizada de imagens e processamento de pixels (serviço a escolher) |
| 11 | **SEO/Google**: documentação do Google inacessível aqui | Regras do feed podem estar desatualizadas | Tudo marcado `conferido: false`; sitemap/robots/canonical/JSON-LD só com dado real | Conferir nas docs oficiais; servir `loja-seo` no domínio do cliente |
| 12 | **Domínio/DNS/HTTPS** do piloto | Sem domínio ativo não há canonical absoluto nem Merchant | Geradores recusam URL sem domínio verificado | Autorização explícita do dono para qualquer mudança de DNS/hospedagem (nada foi alterado) |
| 13 | **Prompt injection** via fornecedor/documento/plugin | LLM induzido a agir | Conteúdo é dado; LLM não aprova nem executa; Policy Engine independe do texto | Revisão periódica do prompt de segurança (não editável por agente) |
| 14 | Isolamento multi-loja | Vazamento entre lojas | RLS + chaves compostas (id, loja_id) + escopo por loja nas portas + testes de isolamento | Auditar `get_advisors` do Supabase antes de aplicar |
| 15 | Divergência entre bundle implantado e fonte (`assistente`, `bling-sync`) | Correção na fonte não chega à produção | Comentário no topo dos arquivos autocontidos; empacotador novo | Regenerar e reimplantar quando o bundler for confiável |
| 16 | Documentação histórica | Decisões antigas confundem | `docs/ARQUITETURA.md` reconciliado (substituídas marcadas, não apagadas) | Manter a cada PR |
| 17 | Logística reversa comercial | Fora do escopo de API do ERP | Módulo separado, não presumir suporte de API | Levantar necessidades do lojista e recursos reais do Bling |
