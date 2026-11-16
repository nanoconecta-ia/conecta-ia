-- Ordem 16A — executar EXCLUSIVAMENTE no Postgres descartável:
-- supabase/tests/rodar_local.sh tests/nano_pacote_cadastro_estrutura.sql
-- NUNCA rodar como teste de escrita contra o banco da MOBIS.
begin;

create or replace function public.afirma(ok boolean, msg text)
returns void language plpgsql as $$
begin
 if not coalesce(ok,false) then raise exception 'FALHOU: %', msg; end if;
 raise notice 'ok: %', msg;
end $$;

create function public.n16a_deve_falhar(p_sql text, p_motivo text)
returns void language plpgsql as $$
begin
 execute p_sql;
 raise exception 'FALHOU: % deveria ter sido recusado',p_motivo;
exception when others then
 if sqlerrm like 'FALHOU:%' then raise; end if;
 raise notice 'ok: % (recusado com SQLSTATE %)',p_motivo,sqlstate;
end $$;

-- Fixtures inventadas, em transação integralmente revertida.
insert into public.lojas(id,nome,slug) values
('ba000000-0000-0000-0000-000000000001','N16A Loja de teste A','n16a-loja-a'),
('ba000000-0000-0000-0000-000000000002','N16A Loja de teste B','n16a-loja-b');
insert into public.usuarios_loja(loja_id,user_id,papel) values
('ba000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','lojista'),
('ba000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000002','lojista'),
('ba000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000003','editor');
insert into public.produtos(id,loja_id,bling_id,sku,nome) values
('da000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','16275882008',null,'OC1224 TESTE SEM SKU'),
('da000000-0000-0000-0000-000000000002','ba000000-0000-0000-0000-000000000002','800800800','ABC000','FILTRO TESTE LOJA B');

insert into public.agente_propostas(id,loja_id,solicitante_user,titulo) values
('ea000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','Revisão N16A do filtro OC1224'),
('ea000000-0000-0000-0000-000000000002','ba000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000002','Revisão N16A de outra loja'),
('ea000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','Outra proposta N16A da mesma loja');

insert into public.pacote_cadastro(
 id,loja_id,produto_id,bling_id,sku_espelho,idempotency_key,
 payload_hash,snapshot_espelho,snapshot_hash,agente
) values
('fa000000-0000-0000-0000-000000000001',
 'ba000000-0000-0000-0000-000000000001',
 'da000000-0000-0000-0000-000000000001',
 '16275882008',null,'n16a-pacote-oc1224',
 repeat('a',64), jsonb_build_object('bling_id','16275882008','sku',null,'gtin','7894766669907','marca',null),
 repeat('b',64),'Nano v1'),
('fa000000-0000-0000-0000-000000000002',
 'ba000000-0000-0000-0000-000000000002',
 'da000000-0000-0000-0000-000000000002',
 '800800800','ABC000','n16a-pacote-loja-b',
 repeat('c',64),jsonb_build_object('bling_id','800800800','sku','ABC000'),
 repeat('d',64),'Nano v1');

select public.afirma(
 (select sku_espelho is null from public.pacote_cadastro where id='fa000000-0000-0000-0000-000000000001'),
 'SKU nulo é válido e ID do Bling é preservado');
select public.afirma(
 (select count(*) from public.pacote_cadastro)=2,
 'dois produtos físicos de duas lojas, sem clones');

-- Testa chave do pacote, inclusive hash diferente (essa PR NÃO implementa RPC idempotente).
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_cadastro(loja_id,produto_id,bling_id,sku_espelho,idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,agente)
 values('ba000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000001','16275882008',null,'n16a-pacote-oc1224',repeat('f',64),
 jsonb_build_object('bling_id','16275882008','sku',null),repeat('b',64),'N16A')$sql$,
 'UNIQUE(loja_id,idempotency_key) impede duplicar pacote com hash divergente');
select public.afirma(
 (select count(*) from public.pacote_cadastro where idempotency_key='n16a-pacote-oc1224')=1,
 'nenhum pacote original foi sobrescrito');

