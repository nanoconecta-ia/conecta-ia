-- Banners Flash: SKU único, imagem autorizada, isolamento de loja e reação à revogação.
-- Suíte transacional executada em Postgres local descartável; não escreve no projeto real.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(ok,false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.lojas (id,nome,slug) values
  ('aaaaaaaa-2222-4444-8888-000000000001','Loja A Flash','loja-a-flash'),
  ('bbbbbbbb-2222-4444-8888-000000000002','Loja B Flash','loja-b-flash');
insert into public.produtos (id,loja_id,bling_id,sku,nome,preco,estoque,publicado) values
  ('cccccccc-2222-4444-8888-000000000001','aaaaaaaa-2222-4444-8888-000000000001','flash-1','MOTOR1','Motor único',5000,0,true),
  ('cccccccc-2222-4444-8888-000000000002','aaaaaaaa-2222-4444-8888-000000000001','flash-2','MOTOR2','Motor diferente',1000,1,true),
  ('cccccccc-2222-4444-8888-000000000003','bbbbbbbb-2222-4444-8888-000000000002','flash-3','MOTOR3','Motor outra loja',1000,1,true);
insert into public.produto_imagens (id,loja_id,produto_id,url,tipo,origem,licenca_tipo,aprovada,principal,cruzamento_tipo,cruzamento_valor,url_original) values
 ('dddddddd-2222-4444-8888-000000000001','aaaaaaaa-2222-4444-8888-000000000001','cccccccc-2222-4444-8888-000000000001','https://cdn.exemplo/motor-licenciado.jpg','real','loja','propria',true,true,null,null,null),
 ('dddddddd-2222-4444-8888-000000000002','aaaaaaaa-2222-4444-8888-000000000001','cccccccc-2222-4444-8888-000000000001','https://cdn.exemplo/motor-sem-direito.jpg','ilustrativa','fornecedor','publica_web',true,false,'sku','MOTOR1','https://fornecedor.exemplo/material/motor.jpg'),
 ('dddddddd-2222-4444-8888-000000000003','aaaaaaaa-2222-4444-8888-000000000001','cccccccc-2222-4444-8888-000000000002','https://cdn.exemplo/motor-outro-produto.jpg','real','loja','propria',true,true,null,null,null),
 ('dddddddd-2222-4444-8888-000000000004','bbbbbbbb-2222-4444-8888-000000000002','cccccccc-2222-4444-8888-000000000003','https://cdn.exemplo/motor-outra-loja.jpg','real','loja','propria',true,true,null,null,null);

insert into public.loja_banners(id,loja_id,produto_id,imagem_id,ativo,estilo,chamada) values
('eeeeeeee-2222-4444-8888-000000000001','aaaaaaaa-2222-4444-8888-000000000001',
 'cccccccc-2222-4444-8888-000000000001','dddddddd-2222-4444-8888-000000000001',true,'flash','Consulte o motor');
select public.afirma(
  (select j->0->>'imagem' from public.banners_da_vitrine('aaaaaaaa-2222-4444-8888-000000000001') j) = 'https://cdn.exemplo/motor-licenciado.jpg',
  'Flash usa exclusivamente foto autorizada do mesmo SKU');
select public.afirma(
  (select j->0->>'sku' from public.banners_da_vitrine('aaaaaaaa-2222-4444-8888-000000000001') j) = 'MOTOR1',
  'campanha preserva SKU físico único');
select public.afirma(
  (select j->0->>'preco' from public.banners_da_vitrine('aaaaaaaa-2222-4444-8888-000000000001') j) is null,
  'saldo zero não exibe preço no Flash');
select public.afirma(
  (select jsonb_array_length(public.banners_da_vitrine('bbbbbbbb-2222-4444-8888-000000000002'))) = 0,
  'tenant B não recebe banners do tenant A');

do $$ begin
 begin
  update public.loja_banners set imagem_id='dddddddd-2222-4444-8888-000000000002' where id='eeeeeeee-2222-4444-8888-000000000001';
  raise exception 'FALHOU: imagem sem licença foi aceita';
 exception when check_violation then null; end;
end $$;
select public.afirma(true,'imagem aprovada sem direitos é rejeitada');

do $$ begin
 begin
  update public.loja_banners set imagem_id='dddddddd-2222-4444-8888-000000000003' where id='eeeeeeee-2222-4444-8888-000000000001';
  raise exception 'FALHOU: imagem de SKU diferente foi aceita';
 exception when check_violation then null; end;
end $$;
select public.afirma(true,'imagem de outro produto da mesma loja é rejeitada');

do $$ begin
 begin
  update public.loja_banners set imagem_id='dddddddd-2222-4444-8888-000000000004' where id='eeeeeeee-2222-4444-8888-000000000001';
  raise exception 'FALHOU: imagem de outra loja foi aceita';
 exception when check_violation then null; end;
end $$;
select public.afirma(true,'imagem de outra loja é rejeitada');

update public.produto_imagens set removida_em=now() where id='dddddddd-2222-4444-8888-000000000001';
select public.afirma(
  (select j->0->>'imagem' from public.banners_da_vitrine('aaaaaaaa-2222-4444-8888-000000000001') j) is null,
  'imagem retirada some imediatamente da leitura Flash');
update public.loja_banners set ativo=false where id='eeeeeeee-2222-4444-8888-000000000001';
select public.afirma(
  (select ativo=false from public.loja_banners where id='eeeeeeee-2222-4444-8888-000000000001'),
  'lojista consegue pausar banner mesmo após revogação de foto');
do $$ begin
 begin
  update public.loja_banners set ativo=true where id='eeeeeeee-2222-4444-8888-000000000001';
  raise exception 'FALHOU: reativação com foto revogada foi aceita';
 exception when check_violation then null; end;
end $$;
select public.afirma(true,'não reativa banner com foto revogada');

-- Sem imagem fixa, usa principal autorizada caso exista; senão não expõe foto.
update public.loja_banners set imagem_id=null,ativo=true where id='eeeeeeee-2222-4444-8888-000000000001';
select public.afirma(
  (select j->0->>'imagem' from public.banners_da_vitrine('aaaaaaaa-2222-4444-8888-000000000001') j) is null,
  'fallback não revela foto sem direitos');
rollback;
