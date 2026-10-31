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

---

## Revisão técnica da PR #167 (31/10/2026)

### Correção aplicada
- **Bug de navegação:** com `open` derivado só da rota, recolher a área da rota atual e navegar para outra tela da mesma área deixava a área fechada e o item ativo invisível (reproduzido no Playwright). Agora as áreas abertas são estado do React (`areasAoNavegar` + `grupoDaRota` em `lib/navegacao.ts`, com testes): entrar numa área diferente abre só ela, navegar dentro da mesma área sempre a revela e o que o usuário abriu à mão é preservado.
- Evidências em `evidencias-issue-166/` (desktop, menu recolhido e 390 px; build de produção e build com todas as flags), além do roteiro Playwright usado.

### Verificação das rotas (modo demonstração local)
- Build de produção (flags desligadas): 13 rotas no menu. Com todas as flags ligadas: 24 rotas. **Todas abrem, sem erro de página**, e a largura de 390 px não gera rolagem horizontal (`scrollWidth = 390`).
- Ressalva: o modo demonstração usa dados locais, então não prova o backend.

## Inventário real (Supabase `dsfzhsrudriqkumtlqwj`, consulta só leitura)

**Funções implantadas (22):** `assistente`, `assistente-homologacao`, `agente`, `bling-*` (conectar, callback, renovar, app, sync, backup), `ia-config`, `loja-publica`, `loja-tema`, `loja-seo`, `pair`, `conecta-gateway`, `conector-aprovacoes`, `conector-conversas`, `conector-chaves`, `vitrine-assistente`, `diag-ambiente`, `eco-ip-temporario`, `scanner-homologacao`.
**Não implantadas:** `conector-chat` e `conector-mcp`.

### Três catálogos de ferramentas, hoje sem ligação entre si
| Catálogo | Arquivo | Ferramentas | Por onde é alcançado | Situação real |
|---|---|---|---|---|
| Assistente | `_shared/ia/ferramentas.ts` | 19 (consulta + propostas, nomes `snake_case`) | edge `assistente` (dock e `/assistente`) | Implantado. **0 registros `assistente.consulta` na auditoria**, então nenhum uso com LLM em produção está comprovado. |
| Tool Registry do conector | `_shared/conector/registro.ts` | 57: 39 `ativa`, 16 `planejada`, 2 `desligada` | `conector-chat` / `conector-mcp` (não implantados) e `conector-aprovacoes` (implantado, executor) | "ativa" quer dizer handler e testes no código, **não** que esteja disponível em produção via chat ou MCP. |
| Pair / gateway externo | `_shared/pair/gateway.ts` | 12 (`conecta.list_products`, `conecta.get_product`, `conecta.bling_consultar_produto`, `conecta.propose_*`…) | edge `conecta-gateway` (**implantada**, JSON-RPC MCP: `initialize`, `ping`, `tools/list`, `tools/call`) | É o único endpoint MCP implantado. Há 2 `pair_sessoes` e 2 dispositivos, mas falta prova E2E documentada. |

**MCP Resources e Prompts:** não existem em nenhum dos três gateways. O gateway do conector anuncia as versões `2025-06-18`, `2025-03-26` e `2024-11-05`, nenhuma delas a `2026-07-28` citada na issue.

### Histórico de conversas: dois armazenamentos
- `assistente` usa `conversas`/`mensagens`: **60 conversas e 208 mensagens reais**.
- `conector-*` usa `agente_conversas`/`agente_mensagens`: **0 e 0**.
- Conclusão: tornar `assistente` canônico não exige migração de dados. O que precisa migrar do conector é **capacidade** (streaming SSE, anexos, Tool Registry com Policy Engine e auditoria), não histórico.

## Arquitetura proposta para o Nano.IA (PR B, não implementada aqui)
1. **Uma camada de conversa:** as tabelas `conversas`/`mensagens` e a edge `assistente`. A esfera, o dock e a tela `/assistente` montam o mesmo componente, como o `DockAgente` já faz hoje.
2. **Um catálogo de ferramentas:** `conector/registro.ts` vira a única fonte (tem schema, risco, permissão e `estado`). `ia/ferramentas.ts` passa a ser um adaptador que expõe ao LLM só o que está `ativa` e `exposicao.chat`, e `pair/gateway.ts` passa a ser um adaptador de escopos para o gateway externo. Os nomes atuais ficam como aliases durante a transição.
3. **Policy Engine e auditoria únicos:** `conector/policy.ts`. Leitura LOW passa direto; MEDIUM ou mais gera proposta com aprovação humana e `idempotency_key`; escrita externa só pelo executor (`conector-aprovacoes`).
4. **Contexto:** `contextoPagina.ts` (rótulos e contagens sanitizados), sem envio automático ao provedor.
5. **`/conector`** continua visível só com `VITE_CONECTOR_ATIVO` até a paridade ser provada. Depois vira alias de `/assistente`.

## Atlas técnico, mapa operacional e indicadores (PR B)
- **Mapa operacional** (`MapaMental.tsx`/`mapaPagina.ts`): estado da página atual (pendências, alertas). Não mistura taxonomia.
- **Atlas técnico OEM:** hierarquia `montadora → veículo → geração → motor → peça → referência OEM`. Cada nó traz `fonte`, `consultado_em`, `confianca` e `status` (`aprovado` / `a_confirmar` / `não homologado`). Nenhum nó sem evidência aparece como aprovado.
- **Indicadores:** só números lidos do banco (`/indicadores`).
- SKU, preço e estoque sempre lidos do espelho Bling, nunca editados nem guardados na camada técnica.

