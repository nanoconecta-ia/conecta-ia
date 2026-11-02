-- PR #242: no máximo 8 imagens ativas por produto (gatilho). Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', 'JC-1234', 'Junta', 'A'),
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2', 'JC-9999', 'Outra', 'A');
insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, ordem)
  select 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'https://x.com/' || g || '.jpg', 'ilustrativa', 'busca_web', g from generate_series(1, 8) g;
select public.afirma((select count(*) from public.produto_imagens where produto_id = 'cccccccc-0000-0000-0000-000000000001') = 8, 'oito imagens entram');
do $$ begin begin insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, ordem) values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'https://x.com/9.jpg', 'ilustrativa', 'busca_web', 9); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'a nona imagem é recusada pelo banco');
update public.produto_imagens set removida_em = now() where produto_id = 'cccccccc-0000-0000-0000-000000000001' and ordem = 1;
insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, ordem) values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'https://x.com/10.jpg', 'ilustrativa', 'busca_web', 10);
select public.afirma(true, 'retirada (takedown) libera uma vaga');
insert into public.produto_imagens (loja_id, produto_id, url, tipo, origem, ordem) values ('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'https://x.com/o.jpg', 'ilustrativa', 'busca_web', 1);
select public.afirma(true, 'o limite é por produto, não por loja');
rollback;
