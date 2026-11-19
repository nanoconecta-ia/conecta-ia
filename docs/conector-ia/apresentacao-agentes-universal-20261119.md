# Conecta.IA — apresentação universal a agentes externos (MVP)

## Decisão

Oferecer uma descrição pública sem segredos e sem acesso ao catálogo de qualquer loja:

- painel/public/agentes/capacidades.json: manifesto informativo **não padronizado**.
- painel/public/agentes/openapi.json: OpenAPI 3.1.1 descrevendo **o endpoint MCP JSON-RPC já existente**. Não cria REST CRUD.
- ApresentarConecta no painel Gateway MCP/API: copiar apresentação, copiar endereço MCP e abrir especificações.

No GitHub Pages sob /conecta-ia/, os documentos ficam em /conecta-ia/agentes/capacidades.json e /conecta-ia/agentes/openapi.json após build/deploy do painel. Em desenvolvimento local, são assets estáticos do Vite.

## Compatibilidade

1. Cliente MCP remoto: usa POST https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/conector-mcp com OAuth do recurso ou Bearer da loja. Primeiro initialize e tools/list, depois tools/call conforme ferramentas realmente anunciadas.
2. Cliente com HTTP/OpenAPI, mas sem MCP: pode enviar JSON-RPC ao mesmo endpoint, se aceitar autenticação Bearer e chamadas dinâmicas. Importar OpenAPI NÃO significa integrar automaticamente todas as ferramentas.
3. Agente com navegador: pode acessar o painel autenticado se tiver navegação real. A Edge Function recusa requisições diretamente de navegador com header Origin; não abrir CORS por conveniência.
4. Chat só textual: só lê o texto copiado, sem obter conexão ou executar ações.
5. Modelo via API dentro do Conecta.IA: arquitetura de provedor já existente; compatibilidade e custos individuais exigem homologação.

## A2A ainda NÃO implantado

Um Agent Card A2A não substitui um servidor A2A real. A2A exige transporte compatível, mensagens/tarefas e autenticação. Não publicar /.well-known/agent-card.json até implementar e homologar um servidor A2A de fato. O arquivo capacidades.json NÃO é Agent Card.

## Regras de segurança

- Os documentos públicos não contêm chave, token, custo, fornecedor, estoque privado ou cadastro de loja.
- Nenhum agente externo recebe service_role ou token do Bling.
- Clientes MCP têm somente leitura e proposta conforme autorização. Não podem aprovar, publicar, emitir NF, editar dados fiscais nem escrever no ERP.
- Produto com automação pausada continua bloqueado; nenhuma mudança no Policy Engine.
- Sem deploy, migração, DNS, chaves de IA ou alteração de produção nesta entrega.

## Verificação

- Rodar npm test dentro da pasta painel, incluindo apresentarConecta.test.ts.
- Rodar npm run build em ambiente de testes.
- Conferir visualização do painel e links sob base GitHub Pages.
- Testar conexão autenticada externa (initialize, tools/list, leitura SKU) sem postar credenciais na conversa.
- Não declarar compatibilidade A2A ou com chats fechados sem execução real.
