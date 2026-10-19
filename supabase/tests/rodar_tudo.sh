#!/usr/bin/env bash
# Roda TODOS os testes do Conector IA: SQL (Postgres local), TypeScript (node:test, contra o Postgres local), tipos estritos e empacotamento.
# Local: supabase/tests/rodar_tudo.sh   |   CI: defina PGHOST/PGUSER/PGPASSWORD (veja .github/workflows/conector-testes.yml).
# Os 4 testes SQL abaixo JÁ falhavam na main antes do Conector IA (o stub local concede privilégios padrão a anon e eles esperam
# "insufficient_privilege"); ficam fora desta barra até serem revisados, e isso está registrado em docs/conector-ia/testes.md.
set -uo pipefail
cd "$(dirname "$0")/../.."
BASE_CONHECIDAS="fiscal loja_politicas revisoes_bula_contador taxonomia_codigos bling_renovacao"
sqls=()
for t in supabase/tests/*.sql; do
  n=$(basename "$t" .sql); [ "$n" = "stub_supabase" ] && continue
  case " $BASE_CONHECIDAS " in *" $n "*) continue;; esac
  sqls+=("${t#supabase/}")
done
BANCO="${1:-t_tudo}"
status=0
echo "== SQL (${#sqls[@]} arquivos)"
(cd supabase && DB="$BANCO" tests/rodar_local.sh "${sqls[@]}") || status=1
echo "== TypeScript contra Postgres local"
saida_ts=$(CONECTOR_TEST_DB="$BANCO" node --experimental-strip-types --test --test-concurrency=1 $(find supabase/functions -name '*.test.ts' | sort) 2>&1); st_ts=$?
echo "$saida_ts" | grep -E "^# (tests|pass|fail|skipped)|^not ok"
[ $st_ts -eq 0 ] || status=1
echo "== Tipos estritos (shim do Deno)"
(cd supabase/functions && ../../painel/node_modules/.bin/tsc -p tsconfig.check.json) || status=1
echo "== Empacotamento das funções (sem imports relativos)"
for f in conector-chat conector-conversas conector-aprovacoes conector-chaves conector-mcp loja-seo; do node scripts/empacotar-funcao.mjs "$f" "/tmp/bundles/$f/index.ts" >/dev/null || { echo "FALHOU: $f"; status=1; }; done
echo "== Painel"
(cd painel && npm test --silent 2>&1 | grep -E "^# (tests|pass|fail)" ; npm run build --silent >/dev/null 2>&1) || status=1
[ $status -eq 0 ] && echo "TUDO OK" || echo "HÁ FALHAS"
exit $status
