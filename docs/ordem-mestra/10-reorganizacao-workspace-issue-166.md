# Issue #166 — Matriz de navegação e migração controlada (PR A)

**Escopo deste PR:** apresentar somente cinco áreas de navegação recolhíveis. Nenhuma rota, tela, função do Supabase, tabela, produto, dado do Bling ou deployment é removido/alterado. A mudança está em **branch isolada**.

## Decisão de arquitetura

- **Núcleo do produto:** `nanoconecta-ia/conecta-ia`, plataforma operacional multi-ERP com agente Nano.IA integrado.
- **Produto distinto:** NanoShell IA, Supabase `ptilvkzuhjnqnfydjcly`; não utilizar nem alterar seu backend.
- **Genesis:** `genesis-indexa-360-ia` fora deste escopo; não importar módulos nem executar trabalho nesse repositório.
- **Chat canônico provisório:** `assistente` / rota `/assistente`, que está implantado em produção. `conector-chat` / `/conector` ficam preservados como implementação candidata, mas não certificados: ainda faltam deploy, provas de autenticação, streaming, persistência e ferramentas, e plano de migração. A decisão final de troca de backend exige testes E2E e aprovação humana.
- **ERP fonte de verdade:** Bling para cadastro, preço e estoque. Não escrever no Bling sem autorização por operação e campo.

## Cinco áreas e destinos atuais

| Área | Rotas atuais agrupadas, sem redirecionamento ou exclusão | Papel |
|---|---|---|
| Início | `/`, `/indicadores` | Visão operacional e métricas |
| Catálogo inteligente | `/catalogo`, `/studio`, `/taxonomia`, `/imagens` | Pesquisa, classificação, ficha técnica, atlas, imagens e SEO |
| Nano.IA | `/assistente`, `/conector`, `/estudio` | Conversa contextual e configurações do agente, até unificar |
| Operações | `/fila`, `/aprovacoes`, `/central` | Fila, propostas, execução e aprovações |
| Configurações | `/bling`, `/backup`, `/contador`, `/integracoes`, `/gateway`, `/meu-agente`, `/dispositivos`, `/aparencia`, `/banners`, `/condicoes`, `/design` | ERPs, provedores e MCP, dispositivos, políticas e aparência |

A visibilidade continua regida pelas flags `VITE_CONECTOR_ATIVO`, `VITE_PAIR_ATIVO`, `VITE_BACKUP_ATIVO`, `VITE_BANNERS_ATIVO`; **nenhuma é ligada por este PR**. Cada área abre/recolhe nativamente via `details/summary`. Rotas desconhecidas continuam no grupo `Outros`, não desaparecem do produto; a paleta Ctrl+K segue indexando as rotas existentes. Se uma área não tem rota habilitada, não aparece.

**Rota antiga → nova:** nesta fase a rota antiga **continua sendo seu próprio destino**; redirecionamento é desnecessário e arriscaria perder funcionalidades. Quando os módulos forem efetivamente consolidados nas fases seguintes, introduzir redirects/aliases com testes de compatibilidade e rollback.

## Duplicidades para análise posterior (não deletar nesta PR)

| Escopo | Arquivos/rotas atuais | Direção proposta | Gate |
|---|---|---|---|
| Chat | `Assistente.tsx`, `ConectorIA.tsx`, `DockAgente.tsx` | Um backend/histórico/contexto canônico e um compositor reutilizável | Comprovar persistência e ferramentas nas duas superfícies |
| Mapa mental | `MapaMental.tsx`, `mapaPagina.ts` | Diferenciar mapa de processos e atlas de compatibilidade técnica | Fichas reais com fonte e status |
| Catálogo | `/catalogo`, `/studio`, `/taxonomia`, `/imagens` | Um workspace de catálogo com abas contextualizadas | Não duplicar SKU ou produto Bling |
| Aprovação | `/fila`, `/aprovacoes`, `/central` | Fluxo único de proposta, revisão, aprovação e histórico | Garantir papéis, versionamento e idempotência |
| Integração | `/gateway`, `/integracoes`, `/bling` | Uma configuração de provedores, ferramentas e permissões, separada por capacidade | Não misturar LLM BYOK, MCP externo e ERP OAuth |
| UI de design | `/aparencia`, `/design` | Ferramenta interna no menu avançado | Preservar editor e tokens existentes |

## MCP — novo recurso solicitado, **fora do escopo de implantação desta PR**

A tela `GatewayMCP.tsx` não deve afirmar funcionamento do endpoint `conector-mcp` até que a Edge Function seja implantada e testada com autenticação e escopos. A lista atual do Supabase ainda não contém `conector-mcp` nem `conector-chat`.

MCP `tools/list` e `tools/call` são diferentes de `resources/list` e `resources/read`. Recursos adicionais propostos (não disponíveis hoje) para ficha de produto, taxonomia e pendências exigem URI e formato documentado, autenticação por loja, RLS, autorização, auditoria, limite, testes de revogação e isolamento entre lojas. Não expor fornecedor privado, custos, fiscais, credenciais ou tokens. Clientes MCP externos não podem aprovar nem executar escrita. Pesquisa de portais B2B autenticados requer consentimento do operador e automação separada; abrir link externo não comprova navegação.

## Evidência e aceitação exigida para avançar

1. Testes unitários da navegação + `npm run build` do painel e inspeção do CI.
2. Capturas de tela **reais** com 390 px e desktop, revisando menu recolhido, expandido, teclas Tab/Enter/Espaço e contraste.
3. Confirmação que a esfera flutuante do Nano.IA permanece nas páginas operacionais.
4. Nenhuma mudança de dados, migração, deploy, DNS, Genesis ou Bling.
5. PRs seguintes isoladas: **B** unificação de chat/mapa; **C** MCP + piloto real com fonte e proposta somente leitura.

### Situação

Implementação inicial do menu preparada para revisão. Capturas reais e prova end-to-end do Nano.IA/MCP **ainda não realizadas**; não declarar concluído.

Referências: [Issue #166](https://github.com/nanoconecta-ia/conecta-ia/issues/166), PRs #161, #164, #165.
