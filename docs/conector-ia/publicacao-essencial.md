# Publicação do essencial (proposta, aguardando autorização)

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
