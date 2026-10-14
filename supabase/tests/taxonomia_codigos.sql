-- Testa migração 8 com lojas FICTÍCIAS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, peso_kg, publicado) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', 'S-A', 'Biela', 320.123456, 1.2345678, 0.12345, true),
  ('bbbbbbbb-1111-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '1', 'S-B', 'Outra', 1, 1, 1, true);
select public.afirma((select preco from public.produtos where sku='S-A') = 320.123456, 'preço guarda 6 casas');
select public.afirma((select estoque from public.produtos where sku='S-A') = 1.2345678, 'estoque guarda 7 casas');
select public.afirma((select peso_kg from public.produtos where sku='S-A') = 0.12345, 'peso guarda 5 casas');
select public.afirma((select perfil_ramo from public.lojas where slug='loja-a') = 'autopecas', 'loja nasce com perfil autopeças');

insert into public.marcas (id, loja_id, nome, tipo, status) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hyundai', 'veiculo', 'aprovado');
do $$ begin
  begin insert into public.marcas (loja_id, nome, tipo) values ('aaaaaaaa-0000-0000-0000-000000000001', ' hyundai ', 'veiculo'); raise exception 'duplicou';
  exception when unique_violation then null; end;
end $$;
select public.afirma(true, 'marca duplicada (caixa/espaços) é recusada');

-- aprovado exige fonte e data
do $$ begin
  begin insert into public.produto_codigos (loja_id, produto_id, tipo, valor, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','oem','235104A710','aprovado'); raise exception 'aprovou sem fonte';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'código aprovado sem fonte/data é recusado');
insert into public.produto_codigos (loja_id, produto_id, tipo, valor, status, fonte, coletado_em, confianca) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','oem','235104A710','aprovado','catalogo-x', now(), 0.9),
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','similar','SIM-1','a_confirmar',null,null,null);
do $$ begin
  begin insert into public.produto_aplicacoes (loja_id, produto_id, modelo, ano_inicial, ano_final)
    values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','HR',2012,2010); raise exception 'anos invertidos';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'ano final menor que inicial é recusado');
insert into public.produto_aplicacoes (loja_id, produto_id, marca_veiculo_id, modelo, ano_inicial, ano_final, status, fonte, coletado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','HR',2008,2012,'aprovado','catalogo-x', now());
insert into public.produto_aplicacoes (loja_id, produto_id, modelo) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','HR-pendente');

-- Lojista A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","aal":"aal1"}', true);
select public.afirma((select count(*) from public.produto_codigos) = 2, 'lojista A vê todos os códigos da loja A (inclusive a confirmar)');
select public.afirma((select count(*) from public.marcas) = 1, 'lojista A vê só marcas da loja A');
select public.afirma((select count(*) from public.taxonomia_nos) >= 0, 'taxonomia legível');
do $$ begin
  begin insert into public.produto_codigos (loja_id, produto_id, tipo, valor) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','oem','X'); raise exception 'escreveu';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'lojista não grava código direto (só o servidor)');

-- Público (anon): só aprovado, de produto publicado
reset role; set local role anon;
select public.afirma((select count(*) from public.produto_codigos) = 1, 'anon vê só código aprovado');
select public.afirma((select count(*) from public.produto_aplicacoes) = 1, 'anon vê só aplicação aprovada');
select public.afirma((select count(*) from public.marcas) = 1, 'anon vê só marca aprovada');
do $$ begin
  begin perform 1 from public.bling_categorias; raise exception 'anon leu categorias';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'anon não lê o espelho de categorias do Bling');
rollback;
