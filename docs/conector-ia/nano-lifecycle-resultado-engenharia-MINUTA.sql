-- MINUTA exclusiva do CI descartável. Evidência candidata, não transição.
begin;
create table nano_lifecycle_interno.resultados_engenharia (
 loja_id uuid not null, item_id uuid not null, execucao uuid not null,
 geracao bigint not null check(geracao>0), versao integer not null check(versao>0),
 revisao text not null, checkpoint text not null, produto_id uuid not null,
 entrada_snapshot jsonb not null, extracao_candidata jsonb not null,
 hash_entrada text not null, hash_extracao text not null,
 extrator text not null check(extrator='extracao_v1'),
 homologada boolean not null default false check(not homologada),
 criado_em timestamptz not null default clock_timestamp(),
 primary key(loja_id,item_id,geracao)
);
-- Sem FK em cascata: evidência histórica não desaparece junto à fila.
alter table nano_lifecycle_interno.resultados_engenharia enable row level security;
revoke all on nano_lifecycle_interno.resultados_engenharia from public,anon,authenticated,service_role,nano_lifecycle_consumidor;
grant select,insert on nano_lifecycle_interno.resultados_engenharia to nano_lifecycle_consumidor;
create policy nano_resultado_ler on nano_lifecycle_interno.resultados_engenharia for select to nano_lifecycle_consumidor using(loja_id::text=current_setting('nano.consumer_loja',true));
create policy nano_resultado_gravar on nano_lifecycle_interno.resultados_engenharia for insert to nano_lifecycle_consumidor with check(loja_id::text=current_setting('nano.consumer_loja',true));
create policy nano_resultado_escopo on nano_lifecycle_interno.resultados_engenharia as restrictive for all to nano_lifecycle_consumidor using(loja_id::text=current_setting('nano.consumer_loja',true)) with check(loja_id::text=current_setting('nano.consumer_loja',true));
grant execute on function public.nano_lifecycle_entrada_tecnica(uuid,uuid,uuid,bigint,integer) to nano_lifecycle_consumidor;
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
create function nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_entrada jsonb,p_extracao jsonb)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare e jsonb; anterior nano_lifecycle_interno.resultados_engenharia; he text; hr text;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 -- Reutiliza os locks e a revalidação de identidade, pausa, snapshot e lease.
 e:=public.nano_lifecycle_entrada_tecnica(p_loja,p_item,p_execucao,p_geracao,p_versao);
 if e->>'estado' is distinct from 'preparada' then return jsonb_build_object('estado',coalesce(e->>'estado','reserva_invalida')); end if;
 if e is distinct from p_entrada then return jsonb_build_object('estado','snapshot_divergente'); end if;
 if jsonb_typeof(p_extracao) is distinct from 'object' then return jsonb_build_object('estado','extracao_invalida'); end if;
 -- Envelope estrito; os candidatos não constituem prova de compatibilidade.
 if octet_length(p_extracao::text)>262144 or not (p_extracao ?& array['sku','codigos_oem','marca_fabricante','gtin','aplicacao','nao_se_aplica','excluido','texto_fonte'])
 or p_extracao-array['sku','codigos_oem','marca_fabricante','gtin','aplicacao','nao_se_aplica','excluido','texto_fonte']<>'{}'::jsonb
 or p_extracao->>'sku' is distinct from e->'produto'->>'sku'
 or jsonb_typeof(p_extracao->'codigos_oem') is distinct from 'array'
 or jsonb_typeof(p_extracao->'aplicacao') is distinct from 'object'
 or jsonb_typeof(p_extracao->'excluido') is distinct from 'object'
 or jsonb_typeof(p_extracao->'texto_fonte') is distinct from 'string'
 then return jsonb_build_object('estado','extracao_invalida'); end if;
 he:=encode(sha256(convert_to(e::text,'UTF8')),'hex');
 hr:=encode(sha256(convert_to(p_extracao::text,'UTF8')),'hex');
 -- Confirma lease ainda válido imediatamente antes da gravação.
 if not exists(select 1 from public.pipeline_itens where loja_id=p_loja and id=p_item and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and reservado_ate>clock_timestamp()) then return jsonb_build_object('estado','reserva_invalida'); end if;
 select * into anterior from nano_lifecycle_interno.resultados_engenharia where loja_id=p_loja and item_id=p_item and geracao=p_geracao;
 if found then
  if anterior.execucao is distinct from p_execucao or anterior.versao is distinct from p_versao or anterior.entrada_snapshot is distinct from e or anterior.extracao_candidata is distinct from p_extracao then return jsonb_build_object('estado','resultado_divergente'); end if;
  return jsonb_build_object('estado','ja_gravado','hash_entrada',he,'hash_extracao',hr,'homologada',false);
 end if;
 insert into nano_lifecycle_interno.resultados_engenharia(loja_id,item_id,execucao,geracao,versao,revisao,checkpoint,produto_id,entrada_snapshot,extracao_candidata,hash_entrada,hash_extracao,extrator)
 values(p_loja,p_item,p_execucao,p_geracao,p_versao,e->>'revisao',e->>'checkpoint',(e->'produto'->>'id')::uuid,e,p_extracao,he,hr,'extracao_v1');
 return jsonb_build_object('estado','gravado','hash_entrada',he,'hash_extracao',hr,'homologada',false);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) to service_role;
create function public.nano_lifecycle_persistir_engenharia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_entrada jsonb,p_extracao jsonb)
returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_persistir_engenharia(p_loja,p_item,p_execucao,p_geracao,p_versao,p_entrada,p_extracao)
$fn$;
revoke all on function public.nano_lifecycle_persistir_engenharia(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_persistir_engenharia(uuid,uuid,uuid,bigint,integer,jsonb,jsonb) to service_role;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
commit;
