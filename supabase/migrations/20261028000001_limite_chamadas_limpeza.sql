-- Limpeza de private.limite_chamadas (contador do limitador, migração 20261018000002), que só recebia linhas.
-- Retenção por tipo de chave: as de janela de 60 s (pub:<endpoint>:ip:rajada, :semip, :loja; ver _shared/limite/publico.ts, testado em chaves.test.ts)
-- saem após 10 min; as demais (sustentado de 1 h, pair, chat…) após 2 h. NÃO altera public.limite_chamada() nem dados de negócio.
-- Pré-requisito de implantação do limite dos endpoints públicos (PR #112). Emenda aprovada pelo dono em 2026-10-28. Aplicar só com autorização.
-- Reversão: ver bloco ROLLBACK no fim.
begin;

-- Apagar por data não usa a chave primária (chave, janela).
create index if not exists limite_chamadas_janela_idx on private.limite_chamadas (janela);

-- Apaga em lotes de p_lote (padrão 10.000) e REPETE até acabar o vencido ou chegar a 20 lotes por execução; devolve o total apagado.
-- O que sobrar do teto de 20 lotes sai na execução seguinte (o job roda a cada 10 min).
create or replace function private.limite_chamadas_limpar(p_lote int default 10000) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; total int := 0; i int := 0; lote int := greatest(1, least(p_lote, 100000));
begin
  loop
    with velhas as (
      select ctid from private.limite_chamadas
      where janela < now() - interval '2 hours'
         or (janela < now() - interval '10 minutes' and chave ~ '^pub:[a-z-]+:(ip:rajada:|semip:|loja:)')
      order by janela limit lote for update skip locked
    ), apagadas as (
      delete from private.limite_chamadas l using velhas v where l.ctid = v.ctid returning 1
    ) select count(*) into n from apagadas;
    total := total + n; i := i + 1;
    exit when n < lote or i >= 20;
  end loop;
  return total;
end $$;
-- Só o dono do banco (que roda o pg_cron) executa; nada é exposto por RPC nem ao service_role.
revoke all on function private.limite_chamadas_limpar(int) from public, anon, authenticated, service_role;

-- Rotina estritamente local ao banco; nenhuma URL, JWT ou segredo no cron. Sem pg_cron, só cria a função.
do $$ begin if exists (select 1 from pg_extension where extname = 'pg_cron') then
  perform cron.schedule('limite-limpeza', '*/10 * * * *', 'select private.limite_chamadas_limpar();');
end if; end $$;
commit;

-- ROLLBACK (só remove a rotina; as linhas já apagadas eram vencidas):
-- select cron.unschedule('limite-limpeza');  -- se pg_cron existir
-- drop function private.limite_chamadas_limpar(int);
-- drop index private.limite_chamadas_janela_idx;
