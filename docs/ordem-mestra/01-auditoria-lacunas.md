# 1. Auditoria de lacunas (Fase 0)

Data: 2026-10-18. Fontes: código da `main` (`fe52dda`), projeto Supabase `conecta-ia` (somente leitura), `supabase get_advisors`. Legenda: ✅ real e testado · 🟡 existe, com limite · 🔴 não existe · 🎭 demonstração.

## 1.1 Estado real por área da ordem

| Área da ordem | Estado | Evidência |
|---|---|---|
| Multiempresa (tenant) | ✅ | `loja_id` + RLS em 69/69 tabelas públicas; 86 policies; teste SQL `rls_isolamento.sql` com duas lojas |
| Conexão Bling (OAuth) | ✅ | app por loja, secret cifrado AES-256-GCM, state assinado, renovação por cron a cada 30 min; Bling `conectada` em produção |
| Importar/sincronizar sem duplicar | ✅ | upsert `(loja_id, bling_id)`; cron `bling-sync` a cada 15 min; só leitura; custo/fornecedor nunca copiados |
| Webhooks do Bling | 🔴 | só varredura periódica; webhook "se confirmado na documentação" nunca foi verificado |
| Taxonomia automotiva | 🟡 | 49 nós, 10 montadoras, 10 modelos, 3 gerações, 9 peças-ref; tabelas de sistema/subsistema/componente existem (migração 18) mas quase vazias |
| Enriquecimento com evidência | 🟡 | agente **propõe** (`a_confirmar`) com fonte obrigatória; aprovação humana; **0 propostas reais** no banco |
| Índice de qualidade / antes-depois | 🔴 | só lista "faltando para publicar" |
| Imagens | 🟡 | busca web + proposta + aprovação; direitos "não confirmados"; sem geração, sem fundo/recorte |
| Chat do Conector IA | 🟡 | LLM real com ferramentas; **sem persistência, sem streaming, sem anexos, sem seletor GPT/Gemini/Claude por conversa**; histórico enviado pelo navegador (últimos 10) |
| Consulta autorizada ao Bling pelo agente | 🔴 | `bling_ferramentas.ts` (catálogo fechado + `podeExecutar`) **não é chamado por nenhuma função** |
| Policy Engine | 🟡 | só a função `podeExecutar` + testes; não há risco/aprovação em runtime, nem `approval_id` |
| Auditoria | ✅ | `auditoria` imutável (trigger bloqueia update/delete); falta `task_id/tool/risk_level/approval_id` estruturados |
| Fila de tarefas / Agent Gateway | 🟡 | `enriquecimento_tarefas` com lease; rotas `/agent/v1/*` **não existem**; "Central de Agentes" é 🎭 protótipo |
| Agente público (vitrine) | 🟡 | função `vitrine-assistente`: **determinística por palavras-chave, sem LLM**; só fatos aprovados |
| Site público | 🟡 | vitrine com busca, categorias, busca por veículo, tema por loja, WhatsApp; resolve loja por domínio no servidor |
| SEO / indexação | 🔴 | `noindex` no HTML; SPA com rota `#/`; sem SSR, sitemap, robots, canonical, JSON-LD, breadcrumbs |
| Domínio próprio | 🟡 | `loja_dominios` + `dominios_ativos`; 0 domínios; hospedagem multi-domínio **não decidida**; Mobis ainda na Locaweb |
| Studio Visual / banners | 🔴 / 🎭 | `#/imagens` e `#/demo/vitrine` são demonstração; `loja_tema` (cores, fonte, logo) é real |
| Merchant Center / Ads | 🔴 | nada neste repositório |
| Pedidos / checkout / pagamentos | 🔴 | recursos "frete" e "pagamentos" marcados "em breve"; restrições por UF modeladas, sem checkout |
| Supervisor de agentes | 🔴 | `ia_registrar_uso` guarda tokens/mês por provedor; sem painel, sem custo em R$, sem tarefas |
| Planos e assinatura | 🔴 | `recursos_plataforma` (10) + `loja_recursos` ligam telas por loja; **não há plano, preço, limite por plano, cobrança nem onboarding** |
| Fiscal | 🟡 | modelo completo (migração 13/14), tabelas oficiais vazias (`ref_ncm`, `ref_cest`, `ref_regras_uf` = 0); contador valida; nada aplicado |
| Testes | 🟡 | 80 testes Node nas funções + checks SQL (118+); **o CI só roda os testes do painel** |

## 1.2 Achados técnicos (verificados)

