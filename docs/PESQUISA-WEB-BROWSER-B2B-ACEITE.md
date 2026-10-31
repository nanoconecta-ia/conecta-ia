# Pesquisa técnica e browser B2B — contrato operacional de aceite

## O que existe nesta branch
- Interface `/pesquisa` com campo estilo browser, resumo fundamentado Gemini/Google, fontes clicáveis e edição de proposta.
- Edge `assistente` recebe `acao=pesquisar_web`: JWT obrigatório, loja via RLS, credencial Gemini decifrada somente no servidor, consentimento explícito, até 180 caracteres de consulta pública; **não manda o histórico do chat nem custos**.
- Nova ação `propor_enriquecimento_web`: confere UUID de produto visível ao usuário na própria loja, campo permitido, valor revisado e URL HTTPS; consulta a fila para evitar proposta pendente duplicada; gera `produto_enriquecimento` em `a_confirmar` e auditoria. **Nunca grava no Bling.**
- Portais Tecfil e PartSouq abrem em outra aba do navegador. Não há captura de cookies nem acesso a sessões privadas.
- Central de módulos não repete atalhos de favoritos/chat; dock contém apenas chat, pesquisa/catálogo e ferramentas de contexto.

## Matriz de evidências — atualize apenas após testar
| Recurso | Estado | Evidência exigida |
|---|---|---|
| Pesquisa pública Gemini | Implementada no código e testada com fetch simulado | Chamada real autenticada a Gemini Google Search com **fontes**, custo e limite observados |
| Fontes fundamentadas | Testada com metadados fictícios, deduplicação e URL HTTPS | Abertura em navegador da fonte de fabricante real |
| Pesquisa Tecfil / PartSouq | Link abre no navegador externo | Usuário acompanha consulta de código e medidas reais, sem confundir links com automação |
| Enriquecimento pendente | Implementado no backend e na UI | Inserção e leitura na fila usando SKU de teste, RLS e permissão conferidos |
| Aprovação no Conecta.IA | Função existente | Validar revisão/autorização com responsável e conflito de atualização |
| Escrita no Bling | **Não liberada** | Aprovação por versão, idempotência e rollback; não fazer automaticamente |
| Browser em B2B autenticado | **Não implementado no fluxo online** | Gateway/Pair real, lista de domínios, sessão do próprio operador, consentimento por ação, auditoria, revogação |
| Gemini como agente global | Assistente real existente; pesquisa é rota separada | Teste E2E de contexto, ferramentas, resposta, histórico e consentimento |

## Requisitos de proteção B2B
1. Navegação em site externo somente com operador autenticado **no domínio do fornecedor**. Nunca copiar senha, cookies, token ou conteúdo de armazenamento local ao LLM ou ao servidor do Conecta.IA.
2. Inicialmente, permitir **somente leitura** de catálogos e páginas: fabricante, número de peça, aplicação, medida, URL e data; custos, condições comerciais e preços privados ficam locais.
3. Bloquear envio de pedido, alteração de carrinho, checkout, downloads executáveis e modificações sem autorização específica.
4. Cada clique automatizado gera evidência com domínio, ação, data e identidade do operador; em caso de falha, retornar **não verificado**.
5. Consultar termos e mecanismos oficiais/API do fornecedor antes de automatizar; respeitar autenticação e limites.
6. As pesquisas da Web são **candidatas**, não homologação de aplicação: divergência 4D56/D4BH, pinos, anos e motor deve impedir aprovação sem manual/OEM correspondente.

## Google e custos
- O [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/generate-content/google-search) funciona com `gemini-3.6-flash`, mas a função usa cotas e pode gerar cobrança conforme conta/plano. O clique é opt-in, sem retries automáticos.
- A antiga [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview) já não aceita novos clientes e será encerrada para existentes em 01/01/2027. **Não projetar expansão com ela.**
- Avaliar exigências de exibição de **Google Search Suggestions** na interface após receber `searchEntryPoint`, antes da liberação pública.

## Bloqueios antes do deploy
- CI do PR verde, incluindo teste de artefato autocontido, Testes das funções e do banco, build e mobile.
- Testar Edge Function em ambiente isolado, autenticada, com SKU sintético. Controlar cota/custo.
- Revisar comportamento das políticas de RLS/SECURITY DEFINER do Supabase.
- Testar no browser PC/Android o fluxo pesquisar → fontes → proposta → fila de aprovação.
- Revisão do proprietário para qualquer deploy que altere o assistente operacional. **Não realizar merge/deploy automaticamente em produção.**
