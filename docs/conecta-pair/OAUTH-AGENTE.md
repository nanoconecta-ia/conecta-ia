# OAuth do agente

Implementação: cliente público OAuth 2.1, PKCE S256 obrigatório, consentimento nativo por empresa, código de uso único (60s após aprovação), token opaco Pair, renovação com rotação e revogação. Todas as gerações de refresh emitidas na sessão são reconhecidas para detectar replay; a família tem limite de 256 rotações. Não entrega JWT Supabase, chave de IA nem credenciais Bling ao cliente.

Publicado em 18/10/2026: gateway v3 e consentimento nativo, com discovery/registro e bloqueio anônimo verificados na nuvem. [Evidências e limitações](PUBLICACAO-20261018.md). O consentimento e a instalação no cliente real continuam pendentes.

## Reuso e armazenamento

Não há tabela nova. O pedido usa `pair_desafios.oauth`; o vínculo do cliente e hashes de refresh ficam em `pair_sessoes`. A revogação do Pair, perda de papel e desativação da empresa continuam valendo. Metadados de cliente público (nome, redirects exatos, nonce) são assinados com HMAC e separação de domínio, usando o segredo já existente no cofre. O client ID é público e verificável pelo servidor; não concede acesso por si só. Isso permite registro dinâmico sem criar um cadastro paralelo de clientes. Nenhuma URL de metadados enviada pelo cliente é buscada pelo servidor.

O lojista vê o nome declarado do cliente, domínio de retorno, empresa, escopos e duração. Pode reduzir escopos/prazo e recusar renovação. Exige login recente (15 minutos); editor e lojista de outra empresa não autorizam. Cliente malicioso pode declarar um nome conhecido: o nome não é selo de verificação. O usuário deve reconhecer também o domínio mostrado.

## Descoberta e endpoints

Base/recurso: `https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/conecta-gateway`.

- `/.well-known/oauth-protected-resource`: recurso, emissor e escopos.
- `/oauth/.well-known/oauth-authorization-server` e `/oauth/.well-known/openid-configuration`: metadados do emissor com subcaminho. O alias OIDC é somente compatibilidade de discovery; a lista de algoritmos de ID token e o JWKS são vazios, e o escopo openid é recusado. O serviço não oferece login OpenID nem emite ID tokens.
- `/oauth/register`: DCR, cliente público `none`, redirects HTTPS ou HTTP loopback explícito, sem fragmentos/credenciais. Limites de tamanho e taxa.
- `/oauth/authorize`: registro assinado, redirect exato, resource correspondente e PKCE; redireciona ao painel `#/autorizar-agente`.
- `/oauth/token`: authorization_code ou refresh_token. Não aceita autenticação Basic. Tokens curtos, renovação limitada ao prazo absoluto escolhido pelo lojista.
- `/oauth/revoke`: invalida o token e a sessão correspondente; token desconhecido não revela dados.

Respostas de token não são cacheadas. Auditoria guarda sessão/empresa/usuário, consentimento e desfecho, sem código, verifier, token, refresh ou state. Replay válido de código ou refresh revoga a sessão. Access token OAuth não renova pelo endpoint antigo do Pair.

## Migrações e implantação

As duas migrações Pair foram aplicadas em 18/10/2026 e os nomes locais foram alinhados às versões remotas reais: `20261018230657_conecta_pair.sql` e `20261018230659_pair_consulta_bling.sql`. O conteúdo não mudou; nenhuma entrada do histórico remoto foi reparada. Os nomes antigos, datados de 19/10, colocariam a migração OAuth antes de suas dependências na aplicação local.

`20261018231016_oauth_agente.sql` foi criado inicialmente pela CLI Supabase 2.81.3 em runner descartável (run 39175359734); depois recebeu o SQL revisado. Foi aplicada remotamente como `20261018232515`; o painel de consentimento e o gateway autocontido foram publicados. Nunca executar `db push` genérico sobre produção. Conservar versões e fontes anteriores para reversão.

Rollback inicial: restaurar gateway v1, manter as tabelas e auditoria, revogar sessões e ocultar/desativar a conexão OAuth. A reversão não precisa apagar dados ou desfazer migrações antigas.

## Cliente real e aceite

O QR permite pareamento direto de cliente Bearer. Para este chat, adicionar o servidor MCP em [ChatGPT Plugins](https://chatgpt.com/plugins), escolher OAuth e concluir a autorização nativa. Cliente OAuth ainda precisa ser instalado/selecionado na conversa. Um merge, QR ou resposta de discovery não prova essa conexão.

O teste de aceite exige autenticação do proprietário, empresa Mobis e SKU 80692; ferramenta retornando `api_bling`, ambiente real e auditoria correspondente. Espelho não aprova o teste da API. Os testes de CI usam somente usuários/produtos sintéticos, Postgres descartável e SDK MCP real em loopback. Não enviar senhas ou tokens pelo chat.
