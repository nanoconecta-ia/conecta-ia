-- MINUTA exclusiva do CI descartável. Autoridade de lease, não de execução.
begin;
create role nano_lifecycle_consumidor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,nano_lifecycle_interno to nano_lifecycle_consumidor;
grant create on schema nano_lifecycle_interno to nano_lifecycle_consumidor;
grant select,update(atualizado_em) on public.nano_lifecycle_checkpoint to nano_lifecycle_consumidor;
grant select on public.nano_lifecycle_reserva,public.nano_lifecycle_capturas,public.nano_lifecycle_snapshots,public.produtos to nano_lifecycle_consumidor;
-- UPDATE de tabela é necessário para os locks SHARE / SHARE ROW EXCLUSIVE
-- do encaminhamento já homologado. RLS e trigger limitam alterações reais.
grant select,update on public.pipeline_itens,public.produto_automacao to nano_lifecycle_consumidor;
grant execute on function public.nano_lifecycle_encaminhar(uuid,text,text),public.nano_lifecycle_projecao(uuid),public.pipeline_orcamento_estado(uuid),public.pipeline_criar(uuid,text,uuid,jsonb,text) to nano_lifecycle_consumidor;
create policy nano_consumidor_leitura on public.nano_lifecycle_checkpoint for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.nano_lifecycle_checkpoint as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.nano_lifecycle_reserva for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.nano_lifecycle_reserva as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.nano_lifecycle_capturas for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.nano_lifecycle_capturas as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.nano_lifecycle_snapshots for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.nano_lifecycle_snapshots as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.produtos for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.produtos as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.pipeline_itens for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.pipeline_itens as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_leitura on public.produto_automacao for select to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_escopo on public.produto_automacao as restrictive for all to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_lock on public.nano_lifecycle_checkpoint for update to nano_lifecycle_consumidor using (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),'')) with check (loja_id::text=coalesce(current_setting('nano.consumer_loja',true),''));
create policy nano_consumidor_lease on public.pipeline_itens for update to nano_lifecycle_consumidor using (entrada->>'origem'='nano_lifecycle') with check (entrada->>'origem'='nano_lifecycle');
create policy nano_consumidor_lease_so_nano on public.pipeline_itens as restrictive for update to nano_lifecycle_consumidor using (entrada->>'origem'='nano_lifecycle') with check (entrada->>'origem'='nano_lifecycle');
create policy nano_consumidor_nao_muda_pausa on public.produto_automacao as restrictive for update to nano_lifecycle_consumidor using (false) with check (false);
alter function public.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_reivindicar(p_loja uuid,p_item uuid,p_execucao uuid,p_segundos integer default 120)
returns jsonb language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
declare cp public.nano_lifecycle_checkpoint; i public.pipeline_itens; r jsonb; t timestamptz; restante numeric;
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 if p_execucao is null or p_segundos is null or p_segundos not between 10 and 180 then raise exception 'reserva inválida'; end if;
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado or not cp.consumo_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle';
 if not found then return jsonb_build_object('estado','item_inexistente'); end if;
 if i.estado<>'entrada' then return jsonb_build_object('estado','estado_invalido'); end if;
 -- Revalida a identidade, revisão técnica, pausa e vínculo ao evento capturado.
 -- Encaminhar pode criar item se outro escritor removê-lo entre as leituras;
 -- qualquer resultado diferente do item existente provoca rollback ou recusa.
 r:=public.nano_lifecycle_encaminhar(p_loja,i.entrada->>'revisao',i.idempotency_key);
 if r->>'estado'='encaminhado' then raise exception 'item desapareceu durante reivindicação'; end if;
 if r->>'estado'<>'ja_encaminhado' then return r; end if;
 if r->>'item_id' is distinct from p_item::text then raise exception 'item divergente'; end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item for update;
 if not found or i.estado<>'entrada' or i.entrada->>'origem' is distinct from 'nano_lifecycle' then return jsonb_build_object('estado','estado_invalido'); end if;
 t:=clock_timestamp();
 if i.reservado_ate>t then return jsonb_build_object('estado','ocupado'); end if;
 if i.proxima_tentativa>t then return jsonb_build_object('estado','aguardar'); end if;
 if i.nano_execucao=p_execucao then return jsonb_build_object('estado','execucao_reutilizada'); end if;
 -- Limite conservador: apenas uma reserva Nano ativa por loja neste piloto.
 if exists(select 1 from public.pipeline_itens where loja_id=p_loja and id<>p_item and entrada->>'origem'='nano_lifecycle' and reservado_ate>t) then return jsonb_build_object('estado','ocupado'); end if;
 restante:=(public.pipeline_orcamento_estado(p_loja)->>'restante_usd')::numeric;
 if restante is null or restante<=0 then return jsonb_build_object('estado','orcamento_indisponivel'); end if;
 update public.pipeline_itens set nano_execucao=p_execucao,nano_geracao=nano_geracao+1,reservado_ate=t+make_interval(secs=>p_segundos)
 where id=p_item and loja_id=p_loja returning * into i;
 return jsonb_build_object('estado','reservado','item_id',i.id,'geracao',i.nano_geracao,'versao',i.versao,'expira_em',i.reservado_ate);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) to service_role;
