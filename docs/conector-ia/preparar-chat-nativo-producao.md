# Chat nativo do Conecta.IA em produção: preparação (nada aplicado)

Estado verificado em 2026-10-19, só leitura, no projeto `conecta-ia` (`dsfzhsrudriqkumtlqwj`).

## O que o chat nativo precisa de um modelo
O QR e o código de verificação autorizam **quem opera** (o lojista). Não dão um modelo de IA. Dentro do chat nativo quem responde é um modelo chamado por **chave de API** da loja (`loja_chaves_ia`, cadastrada em Integrações de IA, cifrada no servidor). Usar a assinatura do ChatGPT só seria possível se a OpenAI habilitar o Conecta.IA como aplicativo participante do "Entrar com o ChatGPT"; isso **não foi verificado** e não entra neste plano.

## Estado de produção (conferido)
| Item | Produção hoje |
|---|---|
| Tabelas `agente_*`, `produto_travas`, `provedor_capacidades` | **não existem** (sem colisão de nome) |
| Tipos `risco_nivel`, `agente_msg_papel`, `tarefa_estado`, `proposta_estado`, `item_estado`, `operacao_estado`, `produto_estado_op` | **não existem** |
| `private.auditar` | não existe (a 0003 cria) |
| Bucket `agente-anexos` | não existe (a 0006 cria) |
| `loja_mcp_chaves` | existe (a 0004 acrescenta colunas e uma constraint) |
| `aprovacoes`, `auditoria` (com `antes`/`depois`) | existem |
| `loja_chaves_ia`, `loja_plugins`, `loja_busca_imagem` | existem |
| Funções `chat_*` (chat operacional anterior) | existem |
| Edge Functions `conector-chat`, `conector-conversas`, `conector-chaves`, `conector-aprovacoes`, `conector-mcp` | **não publicadas** |
| Edge Function `ia-config` (cadastro da chave de IA) | publicada |

## Migrações que o chat nativo exige (ordem)
1. `20261019000001_conector_ia_estado.sql`: tipos e tabelas de estado (conversas, mensagens, tarefas, propostas, aprovações do agente, travas).
2. `20261019000003_conector_ia_rpcs.sql`: máquina de estados no banco (aprovação presa à versão, trava por produto, idempotência).
3. `20261019000006_agente_anexos_bucket.sql`: bucket privado de anexos.
4. `20261019000004_mcp_gateway_chaves.sql`: só se o `conector-mcp` for publicado (chave por loja para clientes MCP externos). **Opcional** para o chat nativo; o gateway por QR/OAuth já cobre agentes externos.

Pipeline de indexação, custos e aprendizado (`…0009`, `…0010`, `…0012`) ficam para depois: o chat funciona sem eles.

## Riscos a tratar antes de aplicar
- A 0004 altera `loja_mcp_chaves` (tabela existente): ensaiar em ramo do banco antes.
- Os testes locais passam, mas a produção pode ter divergido do repositório: ensaiar as migrações 1 a 3 em um **ramo do Supabase** (`create_branch`) e só então aplicar. Criar ramo pode gerar custo; precisa de autorização.
- Nenhuma ferramenta de escrita no Bling é ligada: o chat só consulta e propõe, aprovação continua do lojista.
- Custo de IA por loja: definir limite mensal de tokens em Integrações de IA antes do primeiro uso.

## Passos de implantação (cada um precisa de autorização específica)
1. Ensaio em ramo do banco: migrações 1 a 3, rodando `supabase/tests`.
2. Aplicar 1 a 3 em produção.
3. Empacotar e publicar `conector-chat`, `conector-conversas`, `conector-chaves`, `conector-aprovacoes` (gerar `artifacts/*` com o empacotador, com conferência de hash no CI).
4. O lojista cadastra a chave de IA e o limite mensal em Integrações de IA (a chave nunca passa por quem implanta).
5. Republicar o painel com `VITE_CONECTOR_ATIVO=1` (hoje as telas do Conector ficam escondidas por esse sinal).
6. Teste de ponta a ponta com um SKU, somente leitura, e depois uma proposta de enriquecimento com fonte.

## Fora do escopo
Escrita no Bling, alteração de DNS, câmera/leitor de código de barras e "Entrar com o ChatGPT".
