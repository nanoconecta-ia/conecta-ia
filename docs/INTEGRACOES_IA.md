# Integrações de IA (chave do provedor, plugins e agente do lojista)

## O que existe
- **Chave por loja (BYOK)**: o lojista cola a chave em *Integrações de IA*. Ela é cifrada no servidor (AES-256-GCM, chave da plataforma no Vault) e **nunca volta ao navegador**; a tela mostra só os 4 últimos caracteres, o modelo e o consumo do mês (limite opcional por loja).
- **Provedores habilitados:** Claude, Gemini (Google AI Studio) e "compatível com OpenAI", que cobre Llama hospedado (Groq, Together, OpenRouter etc.), DeepSeek e OpenAI. Cada loja pode ter vários; um é o **principal** (o primeiro salvo; trocável) e, se o principal for removido, o próximo ativo assume. Cada provedor tem chave, modelo, limite mensal e consumo próprios.
- **Llama:** só funciona por uma API **pública em https** (sem porta, usuário nem parâmetros). Um Llama rodando no computador do lojista (llama.cpp/Ollama local) não é alcançável pelo servidor; exigiria túnel ou o conector local do NanoShell, fora deste escopo.
- **Gemini gratuito:** o plano gratuito do Google pode usar o conteúdo enviado para melhorar produtos dele; a tela avisa. O agente só envia dados de catálogo (nunca custo nem fornecedor).
- **Plugins e conexões** (`loja_plugins`): `api`, `mcp`, `llm`, `plugin_pull`, com capacidades declaradas e risco LOW–CRITICAL. Nascem **desligados**; qualquer edição desliga de novo; `api` só ativa depois de um teste de conexão bem-sucedido.
- **Agente** (`assistente`): com chave ativa conversa com o provedor e usa ferramentas **somente leitura** (resumo, produtos, produto por SKU, pendências, taxonomia, status do Bling, plugins). Sem chave, cai no modo por palavras-chave.

## Regras de segurança
- Nenhuma ferramenta do agente grava, publica, aprova ou escreve no Bling. Teste automatizado garante que o catálogo de ferramentas não tem verbo de escrita.
- Retorno de ferramenta e de plugin é **dado**, nunca instrução (o prompt de sistema diz isso e o retorno vem marcado como "a conferir").
- Plugin `api`: contrato SDK v1 `POST <url> {sdk:"1", capacidade, entrada}`; só https, host público, sem porta/usuário/query, sem seguir redirecionamento, timeout de 15 s, resposta limitada a 20 mil caracteres; só capacidade declarada, plugin ativo e risco LOW. Risco acima de LOW nunca é chamado sozinho.
- Funções de segredo (`ia_*`, `plugin_*`) só para `service_role`; escrita por `ia-config` (exige quem administra a loja, limite de 40 ações/h) e tudo vai para `auditoria`.
- Texto de UI voltada ao lojista chama o agente de "Genesis IA"; o nome do provedor aparece apenas na tela de chave, onde é indispensável para o lojista saber qual chave colar.

## Limitações reais
- **Plugins `mcp` e `llm` são cadastro apenas**: o agente ainda não os executa (o protocolo MCP por HTTP não foi implementado nem testado contra um servidor real).
- As chamadas aos três provedores foram testadas só com *fetch* simulado, no formato da documentação pública de cada um (Claude `/v1/messages`; Gemini `generateContent` com `functionCall`/`functionResponse`, preservando `thoughtSignature`; OpenAI-compatível `/chat/completions` com `tool_calls`). **Falta o primeiro teste com chave real de cada um** (botão *Testar chave*).
- Nomes de modelo padrão (`claude-sonnet-5-5`, `gemini-2.5-flash`) não foram verificados contra o catálogo atual dos provedores: se der "modelo não encontrado", troque o nome em *Trocar chave ou limite*.
- A proteção contra SSRF valida o nome do host; não resolve DNS (rebinding não é coberto).
- O consumo é medido por tokens informados pelo provedor; não há conversão para reais.