select public.n16a_deve_falhar(
 $sql$insert into public.pacote_cadastro(loja_id,produto_id,bling_id,sku_espelho,idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,agente)
 values('ba000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000002','800800800','ABC000','n16a-produto-outra-loja',repeat('f',64),
 jsonb_build_object('bling_id','800800800','sku','ABC000'),repeat('b',64),'N16A')$sql$,
 'produto de outra loja não pode compor pacote A');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_cadastro(loja_id,produto_id,bling_id,sku_espelho,idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,agente)
 values('ba000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000001','NAO-EXISTE',null,'n16a-bling-falso',repeat('f',64),
 jsonb_build_object('bling_id','NAO-EXISTE','sku',null),repeat('b',64),'N16A')$sql$,
 'ID do Bling divergente é recusado');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_cadastro(loja_id,produto_id,bling_id,sku_espelho,idempotency_key,payload_hash,snapshot_espelho,snapshot_hash,agente)
 values('ba000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000001','16275882008','OC1224','n16a-sku-inventado',repeat('f',64),
 jsonb_build_object('bling_id','16275882008','sku','OC1224'),repeat('b',64),'N16A')$sql$,
 'SKU inventado não substitui o campo vazio no Bling');
select public.n16a_deve_falhar(
 $sql$update public.pacote_cadastro set payload_hash=repeat('0',64)
 where id='fa000000-0000-0000-0000-000000000001'$sql$,
 'hash do pacote não pode mudar depois da captura');

update public.pacote_cadastro
set proposta_id='ea000000-0000-0000-0000-000000000001',estado='pendente_revisao'
where id='fa000000-0000-0000-0000-000000000001';
select public.afirma(
 (select estado='pendente_revisao' and proposta_id is not null
 from public.pacote_cadastro where id='fa000000-0000-0000-0000-000000000001'),
 'pacote pronto para revisão exige vínculo com proposta-pai existente');
select public.n16a_deve_falhar(
 $sql$update public.pacote_cadastro set proposta_id='ea000000-0000-0000-0000-000000000002'
 where id='fa000000-0000-0000-0000-000000000001'$sql$,
 'proposta de outra loja não pode ser ligada ao pacote A');

insert into public.pacote_evidencias(
 id,loja_id,pacote_id,chave_evidencia,classe,url_publica,
 trecho,codigo_exato,consultado_em
) values
('aa000000-0000-0000-0000-000000000001',
 'ba000000-0000-0000-0000-000000000001',
 'fa000000-0000-0000-0000-000000000001',
 'mahle-doc','fabricante_oficial',
 'https://www.mahle-aftermarket.com/catalogo','MAHLE OC1224 Hyundai HR','OC1224',now()),
('aa000000-0000-0000-0000-000000000002',
 'ba000000-0000-0000-0000-000000000002',
 'fa000000-0000-0000-0000-000000000002',
 'outro-epc','epc_terceiro',
 'https://partsouq.com/catalogs/','OEM 9999999999','9999999999',now());

insert into public.pacote_evidencias(
 loja_id,pacote_id,chave_evidencia,classe,documento_ref_interno,consultado_em
) values (
 'ba000000-0000-0000-0000-000000000001',
 'fa000000-0000-0000-0000-000000000001',
 'foto-fisica','foto_estoque','arquivo:foto_estoque_001',now()
);
select public.afirma(
 (select count(*) from public.pacote_evidencias where pacote_id='fa000000-0000-0000-0000-000000000001')=2,
 'foto física sem URL pública aceita como referência opaca');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_evidencias(loja_id,pacote_id,chave_evidencia,classe,consultado_em)
 values('ba000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','sem-fonte','outra',now())$sql$,
 'evidência sem URL/documento é recusada');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_evidencias(loja_id,pacote_id,chave_evidencia,classe,url_publica,consultado_em)
 values('ba000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001','vin','epc_terceiro',
 'https://partsouq.com/catalog/?vin=ABCDEFGH123456789',now())$sql$,
 'URL com VIN identificado não entra no pacote');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_evidencias(loja_id,pacote_id,chave_evidencia,classe,url_publica,consultado_em)
 values('ba000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000002','outra-loja','outra',
 'https://www.example.com/fonte',now())$sql$,
 'evidência de loja A não pode apontar pacote B');

insert into public.agente_proposta_itens(
 id,loja_id,proposta_id,produto_id,ordem,operacao,depois,idempotency_key
) values
('ab000000-0000-0000-0000-000000000001',
 'ba000000-0000-0000-0000-000000000001',
 'ea000000-0000-0000-0000-000000000001',
 'da000000-0000-0000-0000-000000000001',0,'catalogo.propor','{}'::jsonb,
 'n16a-item-oc1224-0'),
