begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.montadoras (id, nome) values ('eeeeeeee-0000-0000-0000-000000000001', 'Montadora Teste');
insert into public.modelos (id, montadora_id, nome, categoria) values
  ('ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001','Moto X','moto'),
  ('ffffffff-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000001','Caminhão Y','caminhao'),
  ('ffffffff-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','Sedã Z','passeio');
select public.afirma((select count(*) from public.modelos where montadora_id='eeeeeeee-0000-0000-0000-000000000001') = 3, 'moto, caminhão e passeio são aceitos como tipo de modelo');
do $$ begin begin insert into public.modelos (montadora_id, nome, categoria) values ('eeeeeeee-0000-0000-0000-000000000001','Nave','espaconave'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'tipo inventado continua recusado');

insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a');
insert into public.produtos (id, loja_id, bling_id, nome, sku, publicado) values ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',1,'Corrente','C1',true);
insert into public.produto_aplicacoes (loja_id, produto_id, modelo, modelo_id) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','Moto X','ffffffff-0000-0000-0000-000000000001');
select public.afirma((select modelo_id from public.produto_aplicacoes limit 1) = 'ffffffff-0000-0000-0000-000000000001', 'aplicação liga ao modelo cadastrado');
insert into public.produto_aplicacoes (loja_id, produto_id, modelo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','Texto livre');
select public.afirma((select count(*) from public.produto_aplicacoes where modelo_id is null) = 1, 'aplicação sem ligação continua permitida (fica sem tipo)');
do $$ begin begin insert into public.produto_aplicacoes (loja_id, produto_id, modelo, modelo_id) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','X','00000000-0000-0000-0000-000000000099'); raise exception 'passou';
  exception when foreign_key_violation then null; end; end $$;
select public.afirma(true, 'modelo inexistente é recusado');
rollback;
