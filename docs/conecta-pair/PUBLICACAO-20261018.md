# Publicação do estúdio, Pair e OAuth — 18/10/2026

Projeto exclusivo: `nanoconecta-ia/conecta-ia`, Supabase `conecta-ia` (`dsfzhsrudriqkumtlqwj`). Publicação e migrações autorizadas expressamente pelo proprietário nesta sessão.

## Interface publicada

[Estúdio](https://nanoconecta-ia.github.io/conecta-ia/#/estudio), com torre lateral recolhível, janela flutuante e layout responsivo. O consentimento OAuth fica em `#/autorizar-agente` quando iniciado pelo cliente; não abrir essa rota com código inventado. Pair habilitado no build (`VITE_PAIR_ATIVO=1`).

- [Publicação do estúdio — sucesso](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39175637450).
- [Publicação do consentimento — sucesso](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39176540696).
- HTTP remoto do painel: 200; bundle `assets/index-CxCEfWBm.js` em 18/10/2026.
- [Revisão visual — sucesso](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39176441082): estúdio em 1440/1024/768/390 px e consentimento em 1440/390 px. Componente real, respostas de rede simuladas. Não é evidência de navegação real no ERP.

## Banco e funções

| Arquivo local | Versão registrada remotamente | Resultado |
|---|---|---|
| `20261018230657_conecta_pair.sql` | `20261018230657` | Aplicada |
| `20261018230659_pair_consulta_bling.sql` | `20261018230659` | Aplicada |
| `20261018231016_oauth_agente.sql` | `20261018232515` | Aplicada |

Os dois arquivos Pair tiveram seus nomes locais alinhados às versões efetivas, preservando o conteúdo. A migração OAuth foi criada inicialmente pela CLI 2.81.3 no [runner descartável](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39175359734) e recebeu o SQL revisado. Nenhum reparo do histórico remoto foi executado. Não usar `db push` genérico.

Pair reaproveita as quatro tabelas de dispositivos, desafios, sessões e aprovações já aprovadas no desenho. OAuth acrescenta somente campos/índice/RPCs às tabelas Pair; não cria tabela de clientes nem fila nova.

- `pair` v1: `6695e1ef063df7e61c6765d0f9ea8e02962eb6c23a957473a1a795ab09fca2d7`.
- `conecta-gateway` v3 ACTIVE: `a6d685add0983be7324fee21274a665a7d3746f01aafeff9e4980df4a5240c48`. Fonte recuperada após deploy idêntica ao artefato validado no PR #37.
- `assistente` v6 e `bling-conectar`/`bling-callback` v5 preservados nesta entrega.
- Pair/gateway têm `verify_jwt=false` para autenticação própria por desafio/sessão; aprovação usa JWT nativo do proprietário. Isso não libera consultas anônimas.

A verificação inicial encontrou metadata 405 e DCR 401 por remoção de `/functions/v1` no proxy Supabase. [PR #37](https://github.com/nanoconecta-ia/conecta-ia/pull/37) corrige somente os prefixos conhecidos; os metadados continuam anunciando URLs públicas. O teste de SDK reproduz esse proxy. Smoke remoto após a correção: discovery de recurso 200 (req. 181), discovery de servidor 200 (182), registro público de cliente 201 (183), tools/list sem autenticação 401 com WWW-Authenticate (184). O registro de cliente público não concede sessão nem acesso a produto. Nenhuma sessão Pair/OAuth foi criada pelo smoke.

O mesmo PR restaura o nome histórico da fixture M5 no commit fixado, sem alterar o caráter manual/local/sintético do workflow.

## Segurança e CI

[OAuth com SDK MCP 1.32.0](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39176877632), [SQL e funções](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39176877629), [artefatos](https://github.com/nanoconecta-ia/conecta-ia/actions/runs/39176877714). Testes com dados sintéticos e sem segredos de produção: PKCE S256 obrigatório; redirect/cliente/recurso exatos; consentimento e autenticação recente; editor e outra loja recusados; escopos/prazo somente reduzidos; código de uso único; replay de código/refresh revoga sessão; rotação e revogação; hashes de refresh invisíveis ao navegador; falha de auditoria bloqueia entrega. Localmente passaram 7 casos OAuth, 17 casos do artefato e 3 guardas M5.

Advisors comparados antes/depois. Permanecem os avisos preexistentes de [pg_net no schema public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) e [proteção de senha vazada desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). O aviso de [RPCs SECURITY DEFINER executáveis por authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) passou de 5 para 14: sete RPCs Pair e duas OAuth intencionalmente acessíveis, com autorização interna testada. `pair_desafios` tem RLS sem política de acesso direto por desenho; os RPCs controlados realizam a operação. Não se declara ausência de avisos de segurança.

## Conexão e aceite pendentes

Servidor MCP: `https://dsfzhsrudriqkumtlqwj.supabase.co/functions/v1/conecta-gateway`. Instalar no cliente com OAuth, entrar com login próprio, escolher Mobis Autopeças e autorizar somente `bling:consultar` por 15 minutos. Não enviar credenciais pelo chat. O SDK real passou em loopback com consentimento e produto simulados; compatibilidade com o cliente ChatGPT real ainda depende dessa instalação.

O inventário de Desktop Commander retornou zero dispositivos. Conectar um PC/notebook em https://mcp.desktopcommander.app/ e fazer login no Bling no próprio navegador. Não há visualização nem controle remoto do ERP só porque o estúdio está publicado. A área de browser incorporada permanece pendente de uma sessão autenticada e canal de visualização/controle; conectar o dispositivo é o primeiro requisito.

Para aceitar o fluxo real: chamar `conecta.bling_consultar_produto` com SKU `80692`, verificar Mobis/identidade, `origem=api_bling`, `ambiente=real`, horário e hash correspondente na auditoria; revogar a sessão e comprovar 401. Resultado `espelho` é fallback, não prova consulta à API. Não houve consulta real do agente ao produto nesta entrega, nenhuma escrita no ERP e nenhum gasto de API GPT. A instalação externa OAuth não fornece uma chave GPT ao chat interno do painel.

Executores para publicar imagens no site/Bling, mapear taxonomia entre ERPs e publicar SEO técnico continuam exigindo implementação e aprovação específica. Sem contrato de infraestrutura paga de browser e sem mudança de DNS.

## Reversão

Revogar sessões/dispositivos pelo proprietário e desligar `chat_consulta_bling` da loja bloqueia novas leituras. Restaurar o artefato gateway v1 validado do PR #35 remove os endpoints OAuth, mantendo Pair e auditoria; ocultar Pair em um build autorizado do painel remove sua entrada. Fontes v1 foram guardadas antes do OAuth; migrações e registros de auditoria não devem ser apagados para reverter interface. Credenciais de ERP e do Supabase não mudaram nesta entrega.
