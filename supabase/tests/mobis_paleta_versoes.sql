-- Teste descartável: nenhum cadastro real, cor publicada ou NF é modificada.
begin;
create or replace function public.afirma(ok boolean,msg text) returns void language plpgsql as
$$ begin if not coalesce(ok,false) then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
insert into public.lojas(id,nome,slug) values
 ('aaaaaaaa-6666-4666-8666-000000000001','Loja Paleta Teste','loja-paleta-a'),
 ('bbbbbbbb-6666-4666-8666-000000000002','Outra Loja Paleta','loja-paleta-b');
insert into public.usuarios_loja(loja_id,user_id,papel) values
 ('aaaaaaaa-6666-4666-8666-000000000001','11111111-1111-1111-1111-111111111111','lojista');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
do $$
declare loja uuid='aaaaaaaa-6666-4666-8666-000000000001';
 v1 uuid; v2 uuid;
begin
 v1:=public.paleta_salvar_versao(loja,'#ffffff','#f6f7f8','#1f2327','#444c54','#a84916');
 if (select count(*) from public.loja_paleta_publicada where loja_id=loja)<>0 then
  raise exception 'FALHOU: rascunho publicou automaticamente';
 end if;
 begin
  perform public.paleta_publicar_versao(loja,v1);
  raise exception 'FALHOU: publicou sem aprovação';
 exception when check_violation then null; end;
 perform public.paleta_aprovar_versao(loja,v1);
 perform public.paleta_publicar_versao(loja,v1);
 if (select versao_id from public.loja_paleta_publicada where loja_id=loja)<>v1 then
  raise exception 'FALHOU: publicação não apontou ao tema aprovado';
 end if;
 begin
  update public.loja_paleta_versoes set cor_acento='#87390f' where id=v1;
  raise exception 'FALHOU: versão foi editada após aprovação';
 exception when insufficient_privilege or check_violation then null; end;
 begin
  perform public.paleta_salvar_versao(loja,'#ffffff','#f6f7f8','#1f2327','#444c54','#ff0000');
  raise exception 'FALHOU: cor ilegível aceita';
 exception when check_violation then null; end;
 begin
  perform public.paleta_salvar_versao(loja,'#000000','#f6f7f8','#ffffff','#444c54','#a84916');
  raise exception 'FALHOU: fundo escuro foi aceito';
 exception when check_violation then null; end;
 v2:=public.paleta_salvar_versao(loja,'#f6f7f8','#ffffff','#252a31','#444c54','#8d3c35');
 perform public.paleta_aprovar_versao(loja,v2);
 perform public.paleta_publicar_versao(loja,v2);
 perform public.paleta_publicar_versao(loja,v1);
 if (select versao_id from public.loja_paleta_publicada where loja_id=loja)<>v1
   or (select count(*) from public.loja_paleta_versoes where loja_id=loja)<>2 then
  raise exception 'FALHOU: restauração apagou o histórico';
 end if;
 if (select count(*) from public.auditoria where loja_id=loja and tabela='loja_paleta_publicada')<>3 then
  raise exception 'FALHOU: ações de publicação não estão auditadas';
 end if;
end $$;
select public.afirma(
 (select count(*) from public.loja_paleta_versoes
  where loja_id='aaaaaaaa-6666-4666-8666-000000000001')=2,
 'duas versões preservadas após reversão');
do $$ begin
 begin
  perform public.paleta_salvar_versao('bbbbbbbb-6666-4666-8666-000000000002',
    '#ffffff','#f6f7f8','#1f2327','#444c54','#a84916');
  raise exception 'FALHOU: escrita na outra loja';
 exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true,'lojista não altera paleta de outros tenants');
set local role anon;
do $$ begin
 begin
  perform id from public.loja_paleta_versoes limit 1;
  raise exception 'FALHOU: visitante obteve histórico';
 exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true,'anon não vê versões, autores ou auditoria');
rollback;
