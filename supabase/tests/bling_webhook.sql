-- Webhook do Bling: fila idempotente, reserva sem corrida, retentativa, erro definitivo, vínculo da conta sem sequestro, só service_role.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.bling_conexoes (loja_id) values ('aaaaaaaa-0000-0000-0000-00000000000a'), ('bbbbbbbb-0000-0000-0000-00000000000b');
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set B '\'bbbbbbbb-0000-0000-0000-00000000000b\''

select public.afirma(not has_function_privilege('anon', 'public.bling_evento_enfileirar(uuid,text,text,timestamptz,text,jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.bling_eventos_reservar(int)', 'execute') and not has_function_privilege('authenticated', 'public.bling_registrar_company(uuid,text)', 'execute'), 'anon e authenticated não executam');
select public.afirma(has_function_privilege('service_role', 'public.bling_evento_concluir(uuid,text,text,timestamptz)', 'execute'), 'service_role executa');

-- vínculo da conta
select public.afirma(public.bling_registrar_company(:A, 'd4475854366a36c86a37e792f9634a51'), 'registra a conta na loja A');
select public.afirma(public.bling_registrar_company(:A, 'd4475854366a36c86a37e792f9634a51'), 'repetir o mesmo vínculo é ok');
select public.afirma(not public.bling_registrar_company(:A, 'ffffffffffffffffffffffffffffffff'), 'não troca o vínculo existente por outro');
select public.afirma(not public.bling_registrar_company(:B, 'd4475854366a36c86a37e792f9634a51'), 'a conta de A não pode ser tomada pela loja B');
select public.afirma(not public.bling_registrar_company(:B, 'x'), 'companyId inválido recusado');
select public.afirma(public.loja_por_bling_company('d4475854366a36c86a37e792f9634a51') = 'aaaaaaaa-0000-0000-0000-00000000000a', 'companyId resolve a loja certa');

-- fila idempotente
select public.afirma(public.bling_evento_enfileirar(:A, 'produto', '123', now(), '01945027-150e-72b4-e7cf', '{"evento":"product.updated"}'), 'enfileira o evento');
select public.afirma(not public.bling_evento_enfileirar(:A, 'produto', '123', now(), '01945027-150e-72b4-e7cf', '{}'), 'duplicata (mesmo eventId) é ignorada');
select public.afirma(public.bling_evento_enfileirar(:B, 'produto', '123', now(), '01945027-150e-72b4-e7cf', '{}'), 'o mesmo eventId em OUTRA loja é outro evento');
select public.afirma(not public.bling_evento_enfileirar(:A, 'pedido', '1', now(), '01945027-aaaa-bbbb', '{}'), 'tipo desconhecido recusado');
select public.afirma(not public.bling_evento_enfileirar(:A, 'produto', 'abc', now(), '01945027-aaaa-bbbb', '{}'), 'bling_id não numérico recusado');
select public.afirma((select count(*) from public.sync_eventos where loja_id = :A) = 1, 'uma linha na loja A');

-- reservar
select public.afirma((select count(*) from public.bling_eventos_reservar(10)) = 2, 'reserva os 2 pendentes (uma por loja)');
select public.afirma((select count(*) from public.bling_eventos_reservar(10)) = 0, 'segunda reserva não pega os já reservados');
select public.afirma((select count(*) from public.sync_eventos where status = 'processando') = 2, 'ficaram processando');

-- retentativa e erro definitivo
select public.bling_evento_concluir((select id from public.sync_eventos where loja_id = :A), 'erro', 'Bling 429', now() + interval '1 hour');
select public.afirma((select status::text = 'pendente' and tentativas = 1 from public.sync_eventos where loja_id = :A), 'erro com nova tentativa volta a pendente com tentativas+1');
select public.afirma((select count(*) from public.bling_eventos_reservar(10)) = 0, 'não é reservado antes da hora da nova tentativa');
update public.sync_eventos set proxima_tentativa_em = now() - interval '1 second' where loja_id = :A;
select public.afirma((select count(*) from public.bling_eventos_reservar(10)) = 1, 'depois da hora, é reservado de novo');
select public.bling_evento_concluir((select id from public.sync_eventos where loja_id = :A), 'erro', 'esgotou as tentativas', null);
select public.afirma((select status::text = 'erro' and processado_em is not null from public.sync_eventos where loja_id = :A), 'erro definitivo fecha o evento');
select public.afirma((select count(*) from public.sync_erros where loja_id = :A and evento_id is not null) = 1, 'erro definitivo registrado em sync_erros, só na loja A');
select public.afirma((select count(*) from public.sync_erros where loja_id = :B) = 0, 'nada em sync_erros da loja B');

-- aplicado e processando travado
select public.bling_evento_concluir((select id from public.sync_eventos where loja_id = :B), 'aplicado');
select public.afirma((select status::text = 'aplicado' and processado_em is not null from public.sync_eventos where loja_id = :B), 'aplicado fecha o evento');
insert into public.sync_eventos (loja_id, origem, tipo, bling_id, chave_idempotencia, status, proxima_tentativa_em) values (:A, 'webhook', 'estoque', '9', 'travado-0001', 'processando', now() - interval '10 minutes');
select public.afirma((select count(*) from public.bling_eventos_reservar(10)) = 1, 'evento travado em processando há 10 min volta à fila');
select public.afirma((select count(*) from public.sync_eventos where origem = 'webhook' and status = 'pendente') = 0, 'nada fica pendente sem dono');
do $$ declare v_ok boolean := false; begin
  begin perform public.bling_evento_concluir(gen_random_uuid(), 'xx'); exception when others then v_ok := true; end;
  perform public.afirma(v_ok, 'status inválido é recusado');
end $$;
rollback;
