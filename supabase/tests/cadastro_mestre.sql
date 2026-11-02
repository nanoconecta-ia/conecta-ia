-- Testa mestre/origem/vínculo de NF/evidência de marca (append-only, isolamento por loja, proteção). Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', 'CI001086', 'Kit correia', 'A'),
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '2', 'B-1', 'Produto B', 'A');
insert into public.produto_mestre (id, loja_id, nome) values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kit correia dentada');
select public.afirma((select origem_marca from public.produto_mestre) = 'a_confirmar', 'marca nasce a_confirmar');

insert into public.produto_origem (loja_id, mestre_id, tipo, sku_origem, produto_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'importador', 'CI001086', 'cccccccc-0000-0000-0000-000000000001');
do $$ begin begin insert into public.produto_origem (loja_id, mestre_id, tipo, sku_origem)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'fabricante', 'X'); raise exception 'aceitou'; exception when foreign_key_violation then null; end; end $$;
select public.afirma(true, 'origem não liga a mestre de outra loja');

insert into public.produto_vinculo_nf (loja_id, nota_tipo, nota_numero, item_numero, produto_id, evidencia, criado_por)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'entrada', '1234', 1, 'cccccccc-0000-0000-0000-000000000001', 'NF-e de entrada item 1', gen_random_uuid());
select public.afirma((select protegido_por_nf from public.produtos where sku = 'CI001086'), 'vínculo protege o produto');
do $$ begin begin update public.produto_vinculo_nf set evidencia = 'alterada!!'; raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'vínculo de NF não é editável');
do $$ begin begin delete from public.produto_vinculo_nf; raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'vínculo de NF não é apagável');
do $$ begin begin insert into public.produto_vinculo_nf (loja_id, nota_tipo, nota_numero, item_numero, mestre_id, evidencia, imutavel, criado_por)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'saida', '9', 1, 'eeeeeeee-0000-0000-0000-000000000001', 'evidência ok', false, gen_random_uuid()); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'vínculo não pode ser marcado mutável');

do $$ begin begin delete from public.produto_mestre; raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'mestre não é apagável');
do $$ begin begin delete from public.produto_origem; raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'origem não é apagável');

insert into public.marca_evidencia (loja_id, produto_id, marca, fonte, fonte_tipo, nivel)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'TRIM GO', 'cadastro do fornecedor', 'cadastro', 'declarada');
do $$ begin begin update public.marca_evidencia set nivel = 'verificada'; raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'evidência de marca não é editável');
do $$ begin begin insert into public.marca_evidencia (loja_id, marca, fonte, fonte_tipo, nivel)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'X', 'sem tipo ok', 'palpite', 'declarada'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'fonte_tipo inválido é recusado');

select public.afirma(not has_table_privilege('anon', 'public.produto_origem_custo', 'select'), 'anon não lê custo');
select public.afirma(not has_table_privilege('authenticated', 'public.produto_origem_custo', 'insert'), 'usuário não grava custo direto');
select public.afirma((select relrowsecurity from pg_class where oid = 'public.produto_origem_custo'::regclass), 'custo com RLS');
rollback;
