-- Ponte chat do Nano <-> agente do QR: escopo, isolamento por loja, uma entrega por vez, prazo, uma resposta só.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.conversas (id, loja_id, user_id, titulo) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Conversa A'),
  ('c2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'Conversa B');
insert into public.mensagens (id, loja_id, user_id, conversa_id, papel, conteudo, idempotency_key) values
  ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'usuario', 'CI002916', 'idem-0001'),
  ('e1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'usuario', 'e o CI003000?', 'idem-0002'),
  ('e2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'c2000000-0000-0000-0000-000000000002', 'usuario', 'segredo da loja B', 'idem-0003');
insert into public.pair_dispositivos (id, loja_id, usuario_id, nome, tipo) values
  ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Agente A', 'agente_externo'),
  ('d2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Agente só leitura', 'agente_externo');
insert into public.pair_sessoes (id, loja_id, usuario_id, dispositivo_id, token_hash, sal_hash, escopos, expira_em, limite_ate) values
  ('51000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000001', repeat('a', 64), repeat('b', 64), array['chat:responder'], now() + interval '1 hour', now() + interval '1 hour'),
  ('52000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'd2000000-0000-0000-0000-000000000002', repeat('c', 64), repeat('d', 64), array['produtos:ler'], now() + interval '1 hour', now() + interval '1 hour');

\set S1 '\'51000000-0000-0000-0000-000000000001\''
\set S2 '\'52000000-0000-0000-0000-000000000002\''

select public.afirma('chat:responder' = any(private.pair_escopos_validos()), 'escopo chat:responder existe');
select public.afirma(not has_function_privilege('authenticated', 'public.chat_fila_reivindicar(uuid)', 'execute') and not has_function_privilege('anon', 'public.chat_fila_responder(uuid,uuid,text)', 'execute'), 'navegador não chama as funções da fila');
select public.afirma(has_function_privilege('service_role', 'public.chat_fila_reivindicar(uuid)', 'execute'), 'service_role (gateway) executa');
select public.afirma(has_function_privilege('authenticated', 'public.chat_qr_disponivel(uuid)', 'execute'), 'cliente autenticado pode consultar apenas estado QR');
select public.afirma(not has_table_privilege('authenticated', 'public.pair_sessoes', 'select'), 'cliente nao recebe SELECT nas sessoes Pair');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'disponivel')::boolean, 'dono ve a disponibilidade do QR');
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'online')::boolean = false, 'QR autorizado mas sem consumidor fica OFFLINE');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
do $test_qr$ begin
  perform public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a');
  raise exception 'FALHOU: outra loja consultou o QR';
exception when sqlstate '42501' then raise notice 'ok: QR isolado por loja'; end $test_qr$;
select set_config('request.jwt.claims', '{}', true);
update public.conversas set turno_token = gen_random_uuid(), turno_pergunta = 'e1000000-0000-0000-0000-000000000001', turno_ate = now() + interval '15 minutes' where id = 'c1000000-0000-0000-0000-000000000001';

select public.afirma((public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 90)->>'ok')::boolean, 'enfileira mensagem do lojista');
select public.afirma((select c.turno_ate = f.prazo_em from public.conversas c join public.chat_fila f on c.id = f.conversa_id where f.mensagem_id = 'e1000000-0000-0000-0000-000000000001'), 'fila QR limita o bloqueio aos 90 segundos');
select public.afirma((public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 90)->>'fila_id') = (select id::text from public.chat_fila where mensagem_id = 'e1000000-0000-0000-0000-000000000001'), 'reenfileirar a mesma mensagem não duplica');
select public.afirma(public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000001', 90)->>'motivo' = 'mensagem_invalida', 'mensagem de outra loja não entra na fila da loja A');
select public.afirma(public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000002', 5)->>'motivo' = 'prazo_invalido', 'prazo fora de 30-300 s recusado');
select public.chat_fila_enfileirar('bbbbbbbb-0000-0000-0000-00000000000b', 'e2000000-0000-0000-0000-000000000001', 90);

select public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000002', 90);

-- now() é constante nesta transação; torna a ordem das duas perguntas explícita.
update public.chat_fila set criado_em = now() - interval '1 second' where mensagem_id = 'e1000000-0000-0000-0000-000000000001';

select public.afirma(public.chat_fila_reivindicar(:S2)->>'motivo' = 'sessao_sem_permissao', 'sessão sem chat:responder não lê o chat');
select public.afirma((select chat_escuta_em is null from public.pair_sessoes where id=:S2), 'sessao sem escopo nao registra pulso de escuta');
create temp table r1 as select public.chat_fila_reivindicar(:S1) as j;
select public.afirma((select chat_escuta_em >= now()-interval '5 seconds' from public.pair_sessoes where id=:S1), 'consumidor autenticado registra pulso da fila');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'online')::boolean, 'pulso recente faz QR aparecer ONLINE');
update public.pair_sessoes set chat_escuta_em = now()-interval '90 seconds' where id=:S1;
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'online')::boolean=false,'pulso vencido deixa QR OFFLINE, mesmo com token autorizado');
update public.pair_sessoes set chat_escuta_em = now() where id=:S1;
select set_config('request.jwt.claims', '{}', true);
select public.afirma((select j->>'mensagem' from r1) = 'CI002916', 'agente recebe a mensagem da loja da sessão');
select public.afirma((select j->>'mensagem' from r1) <> 'segredo da loja B', 'nunca a da loja B');
select public.afirma((public.chat_fila_reivindicar(:S1)->>'ocupado')::boolean, 'sessão ocupada não recebe a segunda mensagem pendente');
select public.afirma((select count(*) from public.chat_fila where sessao_id = :S1 and estado = 'entregue') = 1, 'apenas uma entrega ativa por sessão');
select public.afirma((select estado from public.chat_fila where mensagem_id = 'e1000000-0000-0000-0000-000000000002') = 'pendente', 'segunda mensagem preservada na fila');

