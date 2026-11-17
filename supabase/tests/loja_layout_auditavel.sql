-- Teste transacional em PostgreSQL descartável; nunca escreve no Supabase real.
begin;
create or replace function public.afirma(ok boolean,msg text) returns void language plpgsql as
$$ begin if not coalesce(ok,false) then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
insert into public.lojas(id,nome,slug) values
 ('aaaaaaaa-5555-4555-8555-000000000001','Mobis Layout Teste','mobis-layout-teste'),
 ('bbbbbbbb-5555-4555-8555-000000000002','Outra Loja Layout','outra-loja-layout');
insert into public.usuarios_loja(loja_id,user_id,papel) values
 ('aaaaaaaa-5555-4555-8555-000000000001','11111111-1111-1111-1111-111111111111','lojista');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
do $$
declare loja uuid='aaaaaaaa-5555-4555-8555-000000000001';
 v1 uuid; v2 uuid; todos text[]=array['banner','montadoras','taxonomia','catalogo','empresa']::text[];
begin
 v1:=public.layout_salvar_versao(loja,todos,6);
 if (select count(*) from public.loja_layout_publicado where loja_id=loja)<>0 then
   raise exception 'FALHOU: salvar rascunho publicou sem aprovação';
 end if;
 perform public.layout_aprovar_versao(loja,v1);
 perform public.layout_publicar_versao(loja,v1);
 if (select versao_id from public.loja_layout_publicado where loja_id=loja)<>v1 then
   raise exception 'FALHOU: publicação não aponta para a versão aprovada';
 end if;
 begin
   update public.loja_layout_versoes set blocos=array['catalogo','banner','montadoras','taxonomia','empresa']::text[]
   where id=v1;
   raise exception 'FALHOU: versão aprovada foi alterada';
 exception when check_violation then null; end;
 begin
   delete from public.loja_layout_versoes where id=v1;
   raise exception 'FALHOU: versão histórica foi apagada';
 exception when insufficient_privilege or check_violation then null; end;
 begin
   v2:=public.layout_salvar_versao(loja,array['banner','banner','taxonomia','catalogo','empresa']::text[],6);
   raise exception 'FALHOU: bloco duplicado foi aceito';
 exception when check_violation then null; end;
 begin
   v2:=public.layout_salvar_versao(loja,todos,20);
   raise exception 'FALHOU: intervalo inseguro foi aceito';
 exception when check_violation then null; end;
 v2:=public.layout_salvar_versao(loja,array['catalogo','banner','montadoras','taxonomia','empresa']::text[],5);
 begin
   perform public.layout_publicar_versao(loja,v2);
   raise exception 'FALHOU: publicou versão ainda não aprovada';
 exception when check_violation then null; end;
 perform public.layout_aprovar_versao(loja,v2);
 perform public.layout_publicar_versao(loja,v2);
 -- O rollback é só mover o ponteiro para uma versão antiga já aprovada.
 perform public.layout_publicar_versao(loja,v1);
 if (select versao_id from public.loja_layout_publicado where loja_id=loja)<>v1
    or (select count(*) from public.loja_layout_versoes where loja_id=loja)<>2 then
   raise exception 'FALHOU: restauração apagou o histórico';
 end if;
 if (select count(*) from public.auditoria where loja_id=loja and tabela='loja_layout_publicado')<>3 then
   raise exception 'FALHOU: publicações não foram auditadas';
 end if;
end $$;
select public.afirma(
 (select count(*) from public.loja_layout_versoes where loja_id='aaaaaaaa-5555-4555-8555-000000000001')=2,
 'duas versões preservadas após reversão');
do $$ begin
 begin
   perform public.layout_salvar_versao('bbbbbbbb-5555-4555-8555-000000000002',
     array['banner','montadoras','taxonomia','catalogo','empresa'],6);
   raise exception 'FALHOU: acesso cruzado entre lojas';
 exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true,'outro tenant não pode salvar nem aprovar versões');
set local role anon;
do $$ begin
 begin
   perform id from public.loja_layout_versoes limit 1;
   raise exception 'FALHOU: anônimo leu o histórico';
 exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true,'visitantes não leem autores, versões ou auditoria');
rollback;
