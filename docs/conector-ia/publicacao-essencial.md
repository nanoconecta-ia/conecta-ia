# Publicação do essencial (APLICADA em 2026-10-19, só banco)

Projeto de destino: **conecta-ia**, ref `dsfzhsrudriqkumtlqwj` (sa-east-1). Nunca o ref do NanoShell IA.

## Estado de produção lido hoje (somente leitura)
- 44 migrações aplicadas, a última `oauth_agente` (20261018232515). Nenhuma das nossas `20261019…` está aplicada.
- 15 Edge Functions ativas; **nenhuma** de `loja-seo`, `conector-*`: só as existentes (`loja-publica` v2 etc.).
- A produção já tem `conversas`, `mensagens`, `aprovacoes`, `loja_mcp_chaves` e `pair_*`, que **se sobrepõem** às nossas tabelas `agente_*` (migrações 0001, 0003, 0004, 0009, 0010, 0012). Por isso essas ficam FORA até a reconciliação.
- Dados existentes na genealogia: 10 montadoras, 10 modelos, 10 motores, 9 peças de referência, 4 aplicações. Nada disso é alterado pelo conjunto abaixo (só colunas novas, nulas).

## Conjunto essencial (só banco, aditivo, sem Edge Function)
| Migração | O que faz |
|---|---|
| `…0002` | árvore funcional (sistemas com ícone), documentos técnicos, identificadores oficiais |
| `…0007` | busca direta por código OEM (leitura) |
| `…0008` | duplicidade, cruzados e aplicações (leitura) |
| `…0011` | grafo do veículo (leitura) |
| `…0013` | compartilhamento por motor como hipótese e peças da loja por veículo (leitura) |
| `…0014` | atores, regime BR, bula técnica, intercâmbio e filtros da vitrine |
| `…0015` | vocabulário da busca (leitura) |

Colunas novas (nulas) em `fabricantes_peca`, `versoes` e `taxonomia_nos`; 4 tabelas novas com RLS; funções só para `service_role`.

## Verificação feita (local, descartável)
Base = todas as migrações anteriores a `20261019` + o conjunto acima, num Postgres limpo: todas aplicaram sem erro e passaram `busca_por_veiculo` (14), `camada_conhecimento` (20), `vocabulario_de_busca` (3) e `grafo_do_veiculo` (13). Não foi testado contra uma cópia dos dados reais.

## Fica de fora, e por quê
- `…0001/0003/0004/0009/0010/0012` (`agente_*`, pipeline, aprendizado, chaves MCP): sobrepõem tabelas de produção; exigem reconciliação.
- `…0005/0006` (imagens e bucket): a `loja-publica` e a `loja-seo` atuais dependem delas; sai junto com as funções.
- **Edge Functions** (`loja-publica` nova, `loja-seo`, `conector-*`): não implantadas. Sem as funções, os filtros e blocos ainda não aparecem no site; o essencial deixa o **banco pronto**.

## Reversão
Antes: backup/branch do banco. Depois, se preciso: `drop function` das 11 funções novas, `drop table` das 4 tabelas novas e `alter table … drop column` das colunas novas (todas nulas e sem dado). Lista exata no momento da aplicação.

## Como validar depois
Conferir `list_migrations`, `get_advisors` (segurança) e uma consulta de cada função com o service role.

## Resultado da aplicação (2026-10-19, ~11:28–11:31 UTC)
Autorizada pelo dono para este conjunto exato (0002, 0007, 0008, 0011, 0013, 0014, 0015), sem Edge Function. Aplicada no projeto `dsfzhsrudriqkumtlqwj` com `apply_migration`, uma por vez, na ordem.
- Antes: conferi que nenhuma tabela, coluna ou função do conjunto já existia e que todas as colunas usadas existem em produção.
- Depois (consultas só de leitura): 7 migrações registradas; 20 sistemas mecânicos semeados, todos `proposta` (material do dono); 12 funções criadas, **nenhuma** executável por `anon` ou `authenticated`; 6 tabelas novas com RLS; `pecas_ref` (9) e `produtos` (4) inalterados; nenhum fabricante classificado nem versão com regime (nada inventado); vocabulário com 10 modelos e 49 famílias de peça.
- Advisors de segurança: nenhum achado novo vindo deste conjunto. Os achados que existem já vinham de antes (funções `pair_*`, `chat_*`, `aprovacao_decidir` executáveis por usuário logado; `pg_net` em `public`; proteção contra senha vazada desligada) e **não foram tocados**: merecem decisão à parte.
- Atenção: a ferramenta de aplicação gravou versões próprias (`20261019112811…20261019113045`) diferentes dos nomes de arquivo do repositório (`20261019000002…`). Um futuro `supabase db push` precisa ser reconciliado com isso antes de ser usado.
- Não há backup automático no plano gratuito; a reversão é manual (itens acima) e nenhum dado existente foi alterado.
- Continua fora: Edge Functions (a vitrine e o agente ainda não usam essas funções), migrações `agente_*`, imagens e bucket.
