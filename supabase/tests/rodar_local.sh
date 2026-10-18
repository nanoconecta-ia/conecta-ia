#!/usr/bin/env bash
# Sobe um Postgres LOCAL descartável, aplica o stub do Supabase + todas as migrações em ordem e roda os testes SQL.
# Nunca toca no projeto Supabase real. Uso: supabase/tests/rodar_local.sh [banco] [teste.sql ...]
# Extensões/esquemas que só existem no Supabase (pg_net, vault, pg_cron) falham localmente: são as 3 falhas esperadas.
set -uo pipefail
cd "$(dirname "$0")/.."
BANCO="${1:-t_local}"; shift || true
service postgresql start >/dev/null 2>&1 || true
dropdb --if-exists "$BANCO" && createdb "$BANCO" || exit 1
psql -X -q -d "$BANCO" -f tests/stub_supabase.sql >/dev/null 2>&1
com_erro=0
for f in migrations/*.sql; do
  if ! saida=$(psql -X -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$f" 2>&1); then
    com_erro=$((com_erro + 1)); echo "migração com erro: $f -> $(echo "$saida" | head -1)"
  fi
done
echo "migrações com erro: $com_erro (esperado: 3, só pg_net/vault/cron)"
falhas=0
for t in "$@"; do
  echo "== $t"
  if psql -X -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$t" 2>&1 | grep -E "^psql:|ERROR|FALHOU|ok:" ; then :; fi
  psql -X -q -v ON_ERROR_STOP=1 -d "$BANCO" -f "$t" >/dev/null 2>&1 || { echo "TESTE FALHOU: $t"; falhas=$((falhas + 1)); }
done
exit "$falhas"
