#!/usr/bin/env bash
# PostgreSQL descartável do CI. Não aceita outro banco ou host remoto.
set -euo pipefail
[[ "${PGDATABASE:-}" == conecta_teste && "${PGHOST:-}" == localhost ]] || { echo "somente banco conecta_teste em localhost"; exit 1; }
L=e3000000-0000-0000-0000-000000000001
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
psql -Xq -v ON_ERROR_STOP=1 <<SQL
insert into public.lojas(id,nome,slug) values ('$L','Nano concorrência teste','nano-concorrencia-teste');
insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ('$L',true);
select public.nano_lifecycle_registrar('$L','sync_0001',null,'baseline','[]','[]');
SQL
# Duas conexões competem pelo mesmo predecessor. Apenas uma pode gravar.
for rev in sync_0002 sync_0003; do
  psql -XqAt -v ON_ERROR_STOP=1 -c "set role service_role" -c "select public.nano_lifecycle_registrar('$L','$rev','sync_0001','pronto_para_transacao','[]','[]')" > "$D/$rev" &
done
wait
[[ $(grep -hx gravado "$D"/sync_* | wc -l) == 1 ]]
[[ $(grep -hx conflito "$D"/sync_* | wc -l) == 1 ]]
[[ $(psql -XqAt -v ON_ERROR_STOP=1 -c "select count(*) from public.nano_lifecycle_capturas where loja_id='$L'") == 2 ]]
[[ $(psql -XqAt -v ON_ERROR_STOP=1 -c "select count(*) from public.nano_lifecycle_capturas c join public.nano_lifecycle_checkpoint p on p.loja_id=c.loja_id and p.revisao=c.revisao where c.loja_id='$L' and c.predecessor='sync_0001'") == 1 ]]
echo "ok: CAS concorrente preserva um único sucessor e checkpoint consistente"