create function public.nano_lifecycle_reivindicar(p_loja uuid,p_item uuid,p_execucao uuid,p_segundos integer default 120) returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_reivindicar(p_loja,p_item,p_execucao,p_segundos)
$fn$;
revoke all on function public.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer) to service_role;
alter function public.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_liberar_item(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns boolean language plpgsql security definer set search_path='' set nano.consumer_loja='' as $fn$
begin
 perform set_config('nano.consumer_loja',coalesce(p_loja::text,''),true);
 perform 1 from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found then return false; end if;
 update public.pipeline_itens set reservado_ate=null where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle'
 and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and reservado_ate>clock_timestamp();
 return found;
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) owner to nano_lifecycle_consumidor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) to service_role;
create function public.nano_lifecycle_liberar_item(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer) returns boolean language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_liberar_item(p_loja,p_item,p_execucao,p_geracao,p_versao)
$fn$;
revoke all on function public.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) to service_role;
create or replace function nano_lifecycle_interno.bloquear_transicao_legada()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op='TRUNCATE' then
  if exists(select 1 from public.pipeline_itens where entrada->>'origem'='nano_lifecycle') then raise exception 'fila Nano protegida' using errcode='42501'; end if;
  return null;
 end if;
 if tg_op='INSERT' then
  if new.entrada->>'origem'='nano_lifecycle' and (new.estado<>'entrada' or new.versao<>1 or new.tentativas<>0 or new.resultado<>'{}'::jsonb or new.proposta_id is not null or new.reservado_ate is not null or new.nano_execucao is not null or new.nano_geracao<>0 or new.erro is not null) then raise exception 'entrada Nano fora do contrato' using errcode='42501'; end if;
  return new;
 end if;
 if tg_op='DELETE' then
  if old.entrada->>'origem'='nano_lifecycle' and pg_trigger_depth()<=1 then raise exception 'exclusão direta Nano bloqueada' using errcode='42501'; end if;
  return old;
 end if;
 if old.entrada->>'origem'='nano_lifecycle' or new.entrada->>'origem'='nano_lifecycle' then
  if row(old.nano_execucao,old.nano_geracao,old.reservado_ate) is distinct from row(new.nano_execucao,new.nano_geracao,new.reservado_ate)
   and (current_user<>'nano_lifecycle_consumidor' or old.loja_id::text is distinct from current_setting('nano.consumer_loja',true)) then
   raise exception 'lease Nano exige consumidor restrito' using errcode='42501';
  end if;
  -- Transições permanecem bloqueadas. Somente lease possui autoridade própria.
  if row(old.id,old.loja_id,old.produto_id,old.sku,old.estado,old.versao,old.entrada,old.resultado,old.tentativas,old.proxima_tentativa,old.erro,old.proposta_id,old.idempotency_key,old.criado_em,old.atualizado_em)
  is distinct from row(new.id,new.loja_id,new.produto_id,new.sku,new.estado,new.versao,new.entrada,new.resultado,new.tentativas,new.proxima_tentativa,new.erro,new.proposta_id,new.idempotency_key,new.criado_em,new.atualizado_em) then
   raise exception 'transição Nano exige consumidor homologado' using errcode='42501';
  end if;
 end if;
 return new;
end $fn$;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_consumidor;
commit;
