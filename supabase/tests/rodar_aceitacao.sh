#!/usr/bin/env bash
# Testes de aceitação do Conector IA: sobe o Postgres local com todas as migrações e roda o TypeScript de produção contra ele.
# Uso: supabase/tests/rodar_aceitacao.sh [banco]
set -uo pipefail
cd "$(dirname "$0")/.."
BANCO="${1:-t_aceitacao}"
tests/rodar_local.sh "$BANCO" >/dev/null 2>&1
CONECTOR_TEST_DB="$BANCO" node --experimental-strip-types --test functions/_shared/conector/*.test.ts
