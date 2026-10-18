-- Testa migração 19 (receitas) com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.recusa(cmd text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; raise exception 'FALHOU: aceitou -> %', msg;
  exception when check_violation or unique_violation or foreign_key_violation or not_null_violation then raise notice 'ok: %', msg; end;
end $$;

insert into public.receitas (id, perfil_ramo, codigo, versao, nome, status, passos, campos_exigidos) values
  ('e0000000-0000-0000-0000-000000000001', 'autopecas', 'filtro_oleo', 1, 'Filtro de óleo v1', 'ativa',
   '[{"ordem":1,"acao":"ler_bling"},{"ordem":2,"acao":"buscar_codigo_fabricante"}]', array['codigo_fabricante']);
select public.recusa($$insert into public.receitas (perfil_ramo, codigo, versao, nome, passos) values ('autopecas', 'filtro_oleo', 1, 'dup', '[{"a":1}]')$$, 'mesma versão duplicada é recusada');
select public.recusa($$insert into public.receitas (perfil_ramo, codigo, versao, nome, status, passos) values ('autopecas', 'filtro_oleo', 2, 'v2', 'ativa', '[{"a":1}]')$$, 'duas versões ativas da mesma receita são recusadas');
select public.recusa($$insert into public.receitas (perfil_ramo, codigo, nome, passos) values ('autopecas', 'sem_passos', 'x', '[]')$$, 'receita sem passos é recusada');
select public.recusa($$insert into public.receitas (perfil_ramo, codigo, nome, passos) values ('autopecas', 'passos_objeto', 'x', '{"a":1}')$$, 'passos que não são lista são recusados');
select public.recusa($$update public.receitas set passos = '[{"ordem":1,"acao":"outra"}]' where id = 'e0000000-0000-0000-0000-000000000001'$$, 'alterar passos de uma versão é recusado');
update public.receitas set status = 'aposentada' where id = 'e0000000-0000-0000-0000-000000000001';
select public.afirma((select status from public.receitas where codigo = 'filtro_oleo') = 'aposentada', 'status pode mudar (aposentar versão)');
insert into public.receitas (id, perfil_ramo, codigo, versao, nome, status, passos, substitui_id) values
  ('e0000000-0000-0000-0000-000000000002', 'autopecas', 'filtro_oleo', 2, 'Filtro de óleo v2', 'ativa', '[{"ordem":1,"acao":"ler_bling"}]', 'e0000000-0000-0000-0000-000000000001');

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', 'S-A', 'Filtro A', 1, 1),
  ('aaaaaaaa-1111-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3', 'S-A3', 'Filtro A3', 1, 1),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '1', 'S-B', 'Filtro B', 1, 1);

insert into public.receita_execucoes (id, loja_id, produto_id, receita_id, idempotency_key) values
  ('11000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'k-a1'),
  ('11000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'k-a3'),
  ('11000000-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-1111-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'k-b1');
select public.recusa($$insert into public.receita_execucoes (loja_id, produto_id, receita_id, idempotency_key) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'k-a1')$$, 'mesma idempotency_key na mesma loja é recusada');
select public.recusa($$update public.receita_execucoes set resultado = 'sucesso' where id = '11000000-0000-0000-0000-00000000000a'$$, 'execução concluída sem data de conclusão é recusada');
update public.receita_execucoes set resultado = 'parcial', concluida_em = now() where id = '11000000-0000-0000-0000-00000000000a';
select public.afirma((select resultado from public.receita_execucoes where idempotency_key='k-a1') = 'parcial', 'execução conclui com resultado e data');

-- correções: 2 da loja A + 1 da loja B com o mesmo valor final => candidata (>=3 e >=2 lojas)
insert into public.receita_correcoes (loja_id, execucao_id, campo, valor_proposto, valor_final) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000a', 'rosca', 'M18', 'M20'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000b', 'rosca', 'M18', 'M20');
select public.afirma((select count(*) from public.receita_correcoes_candidatas) = 0, 'correções iguais vindas de uma só loja não são candidatas');
select public.recusa($$insert into public.receita_correcoes (loja_id, execucao_id, campo, valor_proposto, valor_final) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11000000-0000-0000-0000-00000000000a', 'x', 'M20', 'M20')$$, 'correção sem diferença é recusada');
insert into public.receita_correcoes (loja_id, execucao_id, campo, valor_proposto, valor_final) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '11000000-0000-0000-0000-00000000000c', 'rosca', 'M18', 'M20');
select public.afirma((select lojas from public.receita_correcoes_candidatas where campo='rosca') = 2, '3 correções iguais de 2 lojas viram candidata');
select public.recusa($$update public.receita_correcoes set status = 'promovida'$$, 'promoção sem data de decisão é recusada');

-- RLS / grants
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.receitas) = 1, 'logado vê só a receita ativa');
select public.afirma((select count(*) from public.receita_execucoes) = 2, 'lojista vê só as execuções da própria loja');
select public.afirma((select count(*) from public.receita_correcoes) = 2, 'lojista vê só as correções da própria loja');
do $$ begin
  begin perform count(*) from public.receita_correcoes_candidatas; raise exception 'leu candidatas';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista não lê a visão que cruza lojas');
do $$ begin
  begin insert into public.receitas (perfil_ramo, codigo, nome, passos) values ('autopecas', 'hack', 'x', '[{"a":1}]'); raise exception 'escreveu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista não escreve receita');
set local role anon;
do $$ begin
  begin perform count(*) from public.receitas; raise exception 'anon leu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'visitante (anon) não lê receitas');
rollback;
