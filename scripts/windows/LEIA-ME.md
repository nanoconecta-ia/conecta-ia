# Execução controlada no Windows (sem token, sem credencial)

`Preparar-Aplicacao.ps1` NÃO executa SQL e NÃO usa token: confere o arquivo (ref do projeto, transação, comandos de remoção), copia o SQL para a área de transferência e abre o SQL Editor do projeto `conecta-ia`. Quem clica em **Run** é você.

Pré-requisito: PowerShell 5.1+ (Windows) e este repositório atualizado nesta branch (`git pull`).
Se o Windows bloquear scripts: `powershell -ExecutionPolicy Bypass -File .\scripts\windows\Preparar-Aplicacao.ps1 -Etapa verificar`.

## Sequência recomendada (uma por vez; depois de cada uma, rode `-Etapa verificar` e me envie o resultado)
1. `-Etapa verificar` — estado atual (somente leitura).
2. `-Etapa contexto` — tabela `contexto_sessoes` (a mais simples e isolada).
3. `-Etapa contexto-registrar` — função de gravação do Contexto Vivo (depende do passo 2).
4. `-Etapa contexto-extensao` — ponte com a tela do Bling (escopo novo + função da extensão; depende do passo 2).
5. `-Etapa ia-gratuito` — provedor gratuito (OpenRouter) com modos desligado/manual/automático. **Aplique ANTES de publicar o `assistente` e a `ia-config` novos.**
6. `-Etapa imagens` — colunas, índice único por hash e bucket privado `produto-imagens`.
7. `-Etapa oauth` — a mais sensível (recria 2 funções; hoje não há sessão OAuth ativa). Só depois dela publicar `conecta-gateway` e `conector-mcp` (cada deploy com seu clique de aprovação).

## Reversão
`-Etapa reverter-contexto`, `reverter-imagens` ou `reverter-oauth` (o de imagens e o do OAuth têm guardas que bloqueiam se já houver dado dependente).

Nada aqui altera o Bling, faz deploy ou publica o site.
