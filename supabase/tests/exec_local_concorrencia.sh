#!/usr/bin/env bash
# Concorrência REAL (várias conexões ao mesmo tempo) da fila do executor local. Exige um Postgres 16 descartável:
#   PGHOST=/tmp PGPORT=5544 PGUSER=postgres supabase/tests/exec_local_concorrencia.sh
# SEM_LOCK=1 remove o lock por dispositivo da função (prova que a corrida EXISTE sem ele; o teste deve FALHAR nesse modo).
set -uo pipefail
cd "$(dirname "$0")/.."
DB=conecta_conc_exec; N=${N:-40}
IGNORAR='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron'
psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
export PGDATABASE=$DB
psql -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null 2>&1
for f in migrations/*.sql; do [[ "$f" =~ $IGNORAR ]] && continue; psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "falha na migração $f"; exit 1; }; done
if [ "${SEM_LOCK:-0}" = 1 ]; then   # recria a função sem a linha do advisory lock
  awk '/^create function public.exec_local_enfileirar/{d=1} d{print} d&&/^end \$\$;/{exit}' migrations/20261029000001_exec_local_fila.sql | sed '/pg_advisory_xact_lock/d; s/^create function/create or replace function/' | psql -q -v ON_ERROR_STOP=1 >/dev/null
  echo "(modo SEM_LOCK: lock removido de propósito)"
fi
A=aaaaaaaa-0000-0000-0000-000000000001; U=11111111-1111-1111-1111-111111111111; D=d0000000-0000-0000-0000-00000000000a
psql -qAt -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into public.lojas (id,nome,slug) values ('$A','Loja A','loja-a');
insert into public.usuarios_loja (loja_id,user_id,papel) values ('$A','$U','lojista');
insert into public.pair_dispositivos (id,loja_id,usuario_id,nome,tipo,capacidades) values ('$D','$A','$U','PC A','agente_desktop','{windows.sistema.inventario}');
SQL
CMD='Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture,TotalVisibleMemorySize | ConvertTo-Json -Compress'
FALHAS=0
afirma() { if [ "$2" = "$3" ]; then echo "ok: $1"; else echo "FALHOU: $1 (esperado '$3', veio '$2')"; FALHAS=$((FALHAS+1)); fi; }
# dispara N conexões que esperam numa barreira (advisory lock compartilhado) e saem JUNTAS quando o pai solta o lock
rajada() { local n=$1 modelo=$2 d; d=$(mktemp -d)
  ( psql -qAt -c "select pg_advisory_lock(7777)" -c "select pg_sleep(2.5)" >/dev/null 2>&1 ) & sleep 0.4
  for i in $(seq 1 "$n"); do
    ( psql -qAt -c "select pg_advisory_lock_shared(7777)" -c "set role service_role" -c "${modelo//@I@/$i}" > "$d/$i" 2>&1 ) &
  done; wait; cat "$d"/*; rm -rf "$d"; }
SEL="select public.exec_local_enfileirar('$A','$D','windows.sistema.inventario',array['powershell.exe','-NoProfile','-NonInteractive','-NoLogo','-Command','$CMD'],5000,%s)"

# 1) N enfileiramentos simultâneos de chaves diferentes: o limite de 20 por dispositivo vale mesmo sob corrida
R=$(rajada "$N" "$(printf "$SEL" "'k-@I@-aaaaaaaa'")")
afirma "limite 20 sob concorrência: exatamente 20 linhas na fila" "$(psql -qAt -c "select count(*) from public.exec_local_tarefas where dispositivo_id='$D' and estado='NA_FILA'")" "20"
afirma "limite 20 sob concorrência: os demais recebem 'fila do dispositivo cheia'" "$(echo "$R" | grep -c 'fila do dispositivo cheia')" "$((N-20))"
psql -qAt -c "delete from public.exec_local_tarefas" >/dev/null

# 2) a MESMA idempotency_key em paralelo: 1 linha só, e ninguém recebe erro de índice único
R=$(rajada 12 "$(printf "$SEL" "'mesma-chave-idem'")")
afirma "idempotência sob concorrência: 1 linha" "$(psql -qAt -c "select count(*) from public.exec_local_tarefas where idempotency_key='mesma-chave-idem'")" "1"
afirma "idempotência sob concorrência: nenhum erro de índice único" "$(echo "$R" | grep -c 'duplicate key')" "0"
afirma "idempotência sob concorrência: todos recebem o mesmo id" "$(echo "$R" | grep -E '^[0-9a-f]{8}-' | sort -u | wc -l | tr -d ' ')" "1"
psql -qAt -c "delete from public.exec_local_tarefas" >/dev/null

# 3) dois agentes puxam ao mesmo tempo uma única tarefa: só um a recebe
H() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
psql -qAt >/dev/null <<SQL
insert into public.pair_sessoes (loja_id,usuario_id,dispositivo_id,token_hash,sal_hash,escopos,expira_em,limite_ate)
values ('$A','$U','$D','$(H tA)','$(H sA)','{produtos:ler}',now()+interval '1 hour',now()+interval '1 day');
SQL
psql -qAt -c "set role service_role" -c "$(printf "$SEL" "null")" >/dev/null
R=$(rajada 10 "select public.exec_local_puxar('$(H tA)','$(H sA)')")
afirma "puxada concorrente: exatamente 1 agente recebe a tarefa" "$(echo "$R" | grep -c 'job_id')" "1"
if [ "$FALHAS" -ne 0 ]; then echo "$FALHAS verificação(ões) falharam"; exit 1; fi
echo "concorrência da fila: tudo ok"
