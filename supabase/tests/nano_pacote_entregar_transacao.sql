-- Exclusivamente PostgreSQL descartável: as migrações rodam com os testes
-- em supabase/tests/rodar_local.sh. Nenhuma escrita no projeto ativo.
begin;
create or replace function public.afirma(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'FALHOU: %',msg; end if;
  raise notice 'ok: %',msg;
end $$;
create function public.n16b_deve_falhar(p_sql text,p_motivo text,p_erro text default null)
returns void language plpgsql as $$
declare v_code text;
begin
  begin
    execute p_sql;
    raise exception 'FALHOU: % não foi recusado',p_motivo;
  exception when others then
    if sqlerrm like 'FALHOU:%' then raise; end if;
    v_code:=sqlstate;
    if p_erro is not null and v_code is distinct from p_erro
      then raise exception 'FALHOU: % SQLSTATE %, esperado %',p_motivo,v_code,p_erro; end if;
    raise notice 'ok: % (SQLSTATE %)',p_motivo,v_code;
  end;
end $$;

insert into public.lojas(id,nome,slug) values
 ('b6000000-0000-0000-0000-000000000001','Pacote Nano A','pacote-nano-b6-a'),
 ('b6000000-0000-0000-0000-000000000002','Pacote Nano B','pacote-nano-b6-b');
insert into public.usuarios_loja(loja_id,user_id,papel) values
 ('b6000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000001','lojista'),
 ('b6000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000003','editor'),
 ('b6000000-0000-0000-0000-000000000002','c6000000-0000-0000-0000-000000000002','lojista');
insert into public.produtos(id,loja_id,bling_id,sku,nome,gtin,marca)
values
 ('d6000000-0000-0000-0000-000000000001','b6000000-0000-0000-0000-000000000001',
 '16275882008',null,'OC1224 de teste sem SKU','7894766669907',null),
 ('d6000000-0000-0000-0000-000000000002','b6000000-0000-0000-0000-000000000002',
 '800900900','ABC000','Filtro da loja B','4006381333931','Marca B');

create temp table n16b_entrada (id integer primary key,payload jsonb);
insert into n16b_entrada values(1,
jsonb_build_object(
 'versao',1,'bling_id','16275882008','sku',null,
 'idempotency_key','n16b-oc1224-primeiro',
 'origem_agente',jsonb_build_object('agente','Nano.ia','modelo','modelo-teste'),
 'identidade',jsonb_build_object('marca',null,'codigo_fabricante','OC1224','gtin','7894766669907'),
 'evidencias',jsonb_build_array(
   jsonb_build_object('id','mahle-br','classe','fabricante_oficial',
     'url','https://www.mahle-aftermarket.com/catalogos/','documento',null,
     'trecho','Filtro de óleo OC1224 para Hyundai HR','codigo_exato','OC1224','consultado_em','2026-11-16')
 ),
 'aplicacoes',jsonb_build_array(
   jsonb_build_object('id','hyundai-hr-8v','montadora','Hyundai','modelo','HR',
   'motor','2.5 8V','estado','a_confirmar','evidencia_ids',jsonb_build_array('mahle-br'))
 ),
 'imagens','[]'::jsonb,
 'taxonomia',jsonb_build_object('no_id',null),
 'texto','{}'::jsonb,
 'logistica',jsonb_build_object('peso_kg',null,'dimensoes_cm',null)
));

create temp table n16b_resultado(resultado jsonb);
insert into n16b_resultado
select public.pacote_entregar(
 'b6000000-0000-0000-0000-000000000001',
 'c6000000-0000-0000-0000-000000000001',
 payload)
from n16b_entrada where id=1;

select public.afirma(
 (select resultado->>'ok'='true' and resultado->>'repetido'='false'
   and resultado->>'publicavel'='false' and resultado->>'altera_bling'='false'
   and resultado->>'proposta_estado'='rascunho' from n16b_resultado),
 'primeiro envio cria apenas rascunho com flags de não publicação e não execução');
select public.afirma(
 (select count(*)=1 from public.pacote_cadastro
    where loja_id='b6000000-0000-0000-0000-000000000001') and
 (select count(*)=1 from public.agente_propostas
    where loja_id='b6000000-0000-0000-0000-000000000001' and agente='Nano.ia'),
 'um pacote e uma proposta-pai criados juntos');
select public.afirma(
 (select count(*)=6 from public.pacote_blocos
   where loja_id='b6000000-0000-0000-0000-000000000001') and
 (select count(*)=6 from public.agente_proposta_itens
   where loja_id='b6000000-0000-0000-0000-000000000001'),
 'cinco seções base e uma aplicação recebem seis itens de revisão');
select public.afirma(
 (select count(*)=1 from public.pacote_evidencias
    where loja_id='b6000000-0000-0000-0000-000000000001'
      and verificacao='candidato' and not dominio_verificado),
 'afirmação de fabricante continua não verificada no servidor');
select public.afirma(
 (select count(*)=6 from public.agente_proposta_itens
   where loja_id='b6000000-0000-0000-0000-000000000001'
    and operacao='nano.pacote_conferir' and cardinality(campos)=0
    and fontes='[]'::jsonb and (depois->>'executavel')::boolean=false),
 'itens têm somente metadados e não podem ser enviados como ações executáveis');

create temp table n16b_repetido(resultado jsonb);
insert into n16b_repetido
select public.pacote_entregar(
 'b6000000-0000-0000-0000-000000000001',
 'c6000000-0000-0000-0000-000000000001',payload)
from n16b_entrada where id=1;
select public.afirma(
 (select a.resultado->>'pacote_id'=b.resultado->>'pacote_id'
   and a.resultado->>'proposta_id'=b.resultado->>'proposta_id'
   and b.resultado->>'repetido'='true'
  from n16b_resultado a cross join n16b_repetido b)
  and (select count(*)=1 from public.pacote_cadastro
    where loja_id='b6000000-0000-0000-0000-000000000001'),
 'mesma idempotency_key e mesmo hash retornam exatamente os IDs antigos');

select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(payload,'{identidade,marca}','"Inventada"'::jsonb)
    from n16b_entrada where id=1))$$,
 'repetição da chave com payload diferente retorna conflito','23505');
