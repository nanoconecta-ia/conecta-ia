begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');

select public.afirma((select ambiente from public.lojas where slug='loja-a') = 'teste', 'loja nasce em teste');
do $$ begin begin update public.lojas set ambiente='producao' where slug='loja-a'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'produção sem política e domínio verificado é recusada');
insert into public.loja_politicas (loja_id, razao_social, cnpj, endereco, telefone, garantia_texto, troca_devolucao_texto, entrega_texto, privacidade_texto, status, revisado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','A Ltda','00000000000191','R','1','g','t','e','p','aprovada',now());
do $$ begin begin update public.lojas set ambiente='producao' where slug='loja-a'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'produção sem DNS/SSL verificados é recusada');
insert into public.loja_dominios (loja_id, dominio, dns_verificado_em, ssl_verificado_em) values ('aaaaaaaa-0000-0000-0000-000000000001','a.test',now(),now());
update public.lojas set ambiente='producao' where slug='loja-a';
select public.afirma((select ambiente from public.lojas where slug='loja-a') = 'producao', 'produção liberada com política aprovada + DNS + SSL');
select public.afirma((select count(*) from public.auditoria where tabela='lojas' and acao='update') >= 1, 'mudança de ambiente é auditada');

select public.afirma((select count(*) from public.recursos_plataforma where grupo <> 'assistente') = 10, 'recursos da plataforma carregados');
select public.afirma((select count(*) from public.ajuda_topicos where status='aprovado') = 0, 'ajuda nasce como rascunho (agente não ensina sem aprovação)');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.recursos_efetivos where loja_id='aaaaaaaa-0000-0000-0000-000000000001') = (select count(*) from public.recursos_plataforma), 'lojista A vê os recursos só da própria loja');
select public.afirma((select ativo from public.recursos_efetivos where codigo='catalogo'), 'catálogo ativo por padrão');
select public.afirma(not (select ativo from public.recursos_efetivos where codigo='pagamentos'), 'pagamentos fica desligado (em breve)');
insert into public.loja_recursos (loja_id, recurso, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','pagamentos', true);
select public.afirma(not (select ativo from public.recursos_efetivos where codigo='pagamentos'), 'não dá para ligar recurso indisponível');
insert into public.loja_recursos (loja_id, recurso, ativo) values ('aaaaaaaa-0000-0000-0000-000000000001','bling', false);
select public.afirma(not (select ativo from public.recursos_efetivos where codigo='bling'), 'lojista desliga recurso disponível');
do $$ begin begin insert into public.loja_recursos (loja_id, recurso, ativo) values ('bbbbbbbb-0000-0000-0000-000000000002','bling', false); raise exception 'passou';
  exception when insufficient_privilege or check_violation or others then if sqlerrm='passou' then raise; end if; end; end $$;
select public.afirma(true, 'lojista A não mexe nos recursos da loja B');
select public.afirma((select count(*) from public.ajuda_topicos) = 0, 'lojista não lê tópico de ajuda em rascunho');
reset role;
rollback;
