#!/usr/bin/env bash
# Duas conexões reais, exclusivamente banco descartável do CI.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${PGDATABASE:-}" == conecta_teste && "${PGHOST:-}" == localhost && "${PGPORT:-}" == 5432 ]] || { echo "somente CI descartável"; exit 1; }
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGCONNECT_TIMEOUT=5
L=ed000000-0000-0000-0000-000000000001
P=ed100000-0000-0000-0000-000000000001
A=ee200000-0000-0000-0000-000000000001
B=ee200000-0000-0000-0000-000000000002
D=$(mktemp -d)
ps(){ psql -XqAt -h 127.0.0.1 -p 5432 -U postgres -d conecta_teste -v ON_ERROR_STOP=1 "$@"; }
# A fila Nano não pode ser apagada nem por cascata. Fixture permanece somente no banco descartável do runner.
cleanup(){ rm -rf "$D"; }
trap cleanup EXIT
# Reutiliza a fixture real de captura até a evidência confirmada, sem despacho.
awk '/^select pg_temp.afirma\(public.nano_lifecycle_encaminhar/{exit} {print}' docs/conector-ia/nano-lifecycle-despacho-TESTE.sql > "$D/fixture.sql"
cat >> "$D/fixture.sql" <<SQL
reset role;
update public.nano_lifecycle_checkpoint set despacho_habilitado=true,consumo_habilitado=true where loja_id='$L';
update public.produto_automacao set pausado=false where produto_id='$P';
insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('$L',date_trunc('month',now())::date,1);
commit;
SQL
ps -f "$D/fixture.sql" >/dev/null
K=$(ps -c "select eventos->0->>'idempotency_key' from public.nano_lifecycle_capturas where loja_id='$L' and revisao='sync_0002'")
[[ "$K" =~ ^nano-lifecycle:[0-9a-f]{64}$ ]]
ps -c "set role service_role" -c "select public.nano_lifecycle_encaminhar('$L','sync_0002','$K')->>'estado'" > "$D/a" & pa=$!
ps -c "set role service_role" -c "select public.nano_lifecycle_encaminhar('$L','sync_0002','$K')->>'estado'" > "$D/b" & pb=$!
wait "$pa"; wait "$pb"
[[ $(grep -hx encaminhado "$D/a" "$D/b" | wc -l) == 1 ]]
[[ $(grep -hx ja_encaminhado "$D/a" "$D/b" | wc -l) == 1 ]]
I=$(ps -c "select id from public.pipeline_itens where loja_id='$L' and idempotency_key='$K'")
[[ "$I" =~ ^[0-9a-f-]{36}$ ]]
[[ $(ps -c "select count(*) from public.pipeline_itens where loja_id='$L'") == 1 ]]
echo "ok: disputa de despacho cria uma única tarefa"
ps -c "set role service_role" -c "select public.nano_lifecycle_reivindicar('$L','$I','$A')->>'estado'" > "$D/a" & pa=$!
ps -c "set role service_role" -c "select public.nano_lifecycle_reivindicar('$L','$I','$B')->>'estado'" > "$D/b" & pb=$!
wait "$pa"; wait "$pb"
[[ $(grep -hx reservado "$D/a" "$D/b" | wc -l) == 1 ]]
[[ $(grep -hx ocupado "$D/a" "$D/b" | wc -l) == 1 ]]
[[ $(ps -c "select count(*) from public.pipeline_itens where loja_id='$L' and nano_geracao=1 and reservado_ate>clock_timestamp()") == 1 ]]
echo "ok: disputa de consumidor gera uma única reserva"
