# Publicação pontual — identidade única do ChatGPT conectado pelo MCP

**Autorização:** proprietário da Mobis Autopeças solicitou no chat em 19/11/2026: "Você cria conectado pelo MCP e coloca no sistema", após mostrar registros de sessões expiradas e uma conexão MCP ativa.

## Correção estritamente visual
- A tela e a faixa "Conectores" derivam a identidade ChatGPT MCP dos registros OAuth de `pair_dispositivos` e `pair_sessoes`, sem criar outro login, chave ou token.
- Sessões com o mesmo nome/tipo/canal são consolidadas. A sessão válida mais recente é exibida; sessões OAuth anteriores continuam preservadas no banco para auditoria.
- ChatGPT e Claude são distintos. `conector-mcp` continua diferente de `conecta-gateway`; um agente autorizado para consulta e proposta não se torna automaticamente respondedor do chat Nano.
- Cabeçalho exibe apenas agentes com token e janela válidos, sem cinco mensagens "token expirado" para a mesma identidade. Histórico fica resumido na tela de conectores.

## Proteções
- Nenhuma revogação ou exclusão de sessão; nenhuma alteração em banco, escopos, RLS ou Edge Functions.
- Nenhuma gravação no Bling, loja, estoque ou dados fiscais; automação do CI003696 inalterada.
- Não ativa QR de chat, não aprova propostas nem publica imagens/produtos.
- Não modifica fluxo do PWA ou domínio da loja.
- Release será acionado apenas por este marcador no workflow GitHub Pages já homologado.

## Verificações
- Testes unitários para consolidação de cinco sessões OAuth históricas num único conector ativo, sem mistura de escopos.
- CI TypeScript, build e verificação visual no GitHub Pages antes de declarar release concluído.
