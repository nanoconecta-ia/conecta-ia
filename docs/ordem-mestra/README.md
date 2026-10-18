# Ordem Mestra — Conecta.IA (entregáveis da Fase 0)

Branch de desenvolvimento, **sem deploy, sem migração aplicada, sem escrita em produção ou no Bling**. A auditoria leu o banco `dsfzhsrudriqkumtlqwj` apenas com consultas de leitura (catálogo do sistema, contagens, advisors); não leu tabelas `private.*`, Vault nem dados de cliente.

| # | Entregável | Arquivo |
|---|---|---|
| 1 | Auditoria de lacunas | [01-auditoria-lacunas.md](01-auditoria-lacunas.md) |
| 2 | Arquitetura SaaS multiempresa | [02-arquitetura-saas.md](02-arquitetura-saas.md) |
| 3 | Mapa de tabelas e funções a reutilizar | [03-mapa-reuso.md](03-mapa-reuso.md) |
| 4 | Matriz Bling ↔ Conecta.IA | [04-matriz-bling.md](04-matriz-bling.md) + `supabase/functions/_shared/conector/matriz_bling.ts` |
| 5 | Contratos das ferramentas do Conector IA | [05-contratos-ferramentas.md](05-contratos-ferramentas.md) + `.../conector/contratos.ts` |
| 6 | Design system do site e do painel | [06-design-system.md](06-design-system.md) |
| 7 | Fluxo de enriquecimento e publicação | [07-enriquecimento-publicacao.md](07-enriquecimento-publicacao.md) |
| 8 | Arquitetura de SEO e distribuição | [08-seo-distribuicao.md](08-seo-distribuicao.md) |
| 9 | Plano de segurança e permissões | [09-seguranca-permissoes.md](09-seguranca-permissoes.md) |
| 10 | PR inicial com testes | este PR (`conector.test.ts`, CI das funções) |

## Resumo executivo (o que a auditoria mudou)
1. **O projeto não está "em definição".** Há 11 Edge Functions no repositório (+ 1 implantada fora dele), 27 migrações aplicadas, 69 tabelas com RLS, painel React e Bling **já conectado** (1 loja, 4 produtos espelhados, 0 publicados). `docs/ARQUITETURA.md` e o README estão desatualizados nesse ponto.
2. **A maior lacuna é a Fase 3**: o site é uma SPA em GitHub Pages com `noindex` e rota por `#hash`. Não há SSR, sitemap, robots, canonical nem dados estruturados. Isso viola a seção 7 da ordem (conteúdo essencial sem depender de JS).
3. **A Fase 1 está pela metade**: há LLM real (Claude/Gemini/OpenAI-compatível por chave da loja) com 13 ferramentas, mas **nenhuma consulta ao vivo ao Bling** pelo agente (`status_bling` só lê o banco), **sem conversa persistida** (o histórico vem do navegador) e **sem streaming**. O catálogo de ferramentas do Bling existe e é seguro, mas **não está ligado a ninguém**.
4. **Ainda não existem**: planos/assinaturas/limites por plano, Studio Visual, banners, Merchant Center, Google Ads (no Conecta.IA), pedidos/checkout, supervisor de agentes.
5. **Segurança é a parte mais madura**, com 11 achados, nenhum de gravidade alta (ver 01 e 09). Nenhum permite vazar dado entre lojas.
6. **Contradição de escopo a decidir**: a ordem pede "GPT, Gemini e Claude selecionáveis" e agente "como chat moderno" — o suporte a provedores existe por loja (BYOK); falta o seletor por conversa e a persistência.

## Decisões que preciso de você (bloqueiam a Fase 1/3)
Ver o fim de [01-auditoria-lacunas.md](01-auditoria-lacunas.md#decisões-pendentes).
