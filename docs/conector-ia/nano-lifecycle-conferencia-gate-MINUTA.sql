-- MINUTA CI descartável. Registro histórico do snapshot, nunca autorização de escrita.
begin;
create role nano_lifecycle_gate_registrador nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage,create on schema nano_lifecycle_interno to nano_lifecycle_gate_registrador;
create table nano_lifecycle_interno.conferencias_gate(
 loja_id uuid not null, solicitacao uuid not null, item_id uuid not null, geracao bigint not null,
 candidato jsonb not null, leitura_id uuid not null references nano_lifecycle_interno.leituras_documentais(id),
 sha256 text not null check(sha256~'^[0-9a-f]{64}$'), auditor name not null,
 conferido_em timestamptz not null default statement_timestamp(),
 homologada boolean not null default false check(not homologada),
 primary key(loja_id,solicitacao),
 foreign key(loja_id,item_id,geracao) references nano_lifecycle_interno.autorias_engenharia(loja_id,item_id,geracao)
);
alter table nano_lifecycle_interno.conferencias_gate enable row level security;
revoke all on nano_lifecycle_interno.conferencias_gate from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant select,insert on nano_lifecycle_interno.conferencias_gate to nano_lifecycle_gate_registrador;
create policy nano_gate_ler on nano_lifecycle_interno.conferencias_gate for select to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true) and auditor=session_user);
create policy nano_gate_gravar on nano_lifecycle_interno.conferencias_gate for insert to nano_lifecycle_gate_registrador with check(loja_id::text=current_setting('nano.gate_loja',true) and auditor=session_user and not homologada);
create policy nano_gate_restrito on nano_lifecycle_interno.conferencias_gate as restrictive for all to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true) and auditor=session_user) with check(loja_id::text=current_setting('nano.gate_loja',true) and auditor=session_user and not homologada);
create trigger nano_gate_imutavel before update or delete on nano_lifecycle_interno.conferencias_gate for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger nano_gate_truncate before truncate on nano_lifecycle_interno.conferencias_gate for each statement execute function nano_lifecycle_interno.proteger_documento_tecnico();
grant execute on function nano_lifecycle_interno.nano_lifecycle_pre_gate(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text),nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) to nano_lifecycle_gate_registrador;
create function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_candidato jsonb,p_leitura uuid,p_hash text,p_solicitacao uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set nano.gate_loja='' as $fn$
declare r nano_lifecycle_interno.conferencias_gate;
begin
 if p_solicitacao is null or p_loja is null or not nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) then return jsonb_build_object('estado','retida','homologada',false); end if;
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
alter function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid) owner to nano_lifecycle_gate_registrador;
revoke all on function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_gate_registrador;
commit;
