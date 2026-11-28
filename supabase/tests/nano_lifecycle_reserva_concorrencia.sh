#!/usr/bin/env bash
# CI descartável. Duas conexões reais disputam a mesma reserva.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${PGDATABASE:-}" == conecta_teste && "${PGHOST:-}" == localhost && "${PGPORT:-}" == 5432 ]] || { echo "somente CI descartável"; exit 1; }
export PGCONNECT_TIMEOUT=5
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
L=e4200000-0000-0000-0000-000000000001
A=e4300000-0000-0000-0000-000000000001
B=e4300000-0000-0000-0000-000000000002
D=$(mktemp -d)
ps(){ psql -XqAt -h 127.0.0.1 -p 5432 -U postgres -d conecta_teste -v ON_ERROR_STOP=1 "$@"; }
cleanup(){ ps -c "delete from public.lojas where id='$L'" >/dev/null; rm -rf "$D"; }
trap cleanup EXIT
ps -c "insert into public.lojas(id,nome,slug) values ('$L','Nano reserva concorrente','nano-reserva-concorrente'); insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('$L',true)"
ps -c "set role service_role" -c "select public.nano_lifecycle_reservar('$L','$A')->>'estado'" > "$D/a" & pa=$!
ps -c "set role service_role" -c "select public.nano_lifecycle_reservar('$L','$B')->>'estado'" > "$D/b" & pb=$!
wait "$pa"; wait "$pb"
[[ $(grep -hx reservado "$D/a" "$D/b" | wc -l) == 1 ]]
[[ $(grep -hx ocupado "$D/a" "$D/b" | wc -l) == 1 ]]
[[ $(ps -c "select count(*) from public.nano_lifecycle_execucoes where loja_id='$L'") == 1 ]]
[[ $(ps -c "select count(*) from public.nano_lifecycle_reserva r join public.nano_lifecycle_execucoes h on h.loja_id=r.loja_id and h.execucao=r.execucao and h.geracao=r.geracao where r.loja_id='$L' and not r.encerrada") == 1 ]]
echo "ok: disputa real de reserva produz somente um titular e uma geração"
