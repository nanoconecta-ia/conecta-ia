begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, nome, sku, preco, publicado, taxonomia_no_id) values
 ('dddddddd-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',100,'Bomba de óleo','CI1',100,true,(select id from public.taxonomia_nos where pai_id=(select id from public.taxonomia_nos where slug='motor' and pai_id is null) limit 1)),
 ('dddddddd-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',200,'Filtro','CI2',20,true,null),
 ('dddddddd-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001',300,'Oculto','CI3',5,false,null),
 ('dddddddd-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000002',400,'Outra loja','CI4',5,true,null);

insert into public.loja_banners (loja_id, produto_id, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',true);
insert into public.loja_banners (loja_id, produto_id, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002',true);
select public.afirma((select count(*) from public.auditoria where tabela='loja_banners') = 2, 'banners são auditados');
do $$ begin begin insert into public.loja_banners (loja_id, produto_id, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000003',true); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'produto não publicado não pode ter banner ativo');
insert into public.loja_banners (loja_id, produto_id, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000003',false);
select public.afirma(true, 'rascunho de produto não publicado é permitido');
do $$ begin begin insert into public.loja_banners (loja_id, produto_id) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000004'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'produto de outra loja é recusado');
do $$ begin begin insert into public.loja_banners (loja_id, produto_id, inicio, fim) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001', now(), now() - interval '1 day'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'fim antes do início é recusado');
-- limite de 5 ativos
insert into public.loja_banners (loja_id, produto_id, ativo) select 'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',true from generate_series(1,3);
do $$ begin begin insert into public.loja_banners (loja_id, produto_id, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',true); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'o sexto banner ativo é recusado');

-- vitrine: flash automático só para Motor
select public.afirma((select (j->0->>'flash')::boolean from public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001') j limit 1) is not null, 'vitrine devolve banners');
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001'))) = 5, 'vitrine devolve só os ativos');
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001')) e where (e->>'flash')::boolean and e->>'sku'='CI1') = 4, 'produto de Motor vira flash no modo automático');
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001')) e where (e->>'flash')::boolean and e->>'sku'='CI2') = 0, 'produto fora de Motor não vira flash sozinho');
update public.loja_banners set estilo='flash' where produto_id='dddddddd-0000-0000-0000-000000000002';
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001')) e where (e->>'flash')::boolean and e->>'sku'='CI2') = 1, 'estilo flash manual vale em qualquer área');
update public.loja_banners set inicio = now() - interval '2 hours', fim = now() - interval '1 hour' where produto_id='dddddddd-0000-0000-0000-000000000002';
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001')) e where e->>'sku'='CI2') = 0, 'banner vencido sai do ar');
update public.produtos set publicado=false where id='dddddddd-0000-0000-0000-000000000001';
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001'))) = 0, 'despublicar o produto tira o banner do ar');
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('bbbbbbbb-0000-0000-0000-000000000002'))) = 0, 'loja B não vê banner da loja A');

-- agente propõe: sempre rascunho invisível, com limite de rascunhos
select public.banner_propor('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002','flash','  Só hoje ', null, null) as id \gset
select public.afirma((select not ativo and chamada = 'Só hoje' from public.loja_banners where id = :'id'), 'banner proposto nasce rascunho e com chamada aparada');
select public.afirma((select count(*) from jsonb_array_elements(public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001')) e where e->>'sku'='CI2') = 0, 'rascunho proposto não aparece na vitrine');
do $$ begin begin perform public.banner_propor('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002','piscante',null,null,null); raise exception 'passou';
  exception when sqlstate '22023' then null; end; end $$;
select public.afirma(true, 'estilo inválido é recusado');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.loja_banners) > 0, 'lojista A vê os banners da própria loja');
do $$ begin begin insert into public.loja_banners (loja_id, produto_id) values ('bbbbbbbb-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000004'); raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista A não grava banner na loja B');
do $$ begin begin perform public.banners_da_vitrine('aaaaaaaa-0000-0000-0000-000000000001'); raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'leitura pública só pela função de servidor');
do $$ begin begin perform public.banner_propor('aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002','auto',null,null,null); raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'só o servidor propõe banner');
rollback;
