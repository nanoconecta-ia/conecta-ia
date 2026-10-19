# Agente externo e consulta Bling

Estado em 18/10/2026: estúdio publicado, Pair v1 e gateway com OAuth implantados; migrações Pair e OAuth aplicadas. O consentimento do proprietário e a conexão do cliente ainda são necessários. Este documento não registra teste real do novo gateway. Evidências e versões: [PUBLICACAO-20261018.md](PUBLICACAO-20261018.md).

## O que esta alteração entrega

`conecta.bling_consultar_produto({"sku":"80692"})` usa o mesmo registry e cliente Bling do chat interno, sem duplicar fila, chave, OAuth do ERP ou cadastro de produto. O gateway valida a sessão Pair no banco a cada chamada. Loja, usuário e dispositivo vêm dessa sessão; o agente não fornece loja, ID Bling, URL ou credencial. O SKU é resolvido dentro da loja.

O consentimento novo `bling:consultar` é obrigatório, inclusive para listar essa ferramenta. `produtos:ler` continua limitado às ferramentas de espelho existentes; nenhuma sessão existente recebe o consentimento novo automaticamente. A consulta também depende da flag por loja `chat_consulta_bling`, já existente e reutilizada. Desligá-la bloqueia a próxima consulta.

Apenas `GET /produtos/{id}` é permitido. Renovação OAuth pode girar credenciais internas, sem alterar cadastro, imagem, estoque ou preço no ERP. Há limite de 60 consultas por loja/minuto, além dos limites da sessão, prazo global de 8 segundos e recuo limitado de leitura. O resultado contém somente SKU, nome, preço e estoque. API e espelho têm origem, data e motivo de fallback distintos; respostas parciais da API não incorporam campos do espelho com rótulo de API.

`pair.bling_consulta` registra loja/usuário/sessão/dispositivo, origem, hash da evidência, status e duração, sem texto do chat, dados fiscais ou segredos. O gateway também registra o desfecho e as chaves dos argumentos. Falha na auditoria bloqueia a entrega do resultado. Uma proposta pode já ter sido registrada se sua auditoria posterior falhar: isso não desfaz o pedido nem autoriza repetir escritas às cegas. A leitura Bling não grava produto.

`PAIR_AMBIENTE=sintetico` identifica simulação; `real` permite evidência identificada como real. No projeto canônico Conecta, a ausência assume `real`; em outro projeto ou com valor inválido, gera `nao_validado`. O rótulo não prova a procedência sozinho: o aceite real exige chamada autenticada do cliente, origem API, identidade correspondente e auditoria verificável. Todos os testes automatizados desta alteração usam identidades e dados sintéticos.

## Artefatos e banco

Gerar com Node 24.19.0: `node --experimental-vm-modules scripts/gerar-pair.mjs`. Conferir com `--check`. Os diretórios `artifacts/pair` e `artifacts/conecta-gateway` contêm arquivo autocontido e manifesto SHA-256, com SDK Supabase fixo em 2.117.3. Evita-se o problema de bundling observado no assistente; nenhuma edição manual do gerado.

A migração nova `20261018230659_pair_consulta_bling.sql` apenas substitui a allowlist privada de consentimentos, preservando ACLs e sessões. Não cria tabela. Depende da migração Pair `20261018230657_conecta_pair.sql`, implantada em 18/10/2026. O CI aplica todas as migrações somente em Postgres descartável. Não executar `db push` genérico: o histórico remoto do chat operacional usa versão distinta, registrada na entrega anterior.

Antes da implantação Pair, revisar o diff completo da migração original, inventariar dependências/ACLs remotas, guardar fontes atuais e checar `APP_URL`, chaveiro existente e ambiente sem expor valores. `pair` e `conecta-gateway` usam `verify_jwt=false` porque validam seus próprios desafios e sessões opacas. A aprovação e revogação do lojista continuam com JWT nativo e RPC; nunca fabricar JWT nem aprovar em nome do usuário.

O painel publicado usa `VITE_PAIR_ATIVO=1`. Isso disponibiliza o fluxo de autorização; não cria sessão nem concede acesso por si só. Rollback inicial: desabilitar a flag Bling da loja, revogar sessões, manter histórico/auditoria e voltar a ocultar o Pair no build. Não remover tabelas para desfazer uma publicação.

## Conectar o cliente correto

Um QR aprova uma sessão do Conecta. Não instala ferramentas nesta conversa nem espelha a sessão ChatGPT. O token fica fora do QR e não deve ser colado em chat, código, issue ou log.

Para um cliente compatível com Bearer, como Codex CLI, a configuração fica no ambiente privado do operador, depois de um pareamento nativo aprovado. Exemplo sem credenciais:

```toml
[mcp_servers.conecta_ia]
url = "https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/conecta-gateway"
bearer_token_env_var = "CONECTA_PAIR_TOKEN"
```

A variável recebe o token completo `<token>.<sal>` no computador do operador. Respeitar expiração e revogação. Para token fixo, escolher sessão curta sem rotação; para rotação, o cliente precisa atualizar a variável e a conexão com o token novo. O servidor não revela as chaves Supabase/Bling.

Para conectar este chat pelo ChatGPT, foi implementada a ponte OAuth descrita em [OAUTH-AGENTE.md](OAUTH-AGENTE.md): descoberta, registro público, autorização nativa por empresa, PKCE S256, códigos de uso único, redirect exato, renovação/revogação e vínculo com sessões Pair. Reutiliza as tabelas existentes. O proprietário precisa instalar o servidor MCP no cliente e concluir o consentimento; a instalação no ChatGPT real ainda precisa ser validada. Não desabilitar autenticação para contornar incompatibilidade.

Referências oficiais verificadas em 18/10/2026: [MCP no Codex](https://developers.openai.com/codex/mcp/) e [MCP personalizado no ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server). A primeira documenta Bearer por variável; a segunda lista OAuth e acesso sem autenticação, não o token manual de Pair como fluxo OAuth.

## Browser, imagens, taxonomia e SEO

O inventário Desktop Commander desta sessão retornou zero dispositivos conectados. A área browser do estúdio permanece pendente até haver navegador autenticado, isolado por loja e com canal de controle/visualização. Não há sessão remota ativa só porque a interface foi construída. Não foi contratado serviço de browser nem realizado gasto GPT.

Consultar taxonomia e imagens aprovadas no estúdio já funciona pela camada existente. Executores de publicação de imagens no site e no Bling, mapeamento de taxonomia por ERP e SEO técnico publicado ainda precisam de implementação e validação próprias. Imagem/site e imagem/Bling são destinos distintos, com antes/depois, hash da versão aprovada, fonte/direitos e evidência. Agente não se autoaprova; uma proposta não equivale a execução. O registry de escritas do Bling permanece bloqueado.

## Aceite operacional pendente

Loja piloto: Mobis Autopeças, SKU 80692. Após implantação validada e conexão nativa do cliente, o lojista concede somente `bling:consultar` por 15 minutos. Executar initialize → tools/list → tools/call, conferir `origem=api_bling`, identidade, horário e hash da evidência na auditoria. Revogar e comprovar 401 na chamada seguinte; outra loja e argumentos de roteamento devem ser recusados. Fallback `espelho` não aprova o teste de API real. Não usar credenciais de produção em CI nem dados simulados como evidência real.
