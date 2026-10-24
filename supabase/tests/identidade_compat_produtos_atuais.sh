#!/usr/bin/env bash
# Compatibilidade da migração 20261024000001 (identidade do produto) com o espelho ATUAL de produção: 7 produtos (lidos só com SELECT em 2026-10-24),
# todos ativos e despublicados; um deles sem SKU. Roda em Postgres DESCARTÁVEL (nunca no Supabase): aplica tudo menos a nova migração, grava as 7 linhas
# e aplica a nova por cima, em transação única (como o apply_migration).
set -uo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-conecta_compat}
IGNORAR='bling_renovacao_automatica|plataforma_segredos_vault|bling_sync_cron|20261024000001_identidade_produto_sku'
psql -qAt -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
export PGDATABASE=$DB
psql -q -X -v ON_ERROR_STOP=1 -f tests/stub_supabase.sql >/dev/null 2>&1 || { echo "stub falhou"; exit 1; }
for f in migrations/*.sql; do [[ "$f" =~ $IGNORAR ]] && continue; psql -q -X -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>/tmp/compat.erro || { echo "FALHOU $f"; head -3 /tmp/compat.erro; exit 1; }; done
L=aaaaaaaa-0000-0000-0000-00000000000a
psql -q -X -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into public.lojas (id, nome, slug) values ('$L','Loja piloto','loja-piloto');
insert into public.produtos (loja_id, bling_id, sku, nome, situacao, publicado) values
  ('$L','16719464748','80692','p1','A',false), ('$L','16719530075','CI003696','p2','A',false), ('$L','16719530080','CI001086','p3','A',false),
  ('$L','16719530082',null,'p4','A',false), ('$L','16721657850','CI000282','p5','A',false), ('$L','16721657873','CI000054','p6','A',false), ('$L','16721657903','CI000211','p7','A',false);
SQL
psql -q -X -1 -v ON_ERROR_STOP=1 -f migrations/20261024000001_identidade_produto_sku.sql >/dev/null 2>/tmp/compat.erro || { echo "FALHOU a migração nova sobre os 7 produtos"; head -3 /tmp/compat.erro; exit 1; }
falhas=0
chk() { if [ "$2" = "$3" ]; then echo "ok      $1"; else echo "FALHOU  $1 (esperado $3, veio $2)"; falhas=$((falhas+1)); fi; }
chk "7 produtos preservados após a migração" "$(psql -qAt -c "select count(*) from public.produtos")" 7
chk "reconciliação roda sem erro" "$(psql -qAt -c "select (public.produtos_reconciliar_identidade('$L')->>'abertos')")" 1
chk "único conflito é o produto sem SKU" "$(psql -qAt -c "select bling_id||':'||motivo from public.produto_conflitos where estado='aberto'")" "16719530082:sku_vazio"
chk "nenhum SKU repetido entre os 7" "$(psql -qAt -c "select count(*) from public.produto_conflitos where motivo='sku_duplicado'")" 0
chk "nenhum produto estava publicado e nenhum passou a estar" "$(psql -qAt -c "select count(*) from public.produtos where publicado")" 0
chk "reprocessar é idempotente" "$(psql -qAt -c "select (public.produtos_reconciliar_identidade('$L')->>'abertos')")" 1
psql -qAt -d postgres -c "drop database if exists $DB" >/dev/null
[ "$falhas" -eq 0 ] && echo "todas as verificações passaram" || { echo "$falhas falha(s)"; exit 1; }
