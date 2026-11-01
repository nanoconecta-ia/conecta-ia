# Nano.IA: ficha-base do Bling sem provedor LLM (homologação em PR)

## Objetivo

Quando o Gemini atingir 429, a chave expirar ou não houver LLM disponível, o operador ainda consegue consultar dados **reais**, com fonte, para iniciar a revisão técnica do cadastro de um produto. Esta função **não substitui um modelo de IA em tarefas complexas** e não cadastra produtos novos no Bling.

## Comando

No chat canônico `/assistente`, digite, por exemplo:

```
/ficha CI000016
```

A interface envia **somente** `{acao:"chat_ficha_produto",codigo:"CI000016"}` para a Edge Function `assistente`. Não encaminha a mensagem ao Gemini, OpenRouter, FreeLLMAPI ou qualquer outro LLM. O comando não exige credencial de IA nem consentimento de provedor, mas exige usuário autenticado e o recurso da loja `chat_consulta_bling` ativo.

## O que faz

1. A Edge valida estritamente um código de até 60 caracteres, sem anexos, sem URL/arquivo e sem escolher provedor.
2. Reutiliza `bling_consultar_produto` e `buscarProduto`, com JWT/RLS, tenant por loja, rate limit e auditoria. Procura no espelho e na API do Bling, incluindo registros ativos, inativos e excluídos. Não executa escrita.
3. Exibe número total de candidatos, situação, SKU, nome e fonte, se a consulta foi completa ou parcial, data e ambiente sintético/real.
4. A tela ressalta campos que **exigem fonte** e não foram comprovados: OEM, código de fabricante, marca fabricante, aplicação por motor/ano/versão, GTIN, medidas, imagens e direitos.
5. Não infere que resultado vazio equivale a produto inexistente. Não autoriza criar SKU. Novos cadastros dependem do fluxo de `docs/ordem-mestra/14-produto-novo-pelo-chat.md`.

## Riscos e escopo

- A ficha e suas evidências são exibidas **somente ao usuário autenticado**, sem compartilhamento com provedores gratuitos. O modelo não recebe custos, fiscal, fornecedores ou clientes.
- É uma consulta direta, exibida localmente no chat, **não uma mensagem persistente da conversa**; a auditoria da operação Bling é registrada como `chat.bling_ficha`.
- Se falhar o acesso/auditoria, retorna erro e não confirma consulta.
- Não executa `bling.produtos.criar`, não altera nome/categoria/GTIN/imagens/estoque/preço, não aprova propostas e não publica a loja.
- O comando é útil para preparar a conferência de um cadastro **já existente**. O pré-cadastro completo com PDF, imagens, múltiplas referências, homologação fiscal e criação no Bling permanece planejado, com aprovação humana e testes separados.
- Sem conectividade Bling, pode haver somente evidência do espelho ou a consulta pode falhar. A ficha sinaliza API incompleta; não afirma confirmação ao vivo.
- Qualquer combinação futura com o PR #218 (OpenRouter gratuito) deve conservar o isolamento de dados e regerar `artifacts/assistente/index.ts`/manifesto num commit conjunto, sem copiar arquivos gerados antigos.

## Verificação executada

- Testes unitários puros de ficha: 5/5, incluindo origem sintética, candidato excluído, ausência, ambiguidades e consulta parcial.
- Testes do artefato autocontido: 19/19, incluindo o comando novo com Bling **simulado**, zero chamadas LLM, auditoria e negações por política. Isso não substitui teste com a API real do Bling.
- Gerador oficial de artefato executado no notebook `mobis`; hashes do manifesto normalizados para Linux.

## Aceite antes de publicar

1. CI da PR verde, inclusive painel, chat, banco e segurança.
2. Teste E2E com usuário da loja e conectividade real ao Bling para um SKU ativo, um excluído, um ambíguo e um inexistente; registrar fonte/data/status, sem escrever.
3. Verificar layout e contraste em PC e celular.
4. Preservar aprovação humana/Policy Engine para futuras mudanças de cadastro. Nenhum deploy ou merge nesta etapa.
