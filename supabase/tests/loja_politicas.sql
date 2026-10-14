begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');

do $$ begin begin insert into public.loja_politicas (loja_id, status) values ('aaaaaaaa-0000-0000-0000-000000000001','aprovada'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'política aprovada sem dados e revisão é recusada');
do $$ begin begin insert into public.loja_politicas (loja_id, cnpj) values ('aaaaaaaa-0000-0000-0000-000000000001','12.345'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'CNPJ com formato inválido é recusado');
do $$ begin begin insert into public.loja_politicas (loja_id, garantia_legal_dias) values ('aaaaaaaa-0000-0000-0000-000000000001', 10); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'garantia legal abaixo de 30 dias é recusada');
insert into public.loja_politicas (loja_id, razao_social, cnpj, endereco, telefone, garantia_texto, troca_devolucao_texto, entrega_texto, privacidade_texto, status, revisado_por, revisado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','Loja A Ltda','00000000000191','Rua X','62999999999','g','t','e','p','aprovada','Adv. Fulano', now());
insert into public.loja_politicas (loja_id, razao_social) values ('bbbbbbbb-0000-0000-0000-000000000002','Loja B Ltda');
select public.afirma((select garantia_legal_dias from public.loja_politicas where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = 90, 'garantia legal padrão 90 dias');
select public.afirma((select count(*) from public.auditoria where tabela='loja_politicas') = 2, 'alterações de política são auditadas');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.loja_politicas) = 1, 'lojista A vê só a política da própria loja');
update public.loja_politicas set telefone='62988888888';
select public.afirma((select telefone from public.loja_politicas) = '62988888888', 'lojista edita a política da própria loja');
do $$ begin begin insert into public.loja_politicas (loja_id) values ('bbbbbbbb-0000-0000-0000-000000000002'); raise exception 'passou';
  exception when insufficient_privilege or unique_violation then null; end; end $$;
select public.afirma(true, 'lojista A não grava na loja B');

reset role; set local role anon;
select public.afirma((select count(*) from public.loja_politicas) = 1, 'público vê só política aprovada');
do $$ begin begin perform revisado_por from public.loja_politicas; raise exception 'vazou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'público não lê quem revisou');
rollback;
