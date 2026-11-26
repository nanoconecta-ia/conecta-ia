-- MINUTA CI descartável: protótipo de exclusão de escritores; não implantar.
begin;
create role nano_lifecycle_gate_travas nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,nano_lifecycle_interno to nano_lifecycle_gate_travas;
grant create on schema nano_lifecycle_interno to nano_lifecycle_gate_travas;
-- PostgreSQL 16 exige UPDATE/DELETE/TRUNCATE para SHARE. UPDATE é concedido
-- exclusivamente ao papel NOLOGIN, com RLS restritiva que nega todo acesso a linhas.
-- Interromper a minuta se alguma tabela não estiver protegida por RLS.
do $rls$
begin
 if exists(select 1 from unnest(array['public.nano_lifecycle_checkpoint'::regclass,'public.nano_lifecycle_reserva'::regclass,'public.nano_lifecycle_snapshots'::regclass,'public.produtos'::regclass,'public.produto_automacao'::regclass,'public.pipeline_itens'::regclass,'nano_lifecycle_interno.auditoria_escopos'::regclass,'nano_lifecycle_interno.fontes_documentais'::regclass,'nano_lifecycle_interno.documentos_tecnicos'::regclass,'nano_lifecycle_interno.resultados_engenharia'::regclass,'nano_lifecycle_interno.autorias_engenharia'::regclass,'nano_lifecycle_interno.leituras_documentais'::regclass]) as t(oid) join pg_catalog.pg_class c on c.oid=t.oid where not c.relrowsecurity) then raise exception 'tabela sem RLS para trava'; end if;
end $rls$;
grant update on public.nano_lifecycle_checkpoint to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.nano_lifecycle_checkpoint as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on public.nano_lifecycle_reserva to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.nano_lifecycle_reserva as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on public.nano_lifecycle_snapshots to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.nano_lifecycle_snapshots as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on public.produtos to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.produtos as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on public.produto_automacao to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.produto_automacao as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on public.pipeline_itens to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on public.pipeline_itens as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.auditoria_escopos to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.auditoria_escopos as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.fontes_documentais to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.fontes_documentais as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.documentos_tecnicos to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.documentos_tecnicos as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.resultados_engenharia to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.resultados_engenharia as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.autorias_engenharia to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.autorias_engenharia as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant update on nano_lifecycle_interno.leituras_documentais to nano_lifecycle_gate_travas;
create policy nano_gate_trava_sem_dml on nano_lifecycle_interno.leituras_documentais as restrictive for all to nano_lifecycle_gate_travas using(false) with check(false);
grant execute on function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) to nano_lifecycle_gate_travas;
create function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(p_loja uuid,p_solicitacao uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $fn$
begin
 if p_loja is null or p_solicitacao is null or current_setting('transaction_isolation')<>'read committed' or nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) is not true then return false; end if;
 -- Subtransação: recusa libera todas as travas parciais adquiridas aqui.
 begin
  if not pg_try_advisory_xact_lock(hashtextextended('nano.gate:'||p_loja::text||':'||p_solicitacao::text,0)) then return false; end if;
  lock table public.nano_lifecycle_checkpoint,
   public.nano_lifecycle_reserva,
   public.nano_lifecycle_snapshots,
   public.produtos,
   public.produto_automacao,
   public.pipeline_itens,
   nano_lifecycle_interno.auditoria_escopos,
   nano_lifecycle_interno.fontes_documentais,
   nano_lifecycle_interno.documentos_tecnicos,
   nano_lifecycle_interno.resultados_engenharia,
   nano_lifecycle_interno.autorias_engenharia,
   nano_lifecycle_interno.leituras_documentais in share mode nowait;
 exception when lock_not_available then return false;
 end;
 return true;
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(uuid,uuid) owner to nano_lifecycle_gate_travas;
revoke all on function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(uuid,uuid) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(uuid,uuid) to nano_lifecycle_gate_registrador;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_gate_travas;
create or replace function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_candidato jsonb,p_leitura uuid,p_hash text,p_solicitacao uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set nano.gate_loja='' as $fn$
declare r nano_lifecycle_interno.conferencias_gate;
begin
 if p_solicitacao is null or p_loja is null or not nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) then return jsonb_build_object('estado','retida','homologada',false); end if;
 -- READ COMMITTED é obrigatório: transações com snapshot anterior não podem autorizar.
 if current_setting('transaction_isolation')<>'read committed' then return jsonb_build_object('estado','retida','homologada',false); end if;
 if not nano_lifecycle_interno.nano_lifecycle_travar_conferencia(p_loja,p_solicitacao) then return jsonb_build_object('estado','ocupada','homologada',false); end if;
 perform set_config('nano.gate_loja',p_loja::text,true);
 -- A avaliação STABLE usa o snapshot da própria instrução INSERT.
 insert into nano_lifecycle_interno.conferencias_gate(loja_id,solicitacao,item_id,geracao,candidato,leitura_id,sha256,auditor,conferido_em)
 select p_loja,p_solicitacao,p_item,p_geracao,p_candidato,p_leitura,p_hash,session_user,clock_timestamp()
 where nano_lifecycle_interno.nano_lifecycle_pre_gate(p_loja,p_item,p_execucao,p_geracao,p_versao,p_candidato,p_leitura,p_hash) is true
 on conflict(loja_id,solicitacao) do nothing returning * into r;
 if found then return jsonb_build_object('estado','registrada','solicitacao',r.solicitacao,'homologada',false); end if;
 -- Retry não transforma um registro histórico em permissão vigente.
 select * into r from nano_lifecycle_interno.conferencias_gate where loja_id=p_loja and solicitacao=p_solicitacao;
 if not found or r.item_id is distinct from p_item or r.geracao is distinct from p_geracao or r.candidato is distinct from p_candidato or r.leitura_id is distinct from p_leitura or r.sha256 is distinct from p_hash or not nano_lifecycle_interno.nano_lifecycle_pre_gate(p_loja,p_item,p_execucao,p_geracao,p_versao,p_candidato,p_leitura,p_hash) then return jsonb_build_object('estado','retida','homologada',false); end if;
 return jsonb_build_object('estado','ja_registrada','solicitacao',r.solicitacao,'homologada',false);
end $fn$;

commit;
