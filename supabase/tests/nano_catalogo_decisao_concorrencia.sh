#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${PGDATABASE:-}" == conecta_teste && "${PGHOST:-}" == localhost && "${PGPORT:-}" == 5432 ]] || { echo "somente CI descartável"; exit 1; }
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGCONNECT_TIMEOUT=5
ps(){ psql -XqAt -h 127.0.0.1 -p 5432 -U postgres -d conecta_teste -v ON_ERROR_STOP=1 "$@"; }
L=e1050000-0000-0000-0000-000000000003
P=e1051000-0000-0000-0000-000000000003
A=e1052000-0000-0000-0000-000000000003
U=e1053000-0000-0000-0000-000000000003
ps -c "insert into public.lojas(id,nome,slug) values ('$L','CI concorrência catálogo','ci-concorrencia-catalogo'); insert into public.produtos(id,loja_id,bling_id,sku,nome) values ('$P','$L','106','CI-105-CONC','Peça teste'); insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,status,fonte,coletado_em,pagina_indexavel,pagina_slug) values ('$A','$L','$P','Modelo teste','aprovado','fixture',now(),true,'ci-catalogo-conc');"
ps -c "set role service_role" -c "select public.aplicacao_decidir('$L','$A','$U','rejeitar')" & pa=$!
ps -c "set role service_role" -c "select public.aplicacao_decidir('$L','$A','$U','aprovar')" & pb=$!
wait "$pa"; wait "$pb"
[[ $(ps -c "select count(*) from public.auditoria where loja_id='$L' and tabela='produto_aplicacoes'") == 2 ]]
[[ $(ps -c "select count(*) from public.auditoria a join public.auditoria b on a.loja_id=b.loja_id where a.loja_id='$L' and a.tabela='produto_aplicacoes' and b.tabela='produto_aplicacoes' and a.id<b.id and a.depois=b.antes and a.quando<=b.quando") == 1 ]]
[[ $(ps -c "select (a.depois=to_jsonb(p.*) and not p.pagina_indexavel)::text from public.auditoria a join public.produto_aplicacoes p on p.loja_id=a.loja_id where p.id='$A' and a.tabela='produto_aplicacoes' order by a.id desc limit 1") == true ]]
echo "ok: CAT-105-05 decisões concorrentes serializadas; histórico íntegro e consulta revogada"
