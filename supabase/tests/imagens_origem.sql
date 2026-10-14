begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a');
insert into public.produtos (id, loja_id, bling_id, sku, nome, publicado) values
  ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','1','S-A','Biela',true);
do $$ begin
  begin insert into public.produto_imagens (produto_id, loja_id, url, tipo, licenca_tipo)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','u','real','publica_web'); raise exception 'passou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'imagem da web pública não pode se passar por foto real nem sem origem');
do $$ begin
  begin insert into public.produto_imagens (produto_id, loja_id, url, tipo, aprovada, origem)
    values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','u','ilustrativa',true,'catalogo'); raise exception 'passou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'ilustrativa aprovada exige cruzamento de código');
insert into public.produto_imagens (id, produto_id, loja_id, url, tipo, aprovada, origem, url_original, licenca_tipo, cruzamento_tipo, cruzamento_valor, confianca, fundo_branco)
  values ('aaaaaaaa-3333-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','u','ilustrativa',true,'catalogo','https://ex.test/p','publica_web','oem','235104A710',0.9,true);
set local role anon;
select public.afirma((select count(*) from public.produto_imagens) = 1, 'anon vê imagem ilustrativa aprovada');
reset role;
update public.produto_imagens set removida_em = now();
set local role anon;
select public.afirma((select count(*) from public.produto_imagens) = 0, 'imagem retirada some da vitrine');
rollback;
