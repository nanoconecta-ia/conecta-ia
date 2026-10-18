#!/usr/bin/env bash
# Roda os testes SQL localmente num Postgres 16 DESCARTÁVEL (nunca no Supabase). Uso:
#   PGHOST=/tmp PGPORT=5544 PGUSER=postgres supabase/tests/rodar_local.sh [arquivo_de_teste.sql ...]
# Cria o banco "conecta_teste", aplica o stub do Supabase e as migrações e roda os testes (padrão: conecta_pair.sql).
# As 3 migrações de infraestrutura do Supabase (pg_net, vault, pg_cron) não existem fora dele e são ignoradas aqui.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-conecta_teste}
IGNORAR='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron'
psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
export PGDATABASE=$DB
psql -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null
for f in migrations/*.sql; do
  if [[ "$f" =~ $IGNORAR ]]; then echo "ignorada (infra Supabase): $f"; continue; fi
  psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
TESTES=("$@"); [ ${#TESTES[@]} -eq 0 ] && TESTES=(tests/conecta_pair.sql)
for t in "${TESTES[@]}"; do
  echo "== $t"; psql -q -v ON_ERROR_STOP=1 -f "$t" 2>&1 | grep -E "^psql:.*(ERROR|FALHOU)|ERROR:|FALHOU" && exit 1 || true
  echo "   $(psql -q -v ON_ERROR_STOP=1 -f "$t" 2>&1 | grep -c 'NOTICE:  ok') verificações ok"
done
