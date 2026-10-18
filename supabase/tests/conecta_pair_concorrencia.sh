#!/usr/bin/env bash
# Concorrência REAL (várias conexões simultâneas) do Conecta Pair. Exige um Postgres 16 descartável:
#   PGHOST=/tmp PGPORT=5544 PGUSER=postgres supabase/tests/conecta_pair_concorrencia.sh
# Cria o banco "conecta_conc", aplica stub e migrações (ignorando as de infra do Supabase) e dispara N conexões ao mesmo tempo.
set -uo pipefail
cd "$(dirname "$0")/.."
DB=conecta_conc; N=${N:-8}
IGNORAR='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron'
psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
export PGDATABASE=$DB
psql -q -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null 2>&1
for f in migrations/*.sql; do [[ "$f" =~ $IGNORAR ]] && continue; psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "falha na migração $f"; exit 1; }; done

A=aaaaaaaa-0000-0000-0000-000000000001; U1=11111111-1111-1111-1111-111111111111; U4=44444444-4444-4444-4444-444444444444
h() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
sql() { psql -qAt -c "$1"; }
sql "insert into public.lojas (id,nome,slug) values ('$A','Loja A','loja-a')" >/dev/null
sql "insert into public.usuarios_loja (loja_id,user_id,papel) values ('$A','$U1','lojista'),('$A','$U4','lojista')" >/dev/null
FALHAS=0
afirma() { if [ "$2" = "$3" ]; then echo "ok: $1"; else echo "FALHOU: $1 (esperado '$3', veio '$2')"; FALHAS=$((FALHAS+1)); fi; }
# executa um comando como usuário autenticado (JWT simulado) numa conexão nova
como() { local uid=$1; shift; psql -qAt -c "set role authenticated" -c "select set_config('request.jwt.claims', '{\"sub\":\"$uid\",\"amr\":[{\"method\":\"password\",\"timestamp\":'||extract(epoch from now())::bigint||'}]}', false)" -c "$*" | tail -1; }
servidor() { psql -qAt -c "set role service_role" -c "$*" | tail -1; }
paralelo() { local n=$1; shift; local d; d=$(mktemp -d); for i in $(seq 1 "$n"); do ( "$@" "$i" > "$d/$i" 2>&1 ) & done; wait; cat "$d"/* ; rm -rf "$d"; }

# 1) Dois aparelhos aprovam o MESMO QR ao mesmo tempo: só um vence
sql "select public.pair_iniciar('$(h C1)','$(h SEG-C1)','$(h VER-C1)','$(h TOK-C1)','Notebook','navegador',array['produtos:ler'],'{}',60,120)" >/dev/null
aprovar() { como "$([ $(( $1 % 2 )) = 0 ] && echo $U1 || echo $U4)" "select public.pair_aprovar('C1','$A','VER-C1',array['produtos:ler'],30)"; }
export -f aprovar como; export A U1 U4 PGHOST PGPORT PGUSER PGDATABASE
R=$(paralelo "$N" bash -c 'aprovar $0' )
afirma "aprovação concorrente: exatamente 1 vencedor" "$(echo "$R" | grep -c '"ok": true')" "1"
afirma "aprovação concorrente: os demais recebem desafio_ja_usado" "$(echo "$R" | grep -c 'desafio_ja_usado')" "$((N-1))"

# 2) O solicitante consulta/resgata em paralelo (abas duplicadas, retentativas): 1 dispositivo, 1 sessão
resgatar() { servidor "select public.pair_consultar('$(h C1)','$(h SEG-C1)')"; }
export -f resgatar servidor h
R=$(paralelo "$N" bash -c 'resgatar $0')
afirma "resgate concorrente: nenhuma resposta de erro" "$(echo "$R" | grep -c '"estado": "resgatado"')" "$N"
afirma "resgate concorrente: 1 dispositivo" "$(sql 'select count(*) from public.pair_dispositivos')" "1"
afirma "resgate concorrente: 1 sessão" "$(sql 'select count(*) from public.pair_sessoes')" "1"
afirma "resgate concorrente: mesmo dispositivo para todos" "$(echo "$R" | grep -o '"dispositivo_id": "[^"]*"' | sort -u | wc -l | tr -d ' ')" "1"

# 3) Proposta duplicada em paralelo (mesma chave): 1 linha
propor() { servidor "select public.aprovacao_propor('$A','banner_publicacao','conecta.propose_banner','Agente',null,null,null,'[{\"tabela\":\"banners\"}]',null,'{\"t\":1}','{}','MEDIUM','chave-dup-001',60)"; }
export -f propor
R=$(paralelo "$N" bash -c 'propor $0')
afirma "pedido duplicado concorrente: 1 aprovação" "$(sql "select count(*) from public.aprovacoes where idempotency_key='chave-dup-001'")" "1"
afirma "pedido duplicado concorrente: todos recebem o mesmo id" "$(echo "$R" | grep -o '"id": "[^"]*"' | sort -u | wc -l | tr -d ' ')" "1"
afirma "pedido duplicado concorrente: 1 notificação" "$(sql "select count(*) from public.notificacoes where tipo='aprovacao'")" "1"
ID=$(sql "select id from public.aprovacoes where idempotency_key='chave-dup-001'"); HASH=$(sql "select hash_proposta from public.aprovacoes where id='$ID'")

# 4) Decisões contraditórias ao mesmo tempo (aprovar × recusar): só uma vale
decidir() { como "$([ $(( $1 % 2 )) = 0 ] && echo $U1 || echo $U4)" "select public.aprovacao_decidir('$ID','$HASH','$([ $(( $1 % 2 )) = 0 ] && echo aprovar || echo recusar)')"; }
export -f decidir; export ID HASH
R=$(paralelo "$N" bash -c 'decidir $0')
afirma "decisões concorrentes: exatamente 1 decisão registrada" "$(echo "$R" | grep -c '"ok": true')" "1"
EST=$(sql "select estado from public.aprovacoes where id='$ID'")
afirma "decisões concorrentes: estado final é decisão única ($EST)" "$([ "$EST" = aprovada ] || [ "$EST" = recusada ] && echo sim)" "sim"

# 5) Executores concorrentes sobre uma aprovação aprovada: só um executa
if [ "$EST" != aprovada ]; then
  ID=$(servidor "select (public.aprovacao_propor('$A','pagina_alteracao','conecta.edit_page','Ag',null,null,null,'[{\"tabela\":\"paginas\"}]',null,'{\"p\":2}','{}','MEDIUM','chave-exec-02',60)) ->> 'id'")
  HASH=$(sql "select hash_proposta from public.aprovacoes where id='$ID'")
  como $U1 "select public.aprovacao_decidir('$ID','$HASH','aprovar')" >/dev/null
fi
consumir() { servidor "select public.aprovacao_consumir('$ID','$HASH')"; }
export -f consumir; export ID HASH
R=$(paralelo "$N" bash -c 'consumir $0')
afirma "execução concorrente: exatamente 1 executor reivindica" "$(echo "$R" | grep -c '"ok": true')" "1"
afirma "execução concorrente: os demais veem estado_executando" "$(echo "$R" | grep -c 'estado_executando')" "$((N-1))"

# 6) Várias versões da MESMA proposta ao mesmo tempo: números distintos, só a última fica viva
GRUPO=$(sql "select grupo_id from public.aprovacoes where id='$ID'")
versao() { servidor "select public.aprovacao_propor('$A','pagina_alteracao','conecta.edit_page','Ag',null,null,null,'[{\"tabela\":\"paginas\"}]',null,('{\"p\":'||$1||'}')::jsonb,'{}','MEDIUM','chave-ver-0'||$1,60,'$GRUPO')"; }
export -f versao; export GRUPO
R=$(paralelo 6 bash -c 'versao $0')
afirma "versões concorrentes: nenhum erro" "$(echo "$R" | grep -c 'ERROR')" "0"
afirma "versões concorrentes: números distintos" "$(sql "select count(distinct versao)=count(*) from public.aprovacoes where grupo_id='$GRUPO'")" "t"
afirma "versões concorrentes: só a última segue pendente" "$(sql "select count(*) from public.aprovacoes where grupo_id='$GRUPO' and estado='pendente'")" "1"

[ -n "${MANTER:-}" ] || psql -qAt -d postgres -c "drop database if exists $DB" >/dev/null
[ "$FALHAS" -eq 0 ] && echo "TODOS OS TESTES DE CONCORRÊNCIA PASSARAM" || { echo "$FALHAS falha(s)"; exit 1; }
