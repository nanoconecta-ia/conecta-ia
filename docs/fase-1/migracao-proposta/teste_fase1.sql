-- Teste da migração proposta v2 da Fase 1. Roda numa transação e desfaz tudo.
-- Uso local: stub_supabase.sql + supabase/migrations/*.sql + 20261020000001_fase1_conversas.sql + este arquivo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.espera_erro(cmd text, codigo text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; exception when others then
    if sqlstate = codigo then raise notice 'ok: %', msg; return; end if;
    raise exception 'FALHOU: % (esperava %, veio % %)', msg, codigo, sqlstate, sqlerrm;
  end;
  raise exception 'FALHOU: % (não deu erro)', msg;
end $$;

insert into public.lojas (id, nome, slug, modo_venda) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a', 'checkout'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b', 'checkout');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'lojista');
create temp table t (nome text primary key, v uuid);
grant all on t to public;

-- 0) tudo nasce desligado
select public.afirma((select count(*) from public.recursos_plataforma where codigo in ('chat_persistente','chat_consulta_bling','chat_leitura_administrativa') and not ativo_padrao) = 3, 'os 3 recursos do chat nascem desligados');
select public.espera_erro($$select * from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', null, 'oi', 'idem-0001-aaaa', null)$$, '55000', 'com o recurso desligado o chat não persiste nada');
insert into public.loja_recursos (loja_id, recurso, ativo) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'chat_persistente', true), ('bbbbbbbb-0000-0000-0000-000000000002', 'chat_persistente', true);

-- 1) início idempotente
do $$ declare r record; begin
  select * into r from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', null, 'Qual o preço do SKU X?', 'idem-0001-aaaa', 'compativel_openai');
  insert into t values ('q_ed', r.mensagem_id), ('c_ed', r.conversa_id);
  perform public.afirma(r.reutilizada = false and r.resposta is null, 'primeiro envio cria conversa e pergunta');
  select * into r from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', null, 'Qual o preço do SKU X?', 'idem-0001-aaaa', 'compativel_openai');
  perform public.afirma(r.reutilizada and r.mensagem_id = (select v from t where nome='q_ed') and r.resposta is null, 'reenvio sem resposta devolve a mesma pergunta (o servidor pode reprocessar)');
end $$;
select public.afirma((select count(*) from public.mensagens) = 1 and (select count(*) from public.conversas) = 1, 'reenvio não duplicou nada');
select public.afirma((select expira_em from public.conversas) between now() + interval '179 days' and now() + interval '181 days', 'prazo padrão de 180 dias');

-- 2) resposta com prova de proveniência; uma só por pergunta; reenvio devolve a gravada
select public.afirma(public.chat_responder((select v from t where nome='q_ed'), 'O SKU X custa R$ 10,00 (Bling, 12:00).', 'ok', 'compativel_openai', 'modelo-x', 120, 2,
  '[{"ferramenta":"bling_consultar_produto","origem":"bling_ao_vivo","status_http":200,"hash":"abc"}]', '[{"tipo":"bling","sku":"X"}]', 'chatcmpl-abc', false) is not null, 'resposta gravada');
select public.afirma((select resposta_id_provedor = 'chatcmpl-abc' and not simulado and desfecho = 'ok' and evidencias->0->>'sku' = 'X' from public.mensagens where papel='assistente'), 'prova de chamada e evidências na linha do assistente');
select public.espera_erro($$select public.chat_responder((select v from t where nome='q_ed'), 'segunda', 'ok', 'claude', 'm', 1, 1, '[]', '[]', 'x', false)$$, '23505', 'segunda resposta para a mesma pergunta é recusada');
select public.afirma((select resposta like 'O SKU X custa%' and reutilizada from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', null, 'Qual o preço do SKU X?', 'idem-0001-aaaa', null)), 'reenvio após a resposta devolve a resposta gravada (sem pagar o provedor de novo)');
-- falha também é registrada, sem corpo de erro
do $$ declare r record; begin
  select * into r from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', null, 'pergunta do lojista', 'idem-0002-bbbb', 'claude');
  insert into t values ('q_lj', r.mensagem_id), ('c_lj', r.conversa_id);
  perform public.chat_responder(r.mensagem_id, 'Não consegui responder agora.', 'falhou', 'claude', null, null, 1, '[]', '[]', null, false, 'provedor_401');
  perform public.afirma((select desfecho = 'falhou' and erro_codigo = 'provedor_401' from public.mensagens where em_resposta_a = r.mensagem_id), 'falha registra só o código');
end $$;

-- 3) fronteiras da loja e integridade
select public.espera_erro($$select * from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', null, 'x', 'idem-0003-cccc', null)$$, '42501', 'usuário de outra loja não inicia conversa na loja A');
select public.espera_erro($$select * from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', (select v from t where nome='c_ed'), 'invadindo', 'idem-0004-dddd', null)$$, 'P0002', 'ninguém continua conversa de outro usuário (nem o lojista)');
select public.espera_erro($$insert into public.mensagens (loja_id, conversa_id, papel, conteudo, idempotency_key) values ('bbbbbbbb-0000-0000-0000-000000000002', (select v from t where nome='c_ed'), 'usuario', 'x', 'idem-9999-zzzz')$$, '23503', 'mensagem da loja B não entra em conversa da loja A (chave composta)');
select public.espera_erro($$update public.mensagens set conteudo = 'adulterado'$$, '42501', 'mensagem não pode ser alterada');
select public.espera_erro($$insert into public.mensagens (loja_id, conversa_id, papel, conteudo) values ('aaaaaaaa-0000-0000-0000-000000000001', (select v from t where nome='c_ed'), 'assistente', 'sem pergunta')$$, '23514', 'resposta sem pergunta é recusada pelo banco');

-- 4) visibilidade (D3): cada um vê só as suas, inclusive o lojista
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
select public.afirma((select count(*) from public.conversas) = 1 and (select count(*) from public.mensagens) = 2, 'editor vê só a própria conversa');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.afirma((select count(*) from public.conversas) = 1 and (select user_id from public.conversas) = '11111111-1111-1111-1111-111111111111', 'lojista NÃO vê a conversa do editor pela tabela');
select public.espera_erro($$select * from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', null, 'x', 'idem-0005-eeee', null)$$, '42501', 'usuário autenticado não executa a escrita do servidor');
select public.espera_erro($$insert into public.conversas (loja_id, user_id, expira_em) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', now())$$, '42501', 'usuário não escreve direto na tabela');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1"}', true);
select public.afirma((select count(*) from public.conversas) = 0 and (select count(*) from public.mensagens) = 0, 'lojista de outra loja não vê nada');
reset role;
set local role anon;
select public.espera_erro($$select count(*) from public.mensagens$$, '42501', 'anon não lê mensagens');
reset role;

-- 5) leitura administrativa explícita (D3)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.espera_erro($$select * from public.chat_ler_como_administrador((select v from t where nome='c_ed'), 'auditoria de atendimento ao cliente')$$, '42501', 'recurso desligado: nem o lojista lê a conversa alheia');
reset role;
insert into public.loja_recursos (loja_id, recurso, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001', 'chat_leitura_administrativa', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.espera_erro($$select * from public.chat_ler_como_administrador((select v from t where nome='c_ed'), 'curto')$$, '42501', 'motivo curto é recusado');
select public.afirma((select count(*) from public.chat_ler_como_administrador((select v from t where nome='c_ed'), 'auditoria de atendimento ao cliente')) = 2, 'recurso ligado + lojista + motivo: lê as 2 mensagens');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
select public.espera_erro($$select * from public.chat_ler_como_administrador((select v from t where nome='c_lj'), 'tentando ler a do lojista')$$, '42501', 'editor não lê conversa alheia, nem com o recurso ligado');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","aal":"aal1"}', true);
select public.espera_erro($$select * from public.chat_ler_como_administrador((select v from t where nome='c_ed'), 'lojista de outra loja tentando')$$, '42501', 'administrador de outra loja não atravessa a fronteira');
reset role;
select public.afirma((select count(*) from public.auditoria where acao = 'conversa.leitura_administrativa') = 1
  and (select depois->>'motivo' from public.auditoria where acao = 'conversa.leitura_administrativa') = 'auditoria de atendimento ao cliente'
  and (select user_id from public.auditoria where acao = 'conversa.leitura_administrativa') = '11111111-1111-1111-1111-111111111111', 'só a leitura permitida gerou trilha, com quem leu e por quê');
select public.afirma(not exists (select 1 from public.auditoria where depois::text ilike '%custa R$%'), 'a auditoria não contém o conteúdo das mensagens');

-- 6) exclusão controlada e retenção (D2)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.afirma(public.chat_excluir((select v from t where nome='c_ed')) = false, 'lojista não exclui a conversa do editor');
select public.afirma(public.chat_definir_retencao('aaaaaaaa-0000-0000-0000-000000000001', 30) = true, 'lojista ajusta a retenção da loja');
select public.afirma(public.chat_definir_retencao('aaaaaaaa-0000-0000-0000-000000000001', 3) = false, 'retenção fora de 7–730 dias é recusada');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","aal":"aal1"}', true);
select public.afirma(public.chat_definir_retencao('aaaaaaaa-0000-0000-0000-000000000001', 365) = false, 'editor não altera a retenção');
select public.afirma(public.chat_excluir((select v from t where nome='c_ed')) = true, 'titular exclui a própria conversa');
reset role;
select public.afirma(not exists (select 1 from public.mensagens where conversa_id = (select v from t where nome='c_ed')), 'a exclusão levou as mensagens junto');
select public.afirma((select depois ->> 'mensagens' from public.auditoria where acao = 'conversa.excluida') = '2' and (select depois::text from public.auditoria where acao = 'conversa.excluida') not ilike '%Qual o preço%', 'auditoria da exclusão guarda só contagem');
select public.afirma((select count(*) from public.auditoria where acao = 'chat.retencao_alterada') = 1, 'mudança de retenção auditada');
do $$ declare r record; begin
  select * into r from public.chat_iniciar('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', null, 'nova após retenção de 30 dias', 'idem-0006-ffff', null);
  perform public.afirma((select expira_em from public.conversas where id = r.conversa_id) between now() + interval '29 days' and now() + interval '31 days', 'conversa nova usa a retenção configurada (30 dias)');
  update public.conversas set expira_em = now() - interval '1 day' where id = r.conversa_id;
end $$;
select public.afirma(public.chat_expurgar() = 1, 'expurgo por prazo remove só a vencida');
select public.afirma((select count(*) from public.conversas) = 1, 'a conversa dentro do prazo permanece');
select public.afirma((select depois ->> 'conversas' from public.auditoria where acao = 'conversa.expurgo_prazo') = '1', 'expurgo auditado só com contagem');
select public.espera_erro($$delete from public.auditoria$$, 'P0001', 'a auditoria segue imutável (política própria, separada das conversas)');
rollback;
