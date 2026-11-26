-- MINUTA CI descartável. Recibo histórico por identidade original; sem reexecução.
begin;
create or replace function nano_lifecycle_interno.nano_lifecycle_recibo_engenharia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare e nano_lifecycle_interno.resultados_engenharia;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 select * into e from nano_lifecycle_interno.resultados_engenharia where loja_id=p_loja and item_id=p_item and execucao=p_execucao and geracao=p_geracao and versao=p_versao and not exists(select 1 from nano_lifecycle_interno.autorias_engenharia a where a.loja_id=p_loja and a.item_id=p_item and a.geracao=p_geracao);
 if not found then return jsonb_build_object('estado','recibo_inexistente'); end if;
 if e.homologada or e.hash_entrada is distinct from encode(sha256(convert_to(e.entrada_snapshot::text,'UTF8')),'hex') or e.hash_extracao is distinct from encode(sha256(convert_to(e.extracao_candidata::text,'UTF8')),'hex') then return jsonb_build_object('estado','integridade_divergente'); end if;
 return jsonb_build_object('estado','recuperado','loja_id',e.loja_id,'item_id',e.item_id,'execucao',e.execucao,'geracao',e.geracao,'versao',e.versao,'hash_entrada',e.hash_entrada,'hash_extracao',e.hash_extracao,'homologada',false);
end $fn$;
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
create function nano_lifecycle_interno.nano_lifecycle_recibo_produtor(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare e nano_lifecycle_interno.resultados_engenharia; a nano_lifecycle_interno.autorias_engenharia;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if not nano_lifecycle_interno.produtor_autorizado(p_loja) then return jsonb_build_object('estado','produtor_nao_autorizado'); end if;
 select * into a from nano_lifecycle_interno.autorias_engenharia where loja_id=p_loja and item_id=p_item and geracao=p_geracao and execucao=p_execucao and versao=p_versao and produtor=session_user;
 if not found then return jsonb_build_object('estado','recibo_inexistente'); end if;
 select * into e from nano_lifecycle_interno.resultados_engenharia where loja_id=p_loja and item_id=p_item and geracao=p_geracao and execucao=p_execucao and versao=p_versao;
 if not found or e.homologada or e.hash_entrada is distinct from a.hash_entrada or e.hash_extracao is distinct from a.hash_extracao or e.hash_entrada is distinct from encode(sha256(convert_to(e.entrada_snapshot::text,'UTF8')),'hex') or e.hash_extracao is distinct from encode(sha256(convert_to(e.extracao_candidata::text,'UTF8')),'hex') then return jsonb_build_object('estado','integridade_divergente'); end if;
 return jsonb_build_object('estado','recuperado','loja_id',e.loja_id,'item_id',e.item_id,'execucao',e.execucao,'geracao',e.geracao,'versao',e.versao,'hash_entrada',e.hash_entrada,'hash_extracao',e.hash_extracao,'homologada',false);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_recibo_produtor(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_recibo_produtor(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role,nano_lifecycle_auditoria,nano_lifecycle_produtor;
grant execute on function nano_lifecycle_interno.nano_lifecycle_recibo_produtor(uuid,uuid,uuid,bigint,integer) to nano_lifecycle_produtor;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
commit;
