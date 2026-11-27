-- MINUTA CI: isolamento das 12 tabelas por loja no gate; sem SHARE global no gate.
begin;
-- O mesmo namespace de advisory lock é obrigatório para todo escritor dessas doze tabelas.
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
-- Documento histórico: não relaxar imutabilidade nem o hash em modo replica.
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.documentos_tecnicos for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.documentos_tecnicos for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table nano_lifecycle_interno.documentos_tecnicos enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.documentos_tecnicos enable always trigger zz_nano_guard_documental_truncate;
alter table nano_lifecycle_interno.documentos_tecnicos enable always trigger nano_documento_hash;
alter table nano_lifecycle_interno.documentos_tecnicos enable always trigger nano_documento_imutavel;
alter table nano_lifecycle_interno.documentos_tecnicos enable always trigger nano_documento_truncate;
revoke update on nano_lifecycle_interno.documentos_tecnicos from nano_lifecycle_gate_travas;
-- Parecer documental: mesma trava por loja, preservando RLS, FKs e imutabilidade.
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.leituras_documentais for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.leituras_documentais for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table nano_lifecycle_interno.leituras_documentais enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.leituras_documentais enable always trigger zz_nano_guard_documental_truncate;
alter table nano_lifecycle_interno.leituras_documentais enable always trigger nano_leitura_imutavel;
alter table nano_lifecycle_interno.leituras_documentais enable always trigger nano_leitura_truncate;
revoke update on nano_lifecycle_interno.leituras_documentais from nano_lifecycle_gate_travas;
-- Autoria histórica: proteção por loja e imutabilidade independente dos privilégios DML.
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.autorias_engenharia for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.autorias_engenharia for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger nano_autoria_imutavel before update or delete on nano_lifecycle_interno.autorias_engenharia for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
alter table nano_lifecycle_interno.autorias_engenharia enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.autorias_engenharia enable always trigger zz_nano_guard_documental_truncate;
alter table nano_lifecycle_interno.autorias_engenharia enable always trigger nano_autoria_imutavel;
revoke update on nano_lifecycle_interno.autorias_engenharia from nano_lifecycle_gate_travas;
-- Resultado histórico: hashes verificáveis no INSERT, inclusive no modo replica.
create function nano_lifecycle_interno.nano_lifecycle_validar_hashes_resultado()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if new.hash_entrada is distinct from encode(sha256(convert_to(new.entrada_snapshot::text,'UTF8')),'hex')
 or new.hash_extracao is distinct from encode(sha256(convert_to(new.extracao_candidata::text,'UTF8')),'hex') then
  raise exception 'hash de resultado de engenharia divergente' using errcode='23514';
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.nano_lifecycle_validar_hashes_resultado() from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
create trigger nano_resultado_hashes before insert on nano_lifecycle_interno.resultados_engenharia for each row execute function nano_lifecycle_interno.nano_lifecycle_validar_hashes_resultado();
create trigger nano_resultado_imutavel before update or delete on nano_lifecycle_interno.resultados_engenharia for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger zz_nano_guard_documental_loja before insert or update or delete on nano_lifecycle_interno.resultados_engenharia for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on nano_lifecycle_interno.resultados_engenharia for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table nano_lifecycle_interno.resultados_engenharia enable always trigger nano_resultado_hashes;
alter table nano_lifecycle_interno.resultados_engenharia enable always trigger nano_resultado_imutavel;
alter table nano_lifecycle_interno.resultados_engenharia enable always trigger zz_nano_guard_documental_loja;
alter table nano_lifecycle_interno.resultados_engenharia enable always trigger zz_nano_guard_documental_truncate;
revoke update on nano_lifecycle_interno.resultados_engenharia from nano_lifecycle_gate_travas;
-- Snapshot e captura são históricos append-only. Protege também a origem da cascata,
-- inclusive UPDATE/DELETE diretos em replica, sem alterar FK ou digest canônico.
create trigger nano_snapshot_imutavel before update or delete on public.nano_lifecycle_snapshots for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.nano_lifecycle_snapshots for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.nano_lifecycle_snapshots for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.nano_lifecycle_snapshots enable always trigger nano_snapshot_imutavel;
alter table public.nano_lifecycle_snapshots enable always trigger zz_nano_guard_documental_loja;
alter table public.nano_lifecycle_snapshots enable always trigger zz_nano_guard_documental_truncate;
create trigger nano_captura_imutavel before update or delete on public.nano_lifecycle_capturas for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger nano_captura_truncate before truncate on public.nano_lifecycle_capturas for each statement execute function nano_lifecycle_interno.proteger_documento_tecnico();
alter table public.nano_lifecycle_capturas enable always trigger nano_captura_imutavel;
alter table public.nano_lifecycle_capturas enable always trigger nano_captura_truncate;
revoke update on public.nano_lifecycle_snapshots from nano_lifecycle_gate_travas;
-- Checkpoint: configuração mutável por autoridade existente, identidade e histórico
-- de gerações preservados. Desligamento continua revogando a reserva atomicamente.
create trigger nano_checkpoint_sem_exclusao before delete on public.nano_lifecycle_checkpoint for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.nano_lifecycle_checkpoint for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.nano_lifecycle_checkpoint for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.nano_lifecycle_checkpoint enable always trigger nano_checkpoint_sem_exclusao;
alter table public.nano_lifecycle_checkpoint enable always trigger zz_nano_guard_documental_loja;
alter table public.nano_lifecycle_checkpoint enable always trigger zz_nano_guard_documental_truncate;
alter table public.nano_lifecycle_checkpoint enable always trigger nano_lifecycle_revogar_ao_desligar;
revoke update on public.nano_lifecycle_checkpoint from nano_lifecycle_gate_travas;
-- Reserva: o fence legítimo mantém a ordem checkpoint -> reserva.
-- Não permitir reabertura da mesma geração, extensão ou regressão do lease.
create function nano_lifecycle_interno.nano_lifecycle_validar_transicao_reserva()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if new.geracao=old.geracao then
  if new.execucao is distinct from old.execucao or new.expira_em>old.expira_em or (old.encerrada and not new.encerrada) then
   raise exception 'transição de reserva inválida' using errcode='23514';
  end if;
 elsif new.geracao<>old.geracao+1 or new.execucao=old.execucao or new.encerrada or (not old.encerrada and old.expira_em>clock_timestamp()) then
  raise exception 'transição de reserva inválida' using errcode='23514';
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.nano_lifecycle_validar_transicao_reserva() from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
create trigger nano_reserva_transicao before update on public.nano_lifecycle_reserva for each row execute function nano_lifecycle_interno.nano_lifecycle_validar_transicao_reserva();
create trigger nano_reserva_sem_exclusao before delete on public.nano_lifecycle_reserva for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.nano_lifecycle_reserva for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.nano_lifecycle_reserva for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.nano_lifecycle_reserva enable always trigger nano_reserva_transicao;
alter table public.nano_lifecycle_reserva enable always trigger nano_reserva_sem_exclusao;
alter table public.nano_lifecycle_reserva enable always trigger zz_nano_guard_documental_loja;
alter table public.nano_lifecycle_reserva enable always trigger zz_nano_guard_documental_truncate;
-- Histórico auxiliar append-only: impede apagar/reutilizar UUID e geração.
create trigger nano_execucao_imutavel before update or delete on public.nano_lifecycle_execucoes for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger nano_execucao_truncate before truncate on public.nano_lifecycle_execucoes for each statement execute function nano_lifecycle_interno.proteger_documento_tecnico();
alter table public.nano_lifecycle_execucoes enable always trigger nano_execucao_imutavel;
alter table public.nano_lifecycle_execucoes enable always trigger nano_execucao_truncate;
revoke update on public.nano_lifecycle_reserva from nano_lifecycle_gate_travas;
-- Automação: preserva as autoridades de pausa/retomada, RLS e FK composta.
-- Uma pausa não pode ser transferida para outro produto por UPDATE.
create function nano_lifecycle_interno.nano_lifecycle_validar_identidade_automacao()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if old.produto_id is distinct from new.produto_id then
  raise exception 'identidade de automação protegida' using errcode='42501';
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.nano_lifecycle_validar_identidade_automacao() from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
create trigger nano_automacao_identidade before update on public.produto_automacao for each row execute function nano_lifecycle_interno.nano_lifecycle_validar_identidade_automacao();
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.produto_automacao for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.produto_automacao for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.produto_automacao enable always trigger nano_automacao_identidade;
alter table public.produto_automacao enable always trigger zz_nano_guard_documental_loja;
alter table public.produto_automacao enable always trigger zz_nano_guard_documental_truncate;
revoke update on public.produto_automacao from nano_lifecycle_gate_travas;
-- Fila: todo escritor participa do namespace por loja, inclusive caminhos legados.
-- Os guardas de origem, transição e autoria Nano continuam obrigatórios em replica.
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.pipeline_itens for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.pipeline_itens for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.pipeline_itens enable always trigger zz_nano_guard_documental_loja;
alter table public.pipeline_itens enable always trigger zz_nano_guard_documental_truncate;
alter table public.pipeline_itens enable always trigger nano_lifecycle_bloquear_transicao;
alter table public.pipeline_itens enable always trigger nano_lifecycle_bloquear_truncate;
alter table public.pipeline_itens enable always trigger nano_lifecycle_proteger_origem;
alter table public.pipeline_itens enable always trigger nano_lifecycle_proteger_produtor;
revoke update on public.pipeline_itens from nano_lifecycle_gate_travas;
-- Espelho: inclusive campos comerciais não projetados e caminhos legados
-- participam da exclusão por loja; autorização de escrita continua no fence.
create trigger zz_nano_guard_documental_loja before insert or update or delete on public.produtos for each row execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
create trigger zz_nano_guard_documental_truncate before truncate on public.produtos for each statement execute function nano_lifecycle_interno.nano_lifecycle_guard_documental_loja();
alter table public.produtos enable always trigger zz_nano_guard_documental_loja;
alter table public.produtos enable always trigger zz_nano_guard_documental_truncate;
alter table public.produtos enable always trigger zz_nano_lifecycle_guard_espelho;
alter table public.produtos enable always trigger zz_nano_lifecycle_guard_truncate;
revoke update on public.produtos from nano_lifecycle_gate_travas;
-- Recibo final: registro append-only, inclusive em replica. Não integra
-- as 12 tabelas de entrada da conferência; não concede autorização de escrita.
alter table nano_lifecycle_interno.conferencias_gate enable always trigger nano_gate_imutavel;
alter table nano_lifecycle_interno.conferencias_gate enable always trigger nano_gate_truncate;
create or replace function nano_lifecycle_interno.nano_lifecycle_travar_conferencia(p_loja uuid,p_solicitacao uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $fn$
begin
 if p_loja is null or p_solicitacao is null or current_setting('transaction_isolation')<>'read committed' or nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) is not true then return false; end if;
 -- Subtransação: recusa libera todas as travas parciais adquiridas aqui.
 begin
  if not pg_try_advisory_xact_lock(hashtextextended('nano.gate:'||p_loja::text||':'||p_solicitacao::text,0)) then return false; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('nano.gate.documental:'||p_loja::text,0)) then raise lock_not_available; end if;
 exception when lock_not_available then return false;
 end;
 return true;
end $fn$;

commit;