select public.afirma(public.chat_fila_responder(:S2, (select (j->>'fila_id')::uuid from r1), 'oi')->>'motivo' = 'sessao_sem_permissao', 'outra sessão não responde');
select public.afirma(public.chat_fila_responder(:S1, (select (j->>'fila_id')::uuid from r1), '')->>'motivo' = 'texto_invalido', 'texto vazio recusado');
select public.afirma((public.chat_fila_responder(:S1, (select (j->>'fila_id')::uuid from r1), 'O CI002916 está ativo no Bling.')->>'ok')::boolean, 'agente responde no prazo');
select public.afirma((select metadados->>'origem' from public.mensagens where em_resposta_a = 'e1000000-0000-0000-0000-000000000001') = 'agente_qr', 'resposta marcada como agente_qr');
select public.afirma((select turno_ate is null and turno_pergunta is null from public.conversas where id = 'c1000000-0000-0000-0000-000000000001'), 'resposta QR libera novo turno imediatamente');
select public.afirma(public.chat_fila_responder(:S1, (select (j->>'fila_id')::uuid from r1), 'de novo')->>'motivo' = 'estado_respondida', 'não responde duas vezes');

-- prazo vencido: não entrega e não aceita resposta
select public.chat_fila_enfileirar('aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000002', 30);
create temp table r2 as select public.chat_fila_reivindicar(:S1) as j;
select public.afirma((select j->>'mensagem' from r2) = 'e o CI003000?', 'responder libera a sessão para a próxima mensagem');
update public.chat_fila set prazo_em = now() - interval '1 second', criado_em = now() - interval '1 minute' where id = (select (j->>'fila_id')::uuid from r2);
select public.afirma(public.chat_fila_responder(:S1, (select (j->>'fila_id')::uuid from r2), 'tarde')->>'motivo' = 'prazo_vencido', 'resposta atrasada é recusada (o Nano já assumiu)');
select public.afirma((select estado from public.chat_fila where id = (select (j->>'fila_id')::uuid from r2)) = 'expirada', 'fila marcada como expirada');

-- Um token vencido nao pode aparecer como QR conectado, mesmo com janela autorizada.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
update public.pair_sessoes set expira_em = now() - interval '1 second' where id = :S1;
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'disponivel')::boolean = false, 'QR nao anuncia token vencido como ativo');
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'janela_ate') is not null, 'lojista ve prazo da janela sem acessar hashes');
update public.pair_sessoes set expira_em = now() + interval '1 hour' where id = :S1;
select public.afirma((public.chat_qr_disponivel('aaaaaaaa-0000-0000-0000-00000000000a')->>'disponivel')::boolean, 'token renovado volta a aparecer como ativo');
select set_config('request.jwt.claims', '{}', true);

-- sessão revogada perde o acesso na hora
update public.pair_sessoes set revogado_em = now() where id = :S1;
select public.afirma(public.chat_fila_reivindicar(:S1)->>'motivo' = 'sessao_sem_permissao', 'sessão revogada não lê mais');
rollback;
