-- Limpeza de private.limite_chamadas (contador do limitador, migração 20261018000002), que só recebia linhas.
-- A maior janela em uso é 1 h; linha com mais de 2 h nunca mais é lida. NÃO altera public.limite_chamada() nem dados de negócio.
-- Pré-requisito de implantação do limite dos endpoints públicos (PR #112). Aplicar só com autorização.
-- Reversão: ver bloco ROLLBACK no fim.
begin;

-- Apagar por data não usa a chave primária (chave, janela).
create index if not exists limite_chamadas_janela_idx on private.limite_chamadas (janela);

-- Apaga em lotes (padrão 10.000) para não segurar bloqueio; devolve quantas linhas apagou. Repetir até devolver 0 esvazia o atraso.
create or replace function private.limite_chamadas_limpar(p_lote int default 10000) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with velhas as (
    select ctid from private.limite_chamadas
    where janela < now() - interval '2 hours'
    order by janela limit greatest(1, least(p_lote, 100000)) for update skip locked
  ), apagadas as (
    delete from private.limite_chamadas l using velhas v where l.ctid = v.ctid returning 1
  ) select count(*) into n from apagadas;
  return n;
end $$;
-- Só o dono do banco (que roda o pg_cron) executa; nada é exposto por RPC nem ao service_role.
revoke all on function private.limite_chamadas_limpar(int) from public, anon, authenticated, service_role;

-- Rotina estritamente local ao banco; nenhuma URL, JWT ou segredo no cron. Sem pg_cron, só cria a função.
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then
  perform cron.schedule('limite-limpeza', '7 * * * *', 'select private.limite_chamadas_limpar();');
end if; end $$;
commit;

-- ROLLBACK (só remove a rotina; as linhas já apagadas eram vencidas):
-- select cron.unschedule('limite-limpeza');  -- se pg_cron existir
-- drop function private.limite_chamadas_limpar(int);
-- drop index private.limite_chamadas_janela_idx;
