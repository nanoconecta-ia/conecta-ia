# Banco (Supabase `conecta-ia`)

Migrações 1 a 7 da Fase 1 em `migrations/`, **aplicadas em 2026-10-13** no projeto `conecta-ia` (ref `dsfzhsrudriqkumtlqwj`) com autorização explícita. Novas migrações: conferir o ref antes (nunca o do NanoShell IA).

## Teste local (Postgres 16, sem tocar no Supabase)
```
createdb t
psql -v ON_ERROR_STOP=1 -d t -f tests/stub_supabase.sql   # imita roles e auth.* do Supabase (só teste)
for f in migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d t -f $f; done
psql -v ON_ERROR_STOP=1 -d t -f tests/rls_isolamento.sql   # duas lojas fictícias; desfaz tudo no fim
```

## Regras que o esquema impõe
- Toda tabela de loja tem `loja_id` e RLS; lojista só vê a própria loja.
- Espelho do Bling e filas: escrita só pelo servidor (`service_role`); lojista não edita produto.
- Segredos (tokens do Bling, chaves de IA) em `private.*`, cifrados, sem acesso do navegador; chaves MCP só como hash.
- Super admin = `app_metadata.papel = 'super_admin'` **e** sessão MFA (`aal2`).
- Permissão de venda = bloqueio do super admin ∩ escolha do lojista (`motivo_bloqueio_venda`).
- Auditoria só de inserção.

## Pendente
Pedidos/checkout, banners/páginas, categorias/fabricantes, aplicação veicular. A cifragem dos segredos é feita no servidor (`CREDENCIAIS_CHAVE_CIFRA`); o banco só guarda o texto cifrado.

## Migrações 8 e 9 (aplicadas em 2026-10-14 com autorização)
`20261014000002_taxonomia_codigos_autopecas.sql` + `tests/taxonomia_codigos.sql` (15 checks).

## Migração 10 (aplicada em 2026-10-14 com autorização)

## Migração 11 (aplicada em 2026-10-14 com autorização)
`20261014000005_loja_politicas.sql` + `tests/loja_politicas.sql` (10 checks). Rascunho da Mobis criado só com a razão social.
`20261014000004_memoria_familias_publicacao.sql` + `tests/memoria_publicacao.sql` (21 checks): memória, famílias, equivalências, entradas, taxonomia inicial, publicação com portão, vínculo companyId->loja.

## Migração 12 (aplicada em 2026-10-14 com autorização)
`20261014000006_ambiente_recursos_ajuda.sql` + `tests/ambiente_recursos.sql` (14 checks): ambiente teste/produção com requisitos, modo catálogo, recursos por loja, ajuda curada.

## Migração 13 (aplicada em 2026-10-14 com autorização)
`20261014000007_fiscal.sql` + `tests/fiscal.sql` (14 checks): regime da loja, tabelas oficiais versionadas, fiscal do produto, log fiscal imutável.

## Migrações 14 e 15 (aplicadas em 2026-10-14 com autorização)
`20261014000008_revisoes_supersessoes_bula.sql` e `20261014000009_notificacoes_contador.sql` + `tests/revisoes_bula_contador.sql` (19 checks). Total local: 118 checks.

## Migração 28 — Conecta Pair (PROPOSTA, NÃO APLICADA)
`20261019000001_conecta_pair.sql` + `tests/conecta_pair.sql` (137 verificações) + `tests/conecta_pair_concorrencia.sh` (várias conexões simultâneas). Pareamento por QR, sessões de dispositivo e Central de Aprovações. Aplicar só com autorização explícita; bloco ROLLBACK no fim do arquivo. Teste local: `PGHOST=… PGUSER=postgres tests/rodar_local.sh` (Postgres 16 descartável; ignora as 3 migrações que dependem de pg_net/vault/pg_cron do Supabase).