('ab000000-0000-0000-0000-000000000002',
 'ba000000-0000-0000-0000-000000000001',
 'ea000000-0000-0000-0000-000000000003',
 'da000000-0000-0000-0000-000000000001',0,'catalogo.propor','{}'::jsonb,
 'n16a-item-oc1224-1');

insert into public.pacote_blocos(
 loja_id,pacote_id,tipo,chave_bloco,ordem,estado_fonte,valor_proposto,evidencia_chaves,item_proposta_id
) values (
 'ba000000-0000-0000-0000-000000000001',
 'fa000000-0000-0000-0000-000000000001',
 'aplicacao','hr-8v',0,'confirmado_por_fonte',
 '{"modelo":"HR","motor":"8V","estado":"a_confirmar"}'::jsonb,
 array['mahle-doc'],'ab000000-0000-0000-0000-000000000001'
);
select public.afirma(
 (select count(*) from public.pacote_blocos where pacote_id='fa000000-0000-0000-0000-000000000001')=1,
 'bloco foi vinculado à mesma peça, proposta e fonte');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_blocos(loja_id,pacote_id,tipo,chave_bloco,ordem,valor_proposto,evidencia_chaves)
 values('ba000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001',
 'aplicacao','hr-16v',1,'{}'::jsonb,array['outro-epc'])$sql$,
 'bloco não pode referenciar evidência de outro pacote');
select public.n16a_deve_falhar(
 $sql$insert into public.pacote_blocos(loja_id,pacote_id,tipo,chave_bloco,ordem,valor_proposto,evidencia_chaves,item_proposta_id)
 values('ba000000-0000-0000-0000-000000000001','fa000000-0000-0000-0000-000000000001',
 'aplicacao','outro-item',2,'{}'::jsonb,array['mahle-doc'],
 'ab000000-0000-0000-0000-000000000002')$sql$,
 'item de outra proposta na mesma loja não pode compor este pacote');
select public.n16a_deve_falhar(
 $sql$update public.pacote_evidencias set trecho='ALTERADO' where id='aa000000-0000-0000-0000-000000000001'$sql$,
 'fonte documental não pode ser reescrita sem versionamento');

-- Estados administrativos não aprovam OEM nem permitem escrita no Bling.
select public.afirma(
 not exists(select 1 from pg_policies where tablename like 'pacote_%' and cmd in ('INSERT','UPDATE','DELETE','ALL')),
 'nenhuma política permite escrita direta ao cliente');
select public.afirma(
 not has_table_privilege('anon','public.pacote_cadastro','select')
 and not has_table_privilege('anon','public.pacote_blocos','select')
 and not has_table_privilege('anon','public.pacote_evidencias','select'),
 'anon sem acesso às três tabelas');
select public.afirma(
 not has_table_privilege('authenticated','public.pacote_cadastro','insert')
 and not has_table_privilege('authenticated','public.pacote_blocos','update')
 and not has_table_privilege('authenticated','public.pacote_evidencias','delete'),
 'authenticated sem escrita direta');
select public.afirma(
 (select bool_and(relrowsecurity) from pg_class
  where oid in ('public.pacote_cadastro'::regclass,
                'public.pacote_blocos'::regclass,
                'public.pacote_evidencias'::regclass)),
 'RLS habilitado nas três tabelas');

-- Teste RLS com membro verdadeiro da loja A. Usuário de outra loja
-- não consegue ver a linha do outro tenant, mesmo com SELECT concedido.
set local role authenticated;
set local request.jwt.claims = '{"sub":"ca000000-0000-0000-0000-000000000001"}';
select public.afirma(
 (select count(*) from public.pacote_cadastro)=1
 and (select count(*) from public.pacote_evidencias)=2
 and (select count(*) from public.pacote_blocos)=1,
 'lojista A vê apenas seus pacotes, blocos e evidências');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"ca000000-0000-0000-0000-000000000002"}';
select public.afirma(
 (select count(*) from public.pacote_cadastro)=1
 and (select count(*) from public.pacote_evidencias)=1
 and (select count(*) from public.pacote_blocos)=0,
 'lojista B vê apenas sua loja');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ca000000-0000-0000-0000-000000000003"}';
select public.afirma(
 (select count(*) from public.pacote_cadastro)=0,
 'editor não ganha leitura administrativa das evidências de NF');
reset role;

-- ROLLBACK garante ZERO dados de teste persistidos.
rollback;
