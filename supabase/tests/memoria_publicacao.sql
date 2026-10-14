begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, publicado) values
  ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','1','COF-1','Amortecedor Cofap HR',100,false),
  ('bbbbbbbb-1111-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','1','B-1','Outro',10,false);

select public.afirma((select count(*) from public.taxonomia_nos where perfil_ramo='autopecas') > 40, 'taxonomia inicial de autopeças carregada');
select public.afirma((select count(*) from public.taxonomia_nos where status='aprovado') = 0, 'taxonomia nasce como proposta (nada aprovado sozinho)');

-- Portão de publicação
select public.afirma((public.publicar_produto('aaaaaaaa-1111-0000-0000-000000000001', true)->>'ok')::boolean = false, 'produto incompleto não publica');
select public.afirma(jsonb_array_length(public.publicar_produto('aaaaaaaa-1111-0000-0000-000000000001', true)->'faltando') = 4, 'informa o que falta (categoria, imagem, marca da peça, código do fabricante)') ;
update public.taxonomia_nos set status='aprovado' where slug='amortecedores';
update public.produtos set taxonomia_no_id=(select id from public.taxonomia_nos where slug='amortecedores') where sku='COF-1';
insert into public.marcas (id, loja_id, nome, tipo, status) values ('aaaaaaaa-2222-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Cofap','peca','aprovado');
insert into public.produto_codigos (loja_id, produto_id, tipo, valor, marca_id, status, fonte, coletado_em) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','fabricante','GP-123','aaaaaaaa-2222-0000-0000-000000000001','aprovado','catalogo',now());
insert into public.produto_imagens (produto_id, loja_id, url, tipo, principal, aprovada, origem) values
  ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','u','real',true,true,'bling');
select public.afirma((public.publicar_produto('aaaaaaaa-1111-0000-0000-000000000001', true, '11111111-1111-1111-1111-111111111111')->>'ok')::boolean, 'produto completo publica');
select public.afirma((select publicado from public.produtos where sku='COF-1'), 'flag publicado ligada');
select public.afirma((select count(*) from public.auditoria where acao='publicar' and tabela='produtos') = 1, 'publicação auditada');
select public.publicar_produto('aaaaaaaa-1111-0000-0000-000000000001', false);
select public.afirma(not (select publicado from public.produtos where sku='COF-1'), 'despublicar funciona sempre');

-- Vínculo webhook
update public.bling_conexoes set bling_company_id='1144593227' where false;
insert into public.bling_conexoes (loja_id, bling_company_id) values ('aaaaaaaa-0000-0000-0000-000000000001','777');
select public.afirma(public.loja_por_bling_company('777') = 'aaaaaaaa-0000-0000-0000-000000000001', 'companyId do Bling resolve a loja');
select public.afirma(public.loja_por_bling_company('999') is null, 'companyId desconhecido não resolve');

-- Clone de equivalente (Cofap -> Axon): rascunho, compatibilidade a confirmar
insert into public.produto_aplicacoes (loja_id, produto_id, modelo, ano_inicial, ano_final, status, fonte, coletado_em) values
  ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','HR',2008,2012,'aprovado','catalogo',now());
select public.clonar_para_entrada('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','AXO-1','Amortecedor Axon HR',null,'k1');
select public.afirma((select count(*) from public.entradas_cadastro) = 1, 'clone gera uma entrada em rascunho');
select public.clonar_para_entrada('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','AXO-1','Amortecedor Axon HR',null,'k1');
select public.afirma((select count(*) from public.entradas_cadastro) = 1, 'clone é idempotente pela chave');
select public.afirma((select proposta->'aplicacoes'->0->>'status' from public.entradas_cadastro) = 'a_confirmar', 'compatibilidade copiada nasce a confirmar');
select public.afirma((select (proposta->>'sku') from public.entradas_cadastro) = 'AXO-1', 'clone muda só nome/SKU/marca');
do $$ begin begin perform public.clonar_para_entrada('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','COF-1','x',null,'k2'); raise exception 'dup';
  exception when raise_exception then if sqlerrm='dup' then raise; end if; end; end $$;
select public.afirma(true, 'SKU repetido é recusado');
do $$ begin begin perform public.clonar_para_entrada('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-1111-0000-0000-000000000002','X-1','x',null,'k3'); raise exception 'vazou';
  exception when raise_exception then if sqlerrm='vazou' then raise; end if; end; end $$;
select public.afirma(true, 'não clona produto de outra loja');

-- Equivalência entre lojas diferentes é recusada
do $$ begin begin insert into public.produto_equivalencias (loja_id, produto_id, equivalente_id, tipo)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','bbbbbbbb-1111-0000-0000-000000000002','similar'); raise exception 'passou';
  exception when foreign_key_violation then null; end; end $$;
select public.afirma(true, 'equivalência entre lojas diferentes é recusada');

-- NF-e: dado fiscal só segue ao Bling após validação do contador
do $$ begin begin insert into public.entradas_cadastro (loja_id, origem, chave_idempotencia, dados_nfe, status, aprovado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','nfe','nfe-1','{"ncm":"84099190"}','enviada_bling',now()); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'NF-e sem validação do contador não vai ao Bling');

-- Acessos
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
do $$ begin begin perform public.publicar_produto('aaaaaaaa-1111-0000-0000-000000000001', true); raise exception 'executou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista não executa publicação direto (só o servidor)');
reset role; set local role anon;
select public.afirma((select count(*) from public.taxonomia_nos where status='aprovado') >= 1, 'público lê só taxonomia aprovada');
select public.afirma((select count(*) from public.taxonomia_nos where status<>'aprovado') = 0, 'público não vê taxonomia proposta');
rollback;
