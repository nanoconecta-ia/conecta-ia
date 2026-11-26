-- MINUTA CI: isolamento parcial por loja; preserva dez travas de tabela.
begin;
-- O mesmo namespace de advisory lock é obrigatório para todo escritor dessas duas tabelas.
create function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja()
returns trigger language plpgsql security invoker set search_path='' as $fn$
declare loja uuid;
begin
 if tg_op='TRUNCATE' then raise exception 'truncate documental bloqueado' using errcode='42501'; end if;
 if tg_op='UPDATE' and old.loja_id is distinct from new.loja_id then raise exception 'movimento documental entre lojas bloqueado' using errcode='42501'; end if;
 loja:=case when tg_op='DELETE' then old.loja_id else new.loja_id end;
 if loja is null or not pg_try_advisory_xact_lock(hashtextextended('nano.gate.documental:'||loja::text,0)) then raise exception 'escopo documental ocupado' using errcode='55P03'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja() from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.auditoria_escopos for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.auditoria_escopos for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table nano_lifecycle_interno.auditoria_escopos enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.auditoria_escopos enable always trigger zz_nano_guard_documental_truncate;
revoke update on nano_lifecycle_interno.auditoria_escopos from nano_lifecycle_gate_travas;
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.fontes_documentais for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.fontes_documentais for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table nano_lifecycle_interno.fontes_documentais enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.fontes_documentais enable always trigger zz_nano_guard_documental_truncate;
revoke update on nano_lifecycle_interno.fontes_documentais from nano_lifecycle_gate_travas;
create or replace function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(p_loja uuid,p_solicitacao uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $fn$
begin
 if p_loja is null or p_solicitacao is null or current_setting('transaction_isolation')<>'read committed' or nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) is not true then return false; end if;
 -- Subtransação: recusa libera todas as travas parciais adquiridas aqui.
 begin
  if not pg_try_advisory_xact_lock(hashtextextended('nano.gate:'||p_loja::text||':'||p_solicitacao::text,0)) then return false; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('nano.gate.documental:'||p_loja::text,0)) then raise lock_not_available; end if;
  lock table public.nano_lifecycle_checkpoint,
   public.nano_lifecycle_reserva,
   public.nano_lifecycle_snapshots,
   public.produtos,
   public.produto_automacao,
   public.pipeline_itens,
   nano_lifecycle_interno.documentos_tecnicos,
   nano_lifecycle_interno.resultados_engenharia,
   nano_lifecycle_interno.autorias_engenharia,
   nano_lifecycle_interno.leituras_documentais in share mode nowait;
 exception when lock_not_available then return false;
 end;
 return true;
end $fn$;

commit;
