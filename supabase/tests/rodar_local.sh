#!/usr/bin/env bash
# Roda os testes SQL localmente num Postgres 16 DESCARTÁVEL (nunca no Supabase). Uso:
#   PGHOST=/tmp PGPORT=5544 PGUSER=postgres supabase/tests/rodar_local.sh [arquivo_de_teste.sql ...]
# Cria o banco "conecta_teste", aplica o stub do Supabase e as migrações e roda os testes
# (padrão: TODAS as suítes de tests/*.sql, menos as que dependem de infraestrutura que só existe no Supabase).
# Sai com código 1 se qualquer migração ou teste falhar (o CI depende disso).
set -uo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-conecta_teste}
# migrações e suítes que dependem de pg_net, vault e pg_cron (inexistentes fora do Supabase)
IGNORAR_MIGRACOES='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron'
IGNORAR_TESTES='stub_supabase|bling_renovacao'

psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || { echo "não consegui criar o banco de teste"; exit 1; }
export PGDATABASE=$DB
psql -q -X -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null 2>&1 || { echo "falha ao aplicar o stub do Supabase"; exit 1; }
for f in migrations/*.sql; do
  if [[ "$f" =~ $IGNORAR_MIGRACOES ]]; then echo "ignorada (infra Supabase): $f"; continue; fi
  psql -q -X -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>/tmp/rodar_local.erro || { echo "FALHOU a migração $f"; head -3 /tmp/rodar_local.erro; exit 1; }
done

TESTES=("$@")
if [ ${#TESTES[@]} -eq 0 ]; then
  for t in tests/*.sql; do [[ "$t" =~ $IGNORAR_TESTES ]] || TESTES+=("$t"); done
fi
FALHAS=0
for t in "${TESTES[@]}"; do
  saida=$(psql -q -X -v ON_ERROR_STOP=1 -f "$t" 2>&1); status=$?
  n=$(grep -c 'NOTICE:  ok' <<<"$saida")
  if [ "$status" -ne 0 ] || grep -qE 'ERROR:|FALHOU' <<<"$saida"; then
    echo "FALHOU  $t ($n verificações ok antes da falha)"; grep -E 'ERROR:|FALHOU' <<<"$saida" | head -3
    FALHAS=$((FALHAS + 1))
  else
    echo "ok      $t ($n verificações)"
  fi
done
if [ "$FALHAS" -ne 0 ]; then echo "$FALHAS suíte(s) falharam"; exit 1; fi
echo "todas as ${#TESTES[@]} suítes passaram"