## Demonstração do fluxo de consulta (só leitura, sem escrita no Bling nem no banco)
Consulta direta e só leitura ao espelho, feita pelo engenheiro, **não pelo Nano.IA**. O E2E via agente continua pendente.
- Espelho: 42 produtos com `bling_id`, 0 publicados.
- SKU `CI000016`, "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas" (marca TRIM GO AUTOPARTS): sem GTIN, sem descrição, 0 imagens; 2 itens de enriquecimento `a_confirmar` (descrição curta e longa, fonte "Bling API v3").
- Proposta preparada (não gravada): campos faltantes = GTIN, descrição, imagem licenciada, aplicação técnica (HR/K2500 2.5 8V). Cada um exige uma fonte pública com URL e data antes de virar `a_confirmar`. Nenhum valor foi inventado.

## Próximas PRs (nenhuma vai para produção sem aceite)
- **B1:** unificar o catálogo de ferramentas (registro como fonte, adaptadores e testes de paridade de nomes).
- **B2:** chat único. O Assistente ganha streaming e anexos do conector; `/conector` vira alias; teste de que dock e tela usam a mesma conversa.
- **B3:** separar o mapa operacional do Atlas OEM, com cards legíveis e a hierarquia acima.
- **C1:** painel "Ferramentas conectadas" dentro do Nano.IA, com estado real lido do registro e das funções implantadas, e teste somente leitura.
- **C2:** MCP Resources no `conecta-gateway` em ambiente isolado, com testes de credencial inválida, loja B→A, rate limit e revogação.
- **C3:** E2E Nano.IA: produto real → ficha → faltantes → fonte pública → proposta `a_confirmar`, sem escrita no Bling.

## Decisão do proprietário (31/10/2026): Central oculta
- Ordem aprovada: B1 → B2 → B3 → C1 → C2 → C3.
- `/central` (alias `/agentes`) fica **oculta até aceite específico**, inclusive com `VITE_CONECTOR_ATIVO=1`, porque a tela tem a ação `executar` (grava via `conector-aprovacoes`). Ela sai do menu e da paleta, e o acesso direto cai na visão geral. Para ligar é preciso a nova flag `VITE_CENTRAL_ATIVA=1`, só com autorização. Nada foi removido: a tela e a edge continuam no código.
## B1: catálogo único de ferramentas
- **Fonte única:** `supabase/functions/_shared/conector/registro.ts` (Tool Registry). Ele define o que cada ferramenta é: risco, permissão, estado e exposição.
- **Aliases** (`conector/aliases.ts`): os 19 nomes do assistente e os 12 do gateway Pair apontam para ids do registro. Os nomes públicos não mudam, porque o LLM e os clientes Pair já os usam.
- **Assistente:** toda chamada passa pelo Policy Engine (`decidir`, origem `chat`) **antes** de tocar em dados. A lista entregue ao LLM é filtrada pelo registro: desligar uma ferramenta no registro tira ela do chat. Hoje nenhuma ferramenta sai da lista, então não há regressão.
- **Registro:** nova `conecta.web.pesquisar_tecnico` (leitura, só chat), com handler no conector. Ela era a única ferramenta do assistente sem contrato.
- **Pair:** 7 ferramentas mapeadas. As 5 capacidades que só existem no Pair (`get_part_by_code`, `propose_bula`, `propose_banner`, `get_pending_approvals`, `get_task_status`) ficam travadas como "sem contrato" até a C2. O teste impede que uma ferramenta nova entre no Pair sem alias.
- **Invariante testada:** toda ferramenta `ativa` (exceto execução) tem handler, e todo handler tem contrato.
- **Fora do escopo:** `_shared/bling_ferramentas.ts` é a camada de **endpoints HTTP do Bling** (usada por `contratos.ts` e `assistente/bling_consultar.ts`), não um catálogo exposto a agentes. Fica como está.
- **Produção:** o runtime do Pair não muda. O assistente só muda quando a edge for reimplantada, o que exige autorização.

## B2 (primeira entrega): um único Nano.IA no painel
- **Chat canônico:** `/assistente` (edge `assistente`, implantada; histórico real em `conversas`/`mensagens`). O atalho do topo e o botão "Conversar com Nano.IA" abrem sempre esse chat, inclusive com `VITE_CONECTOR_ATIVO=1`.
- **Mesma conversa no dock e na tela:** os dois já montavam o mesmo componente, mas cada montagem começava sem conversa. Agora o id da conversa ativa fica guardado por loja na sessão do navegador (`lib/conversaAtiva.ts`), e quem montar depois retoma o fio. Guarda-se só o id: as mensagens continuam vindo do servidor com RLS. Se a conversa não abrir mais (excluída ou de outro usuário), o id é descartado. "Nova conversa" e a exclusão limpam o id.
- **`/conector`** continua no código e no menu **só** com a flag, rotulado "Nano.IA (homologação)", até o streaming, os cartões de proposta e o painel de contexto serem migrados para o chat canônico.
- **Ainda falta (B2b, exige reimplantar a edge `assistente` com autorização):** streaming SSE e cartões de proposta no chat canônico. O backend `conector-chat` continua não implantado e não foi ligado.

## Direção do proprietário: Nano Guardião (extensão Chrome/Edge)
- O Nano.IA trabalha **sobre a tela real do ERP** em que o lojista está logado, num painel lateral, no modo guardião. As telas do ERP deixam de ser redesenhadas dentro do painel do Conecta.IA. A retirada desses módulos só acontece depois de o Guardião cobrir cada função, com inventário prévio.
- Nada de clonar a sessão: a leitura é feita no navegador do lojista, e o que se guarda é o **mapa versionado da tela**.
- **Piloto (`extensao/`):** cadastro de produto, só leitura e sugestão de tags. Mapa v0 a confirmar. Sem pareamento e sem rede.
- **Pendente:** termos de uso do Bling e confirmação do mapa com captura real.
