#!/usr/bin/env bash
# Revisão da migração 20261019000004 (mcp_gateway_chaves) contra o estado de PRODUÇÃO: a tabela loja_mcp_chaves já existe (migração de 2026-10-13).
# Num Postgres DESCARTÁVEL: aplica tudo menos a 0004, grava chaves "legadas" e aplica a 0004 por cima. Confere que os dados ficam, que chave sem
# expiração deixa de valer (falha fechada) e que escopo fora da lista bloqueia a migração (por isso a consulta prévia do roteiro de produção).
# Uso: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres supabase/tests/mcp_chaves_preserva_dados.sh  (nunca contra o Supabase)
set -uo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-conecta_preserva}
IGNORAR='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron|20261019000004_mcp_gateway_chaves'
psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
export PGDATABASE=$DB
psql -q -X -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null 2>&1 || { echo "stub falhou"; exit 1; }
for f in migrations/*.sql; do [[ "$f" =~ $IGNORAR ]] && continue; psql -q -X -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>/tmp/preserva.erro || { echo "FALHOU $f"; head -3 /tmp/preserva.erro; exit 1; }; done
L=aaaaaaaa-0000-0000-0000-00000000000a
psql -q -X -v ON_ERROR_STOP=1 <<SQL >/dev/null
insert into public.lojas (id, nome, slug) values ('$L','Loja A','loja-a');
insert into public.loja_mcp_chaves (loja_id, nome, hash_chave, escopos) values
  ('$L','legada-ativa', repeat('1',64), array['leitura']),
  ('$L','legada-propor', repeat('2',64), array['leitura','propor']);
insert into public.loja_mcp_chaves (loja_id, nome, hash_chave, escopos, revogada_em) values ('$L','legada-revogada', repeat('3',64), array['leitura'], now());
SQL
psql -q -X -v ON_ERROR_STOP=1 -f migrations/20261019000004_mcp_gateway_chaves.sql >/dev/null 2>/tmp/preserva.erro || { echo "FALHOU a 0004 sobre dados legados"; head -3 /tmp/preserva.erro; exit 1; }
falhas=0
chk() { if [ "$2" = "$3" ]; then echo "ok      $1"; else echo "FALHOU  $1 (esperado $3, veio $2)"; falhas=$((falhas+1)); fi; }
chk "3 chaves legadas preservadas" "$(psql -qAt -c "select count(*) from public.loja_mcp_chaves")" 3
chk "hashes e escopos intactos" "$(psql -qAt -c "select count(*) from public.loja_mcp_chaves where hash_chave in (repeat('1',64),repeat('2',64),repeat('3',64)) and escopos is not null")" 3
chk "colunas novas nulas nas legadas" "$(psql -qAt -c "select count(*) from public.loja_mcp_chaves where expira_em is null and prefixo is null and criada_por is null")" 3
chk "chave legada SEM expiração é recusada (falha fechada)" "$(psql -qAt -c "select count(*) from public.mcp_chave_validar(repeat('1',64))")" 0
chk "chave revogada continua recusada" "$(psql -qAt -c "select count(*) from public.mcp_chave_validar(repeat('3',64))")" 0
chk "chave legada fica fora do limite de ativas" "$(psql -qAt -c "select count(*) from public.loja_mcp_chaves where loja_id='$L' and revogada_em is null and expira_em > now()")" 0
# cenário de risco: escopo fora da lista bloqueia a 0004 (a produção tem 0 linhas; a consulta prévia do roteiro confirma antes de aplicar)
psql -qAt -d postgres -c "drop database if exists ${DB}_ruim" -c "create database ${DB}_ruim" >/dev/null
export PGDATABASE=${DB}_ruim
psql -q -X -f tests/stub_supabase.sql >/dev/null 2>&1
for f in migrations/*.sql; do [[ "$f" =~ $IGNORAR ]] && continue; psql -q -X -f "$f" >/dev/null 2>&1; done
psql -q -X >/dev/null <<SQL
insert into public.lojas (id, nome, slug) values ('$L','Loja A','loja-a');
insert into public.loja_mcp_chaves (loja_id, nome, hash_chave, escopos) values ('$L','escopo-antigo', repeat('4',64), array['escrever']);
SQL
# --single-transaction imita o apply_migration/CLI do Supabase (arquivo inteiro numa transação). Sem isso o psql aplicaria os ALTER anteriores à falha.
if psql -q -X -1 -v ON_ERROR_STOP=1 -f migrations/20261019000004_mcp_gateway_chaves.sql >/dev/null 2>&1; then echo "FALHOU  escopo fora da lista deveria bloquear a 0004"; falhas=$((falhas+1)); else echo "ok      escopo fora da lista bloqueia a 0004 (transação inteira desfeita)"; fi
chk "0004 não deixou resíduo após falhar" "$(psql -qAt -c "select count(*) from information_schema.columns where table_name='loja_mcp_chaves' and column_name='expira_em'")" 0
psql -qAt -d postgres -c "drop database if exists $DB" -c "drop database if exists ${DB}_ruim" >/dev/null
[ "$falhas" -eq 0 ] && echo "todas as verificações passaram" || { echo "$falhas falha(s)"; exit 1; }
