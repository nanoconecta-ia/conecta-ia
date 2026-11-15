# Conecta.IA — Escopos de plugins MCP, Nano e acessórios (auditoria de 15/11/2026)

## Duas direções, duas autorizações diferentes

1. **Cliente externo → Conecta.IA**: `/functions/v1/conector-mcp` com OAuth e escopos `mcp:leitura` e `mcp:propor`. A ferramenta somente consulta ou cria proposta *a confirmar*. Não executa no ERP. A rota `/functions/v1/conecta-gateway` é outra audiência/servidor; usa `chat:responder` para consumir e responder à fila de mensagens do Nano. Não reutilizar token ou escopo automaticamente entre os dois recursos.
2. **Conecta.IA → plugin externo**: `loja_plugins` armazena tipos `api`, `mcp`, `llm`, `plugin_pull`. **Só há adaptador de chamada SDK v1 para tipo `api`**; o chat persistente `assistente/chat.ts` ainda passa `plugins: []`. Logo, mesmo uma API registrada e testada NÃO comprova execução pelo Nano. Não simular sucesso. MCP/LLM/pull são rascunhos, sem execução habilitada.

## Matriz de permissões

| Ator / recurso | Leitura | Preparar proposta | Alterar cadastro do Conecta | Executar no Bling | Aprovar |
|---|---|---|---|---|---|
| Cliente MCP `mcp:leitura` | Sim, só loja e campos autorizados | Não | Não | Não | Não |
| Cliente MCP `mcp:propor` | Exige também `mcp:leitura` para leitura | Sim, fila `a_confirmar` | Não diretamente | Não | Não |
| Cliente QR `chat:responder` | Apenas mensagens reservadas para a sessão | Não | Não | Não | Não |
| Plugin `api` LOW cadastrado | Adaptador SDK v1; operação no chat não homologada | Não se equipara a aprovação | Não por este escopo | Não por este escopo | Não |
| Plugin `mcp`/`llm`/`plugin_pull` | Cadastro sem execução | Não | Não | Não | Não |
| Administrador / humano | Segundo permissões de loja | Sim | Após validação da operação | Apenas no fluxo específico de aprovação, nunca via token MCP | Segundo autorização humana |
| GitHub/Supabase conectados ao ChatGPT | Somente conforme permissões desses conectores | Segundo função de cada app | Alterações técnicas com revisão/CI | Não implica permissão para operação ERP | Não herda aprovação Bling |

## Evidências verificadas

- `public.loja_plugins`: registro **Gpt**, tipo `mcp`, risco `CRITICAL`, ativo `false`, seis capacidades declaradas, **sem URL** e sem teste; não é um servidor conectado.
- Política `loja_plugins_ver`: SELECT condicionado à associação do usuário com a loja; alterações são feitas por `ia-config`, com autenticação e funções de servidor.
- `plugin_credencial`, `plugin_salvar`, `plugin_definir_ativo`, `plugin_marcar_teste`, `plugin_remover`: EXECUTE para `service_role`, negado a `anon` e `authenticated`.
- `conecta.plugins.chamar`: barrada no gateway MCP pela política de exposição, distinta do chat; no chat atual, `plugins: []` impede execução de registros.
- A página `Integracoes.tsx` permite cadastrar plugin do tipo MCP como metadado; cadastro/risco/capacidade declarados não garantem implementação nem acesso.
- O gateway OAuth de `conecta-gateway` possui documentação `.well-known`, PKCE e renovação. Isso não garante que a conta ChatGPT aceite configurar servidor personalizado.

## Critérios mínimos para implementar adaptador MCP externo no Nano

1. Vincular plugin a uma **loja** e a uma **auditoria**; verificar concessão de capacidades e identidade do servidor real, com URLs públicas aprovadas e proteção SSRF/DNS.
2. Descobrir ferramentas e schemas de entrada no endpoint MCP remoto; exigir **consentimento por ferramenta** e escopos mínimos. Não transpor a lista de seis capacidades genéricas para permissão irrestrita.
3. Separar leitura de proposta e execução; retorno do plugin é dado não confiável, nunca instrução para aprovar ou executar.
4. Permitir bloqueio, revogação e observabilidade por conexão; controlar chamadas, tempos, retries e acessos sem segredos em logs.
5. Homologar com plugin de **teste real** antes de habilitar produção: teste de protocolo, autenticação, ferramenta, resultado, UI, auditoria, revogação e isolamento por loja.
6. Qualquer escrita de produto/estoque/fiscal permanece na Central de Aprovações, sujeita às regras de NF e Bling — não decorre de `mcp:propor`, `chat:responder`, `LOW` ou `CRITICAL`.

## Decisão de implantação deste PR

Aplicar **bloqueio da ativação automática** a plugin sem URL e teste válido, a tipos sem executor e a riscos MEDIUM/HIGH/CRITICAL. Atualizar a interface para exibir esses limites. **Não** ativar o registro Gpt ou ampliar seu escopo. **Não** conectar o ChatGPT à conta do proprietário, nem habilitar processamento autônomo contínuo, pois exigem autenticação e homologação separados.