select public.afirma(
 (select count(*)=6 from public.agente_proposta_itens
   where loja_id='b6000000-0000-0000-0000-000000000001'),
 'conflito não deixou itens duplicados');

select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000003',
   (select payload from n16b_entrada where id=1))$$,
 'editor não tem privilégio de administrador','42501');
select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000002',
   (select payload from n16b_entrada where id=1))$$,
 'administrador de outra loja não pode entregar pacote A','42501');

-- Um bloco aponta para uma referência inexistente: a função terá criado
-- proposta, pacote e evidências, mas a falha final reverte TUDO.
select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-rollback-001"'::jsonb),
     '{aplicacoes,0,evidencia_ids}','["fonte-inexistente"]'::jsonb)
    from n16b_entrada where id=1))$$,
 'evidência inexistente dispara rollback completo','23503');
select public.afirma(
 (select count(*)=1 from public.pacote_cadastro where loja_id='b6000000-0000-0000-0000-000000000001')
 and (select count(*)=1 from public.agente_propostas where loja_id='b6000000-0000-0000-0000-000000000001'),
 'rollback deixa intactos pacote e proposta anteriores sem resíduos');

select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-fiscal-001"'::jsonb),
    '{ncm}','"84212300"'::jsonb)
    from n16b_entrada where id=1))$$,
 'NCM informado pelo agente bloqueado','22023');
select public.n16b_deve_falhar(
 $$select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-imagem-001"'::jsonb),
    '{imagens}','[{"url":"https://example.com/oc1224.png","aprovada":true}]'::jsonb)
    from n16b_entrada where id=1))$$,
 'IA não aprova imagem nem direitos','22023');
select public.n16b_deve_falhar(
 $select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-gtin-err-001"'::jsonb),
    '{identidade,gtin}','"7894766669900"'::jsonb)
    from n16b_entrada where id=1))$,
 'GTIN com dígito verificador errado é rejeitado no próprio banco','22023');
select public.n16b_deve_falhar(
 $select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-logistica-001"'::jsonb),
    '{logistica}','{"estimado":true,"peso_kg":0.68,"margem_percentual":15}'::jsonb)
    from n16b_entrada where id=1))$,
 'peso estimado sem base documental identificada é rejeitado','22023');

select public.n16b_deve_falhar(
 $select public.pacote_entregar('b6000000-0000-0000-0000-000000000001',
   'c6000000-0000-0000-0000-000000000001',
   (select jsonb_set(jsonb_set(payload,'{idempotency_key}','"n16b-sku-err-001"'::jsonb),
    '{sku}','"OC1224"'::jsonb)
    from n16b_entrada where id=1))$$,
 'SKU do agente não pode preencher campo ausente no Bling','22023');

select public.afirma(
 not has_function_privilege('anon','public.pacote_entregar(uuid,uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.pacote_entregar(uuid,uuid,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.pacote_entregar(uuid,uuid,jsonb)','EXECUTE'),
 'somente service_role pode executar a entrega de pacote');

-- Divergência de GTIN: mesmo código em dois IDs Bling => revisão manual,
-- sem juntar estoque, excluir produto, aprovar OEM ou criar item físico.
insert into public.produtos(id,loja_id,bling_id,sku,nome,gtin) values (
 'd6000000-0000-0000-0000-000000000003',
 'b6000000-0000-0000-0000-000000000001',
 '7240211589','OC1224','OUTRO CADASTRO DO MESMO GTIN','7894766669907');
create temp table n16b_divergente(resultado jsonb);
insert into n16b_divergente
select public.pacote_entregar(
 'b6000000-0000-0000-0000-000000000001',
 'c6000000-0000-0000-0000-000000000001',
 jsonb_set(payload,'{idempotency_key}','"n16b-duplo-gtin-001"'::jsonb))
from n16b_entrada where id=1;
select public.afirma(
 (select resultado->>'estado'='divergente'
   and jsonb_array_length(resultado->'pendencias')>=1 from n16b_divergente),
 'GTIN compartilhado por dois IDs Bling sinalizado como divergência, nunca mesclado');
select public.afirma(
 (select count(*)=3 from public.produtos where loja_id='b6000000-0000-0000-0000-000000000001')=false,
 'nenhum produto adicional foi criado pela transação (somente fixture)');
-- Esta fixture criou DOIS produtos A: o segundo é intencional e não foi
-- criado pela RPC; a contagem correta é 2.
select public.afirma(
 (select count(*)=2 from public.produtos where loja_id='b6000000-0000-0000-0000-000000000001'),
 'duas identidades físicas distintas foram preservadas após a análise de GTIN');

rollback;
