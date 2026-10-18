begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, publicado) values
  ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','1','A-1','Biela',100,true),
  ('aaaaaaaa-1111-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','3','A-3','Pistão',100,true),
  ('bbbbbbbb-1111-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','1','B-1','Outro',10,true);

-- Regime da loja
do $$ begin begin insert into public.loja_fiscal (loja_id, regime) values ('aaaaaaaa-0000-0000-0000-000000000001','simplificado'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'regime inválido é recusado');
do $$ begin begin insert into public.loja_fiscal (loja_id, regime, validado_em) values ('aaaaaaaa-0000-0000-0000-000000000001','presumido', now()); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'loja fiscal validada exige contador, UF e regime');
insert into public.loja_fiscal (loja_id, uf, regime) values ('aaaaaaaa-0000-0000-0000-000000000001','GO','presumido');

-- Regras por UF exigem norma e trecho
insert into public.ref_versoes (id, tabela, fonte, versao, vigencia_ini) values ('cccccccc-0000-0000-0000-000000000001','regras_uf','teste','v1','2026-01-01');
do $$ begin begin insert into public.ref_regras_uf (versao_id, uf, tipo, norma, trecho, vigencia_ini) values ('cccccccc-0000-0000-0000-000000000001','GO','st','',' ','2026-01-01'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'regra por UF sem norma e trecho exato é recusada');

-- NCM da nota é intocável
insert into public.produto_fiscal (produto_id, loja_id, ncm, origem_ncm) values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','84099190','nota_fabricante');
do $$ begin begin update public.produto_fiscal set ncm='87089990'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'NCM da nota do fabricante não muda');
-- CEST e CST podem ser complementados
update public.produto_fiscal set cest='0100100', cst='060', regra_aplicada='cest-por-ncm', fonte='CV142/18 Anexo II item 1', versao_tabela='v1';
select public.afirma((select count(*) from public.fiscal_log where campo in ('cest','cst')) = 2, 'complemento de CEST/CST entra no log fiscal');
select public.afirma((select count(*) from public.fiscal_log where campo='ncm') = 1, 'NCM inicial entrou no log');

-- Sugestão do agente
do $$ begin begin insert into public.produto_fiscal (produto_id, loja_id, ncm, origem_ncm) values ('aaaaaaaa-1111-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','84099190','agente'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'sugestão do agente sem regra, fonte e justificativa é recusada');
insert into public.produto_fiscal (produto_id, loja_id, ncm, origem_ncm, regra_aplicada, fonte, justificativa, confianca)
  values ('aaaaaaaa-1111-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','84099190','agente','TIPI 8409','TIPI v1','peça de motor','0.7');
select public.afirma((select status from public.produto_fiscal where produto_id='aaaaaaaa-1111-0000-0000-000000000003') = 'a_confirmar', 'sugestão nasce a confirmar');
do $$ begin begin update public.produto_fiscal set status='validado' where produto_id='aaaaaaaa-1111-0000-0000-000000000003'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'validar exige contador e data');
-- Log imutável
do $$ begin begin update public.fiscal_log set depois='x'; raise exception 'passou';
  exception when raise_exception then if sqlerrm='passou' then raise; end if; end; end $$;
select public.afirma(true, 'log fiscal não pode ser alterado');
-- Cross-tenant
do $$ begin begin insert into public.produto_fiscal (produto_id, loja_id, ncm, origem_ncm) values ('bbbbbbbb-1111-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','84099190','manual'); raise exception 'passou';
  exception when foreign_key_violation then null; end; end $$;
select public.afirma(true, 'fiscal de produto de outra loja é recusado');

-- Validar o primeiro para testar o público
update public.produto_fiscal set status='validado', validado_por='Contador X', validado_em=now() where produto_id='aaaaaaaa-1111-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.produto_fiscal) = 2, 'lojista A vê o fiscal da própria loja');
reset role; set local role anon;
select public.afirma((select count(*) from public.produto_fiscal) = 1, 'público vê só fiscal validado');
do $$ begin begin perform justificativa from public.produto_fiscal; raise exception 'vazou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'público lê só NCM e CEST, sem regra nem justificativa');
rollback;
