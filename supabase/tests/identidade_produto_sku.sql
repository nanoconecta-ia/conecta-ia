begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-00000000000b','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111');
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set B '\'bbbbbbbb-0000-0000-0000-00000000000b\''

-- 1) SKU repetido não derruba nada (antes: violação do índice único) e fica preservado
insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao, publicado) values
  (:A,'100','X-1','Retentor A',5,'A',true), (:A,'101','x-1 ','Retentor B',5,'A',true), (:A,'102','OK-2','Normal',9,'A',true), (:A,'103','X-1','Excluído',5,'E',false);
select public.afirma((select count(*) from public.produtos where loja_id = :A) = 4, 'quatro registros preservados, mesmo com SKU repetido');
select public.afirma((public.produtos_reconciliar_identidade(:A)->>'abertos')::int = 2, 'repetição ativa abre 2 conflitos (maiúsculas e espaços não diferenciam)');
select public.afirma((select count(*) from public.produto_conflitos where motivo = 'sku_duplicado' and estado = 'aberto' and original ? 'nome' and original ? 'preco') = 2, 'conflito guarda cópia do registro original');
select public.afirma((select outros_bling_ids from public.produto_conflitos where bling_id = '100') = array['101'], 'conflito aponta o outro registro (o excluído não conta)');
select public.afirma((select not publicado from public.produtos where bling_id = '100') and (select not publicado from public.produtos where bling_id = '101'), 'ambos os ambíguos são despublicados');
select public.afirma((select publicado from public.produtos where bling_id = '102'), 'produto válido continua publicado (sem bloqueio dos demais)');

-- 2) não publica ambíguo por nenhum caminho
do $$ begin begin update public.produtos set publicado = true where bling_id = '100'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'trigger recusa publicar produto ambíguo');
select public.afirma((public.publicar_produto((select id from public.produtos where bling_id = '101'), true, null)->>'ok') is distinct from 'true' or (select not publicado from public.produtos where bling_id = '101'), 'publicar_produto não publica ambíguo');
-- (publicar_produto devolve faltando ou o trigger levanta; em ambos os casos continua despublicado)

-- 3) reprocessamento é idempotente
select public.produtos_reconciliar_identidade(:A);
select public.afirma((select count(*) from public.produto_conflitos where loja_id = :A) = 2, 'reprocessar não duplica conflitos');

-- 4) alteração de SKU resolve o conflito pelo ID do Bling
update public.produtos set sku = 'X-1B' where bling_id = '101';
select public.afirma((public.produtos_reconciliar_identidade(:A)->>'abertos')::int = 0, 'mudar o SKU resolve os dois conflitos');
select public.afirma((select count(*) from public.produto_conflitos where estado = 'resolvido' and resolvido_em is not null) = 2, 'conflitos ficam registrados como resolvidos');
update public.produtos set publicado = true where bling_id = '100';
select public.afirma((select publicado from public.produtos where bling_id = '100'), 'resolvido, o produto pode ser publicado de novo');
-- SKU volta a repetir => reabre sem duplicar a linha
update public.produtos set sku = 'X-1' where bling_id = '101';
select public.afirma((public.produtos_reconciliar_identidade(:A)->>'abertos')::int = 2 and (select count(*) from public.produto_conflitos where loja_id = :A) = 2, 'conflito reabre na mesma linha');
select public.afirma((select not publicado from public.produtos where bling_id = '100'), 'reaberto, o produto publicado é despublicado');

-- 5) SKU vazio
insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao, publicado) values (:A,'200',null,'Sem código',1,'A',false), (:A,'201','   ','Branco',1,'A',false), (:A,'202',null,'Inativo sem código',1,'I',false);
select public.produtos_reconciliar_identidade(:A);
select public.afirma((select count(*) from public.produto_conflitos where motivo = 'sku_vazio' and estado = 'aberto') = 2, 'SKU vazio ou em branco (ativo) abre conflito; inativo não');
do $$ begin begin update public.produtos set publicado = true where bling_id = '200'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'produto sem SKU não é publicado');

-- 6) isolamento entre lojas: o mesmo SKU em outra loja não é conflito
insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao, publicado) values (:B,'100','X-1','Retentor da Loja B',5,'A',true);
select public.afirma((public.produtos_reconciliar_identidade(:B)->>'abertos')::int = 0, 'mesmo SKU em outra loja não gera conflito');
select public.afirma((select publicado from public.produtos where loja_id = :B), 'produto da loja B segue publicado');
select public.afirma((select count(*) from public.produto_conflitos where loja_id = :B) = 0, 'nenhum conflito vaza para a loja B');

-- 7) permissões: lojista só lê o da própria loja; ninguém escreve; a reconciliação é só do servidor
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.produto_conflitos) > 0 and (select count(*) from public.produto_conflitos where loja_id = :B) = 0, 'lojista A vê só os conflitos da própria loja');
do $$ begin begin update public.produto_conflitos set estado = 'resolvido'; raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista não altera conflito');
do $$ begin begin perform public.produtos_reconciliar_identidade('aaaaaaaa-0000-0000-0000-00000000000a'); raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'reconciliação só pelo servidor');
rollback;