| # | Achado | Gravidade | Onde / evidência | Ação proposta |
|---|---|---|---|---|
| A1 | `anon` lê, via API REST, colunas internas de `produtos` publicados: `bling_id`, `campos_customizados`, `embalagem`, `loja_id`. O comentário de `loja-publica` diz "sem id do ERP", mas o grant é de **tabela inteira**. | Média | `information_schema.column_privileges` (anon/produtos = 33 colunas) | Migração (a aprovar): trocar por grant de colunas públicas ou view `produtos_publicos`. Não aplicada. |
| A2 | Função `diag-ambiente` está **implantada** (v4, verify_jwt) mas **não existe no repositório**. | Média | `list_edge_functions` × `ls supabase/functions` | Trazer o código ao repositório ou remover a função (decisão do dono). Não li nem alterei. |
| A3 | `bling-sync` em produção é versão **autocontida**, divergente da fonte modular (cabeçalho do arquivo admite replicação manual). Risco de deriva. | Média | comentário em `bling-sync/index.ts` | Corrigir bundling ou gerar o autocontido por script no CI. |
| A4 | Teste `assistente.test.ts` estava **quebrado** (import de arquivo movido). Os testes de funções não rodam no CI. | Baixa | `ERR_MODULE_NOT_FOUND` | **Corrigido neste PR** + workflow de CI. |
| A5 | `imagens_publicas` (policy anon) não confere `publicado` nem loja ativa. Hoje inofensivo porque `anon` não tem grant em `produto_imagens`, mas é armadilha se alguém conceder. | Baixa | `pg_policies` × grants | Alinhar a policy às demais (próxima migração). |
| A6 | Advisors: `pg_net` no schema `public`; leaked-password protection desativada; `pode_administrar_loja` e `bling_app_configurado` executáveis por `authenticated` (SECURITY DEFINER). | Baixa | `get_advisors security` | Ativar proteção de senha (painel Auth); mover `pg_net`; as duas funções são usadas pelo painel — confirmar se `bling_app_configurado` precisa de `authenticated`. |
| A7 | `loja-publica`/`vitrine-assistente` usam **service_role** com filtros manuais (`publicado`, loja ativa). Correto hoje, mas um filtro esquecido vaza; sem limite de taxa nas rotas públicas. | Baixa | código | Preferir views `anon` com RLS; limitar taxa por IP (já existe `limite_chamada`). |
| A8 | CORS `*` nas funções autenticadas. Aceitável com JWT, mas amplia superfície. | Baixa | todas as funções | Restringir a origens conhecidas na publicação. |
| A9 | Documentação contraditória: `ARQUITETURA.md` ("sem código", Next.js proposto) × realidade (Vite SPA, Deno). `DESIGN_SYSTEM.md` tem dois designs (laranja/IBM Plex histórico × azul/Inter vigente). | Baixa | docs | Atualizar (parcialmente neste PR; ver 06). |
| A10 | Modelo padrão `claude-sonnet-5-5` / `gemini-2.5-flash` **não verificado** contra catálogo; nenhuma chamada real aos provedores foi feita. | Média (operacional) | `docs/INTEGRACOES_IA.md` | Primeiro teste com chave real (Fase 1). |
| A11 | Nenhum nome de campo/caminho da API v3 do Bling foi conferido na documentação oficial (`conferido:false`). | Média | `bling_ferramentas.ts`, `bling_sync.ts` | Conferir antes de ligar qualquer ferramenta nova. |

Nada disso permite a um lojista ler ou alterar dado de outra loja: o isolamento por RLS foi verificado (nenhuma tabela sem policy; função `private.loja_ativa`/`pode_ver_loja`).

## 1.3 O que NÃO foi feito (e por quê)
- Nenhuma migração aplicada e nenhuma função publicada — a ordem só autoriza branch de desenvolvimento.
- Nenhuma chamada ao Bling nem a provedor de IA — sem autorização de escrita, e leitura ao vivo é entregável da Fase 1.
- Não abri `www.mobisautoparts.com.br` nem DNS.
- **Repositório da sessão**: a sessão nasceu em `mobispecas-rgb/genesis-indexa-360-ia` (outro produto: SQLite, Express, `CLAUDE.md` com design laranja). Não usei nem alterei esse repositório; trabalhei em `nanoconecta-ia/conecta-ia`, o indicado na ordem. Os tokens/regras daquele `CLAUDE.md` **não se aplicam** aqui.

## Decisões pendentes
1. **Hospedagem do site público com SSR e multi-domínio** (bloqueia a Fase 3). Opções: (a) Cloudflare Pages/Workers com domínios de cliente; (b) VPS com Caddy (TLS automático) + Node SSR; (c) Next.js em serviço gerenciado. O `ARQUITETURA.md` descarta Render e questiona serviços em dólar. Recomendo (b) para o piloto pelo custo em reais e controle, com render em Edge Function `loja-publica` como fonte de dados.
2. **Persistência do chat**: aprovo criar `conversas` e `mensagens` (+ `agente_tarefas` para o supervisor)? Desenho em 02 e 05. **Preciso da sua aprovação antes de escrever a migração** (regra do `CLAUDE.md`).
3. **Conferência da documentação do Bling** (webhooks, limites, escopos, publicação): quem tem login em `developer.bling.com.br` precisa colar as páginas; o domínio é bloqueado neste ambiente.
4. **A1/A2**: autoriza corrigir o grant de `produtos` (migração) e esclarecer `diag-ambiente`?
5. **Modelo de cobrança**: planos só após medir custo (item 12 da ordem). Posso instrumentar custo por tarefa na Fase 1 para isso.
