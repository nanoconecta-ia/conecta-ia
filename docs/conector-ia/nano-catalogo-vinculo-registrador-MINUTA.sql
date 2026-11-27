-- MINUTA CI descartável. Vínculo técnico candidato, jamais decisão humana.
begin;
-- Mesmo registrador NOLOGIN, escopo RLS e trava da conferência existente.
grant select on public.produto_aplicacoes,public.marcas to nano_lifecycle_gate_registrador;
create policy nano_gate_aplicacao_ler on public.produto_aplicacoes for select to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true));
create policy nano_gate_aplicacao_escopo on public.produto_aplicacoes as restrictive for all to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true)) with check(false);
create policy nano_gate_marca_ler on public.marcas for select to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true));
create policy nano_gate_marca_escopo on public.marcas as restrictive for all to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true)) with check(false);
grant create on schema nano_lifecycle_interno to nano_lifecycle_gate_registrador;
-- Sobrecarga explícita: a versão histórica de nove argumentos não vincula aplicação.
-- Não aceita snapshot/hash da aplicação do chamador; deriva da leitura protegida.
create function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_candidato jsonb,p_leitura uuid,p_hash text,p_solicitacao uuid,p_aplicacao uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set nano.gate_loja='' as $fn$
declare r nano_lifecycle_interno.conferencias_gate; snap jsonb; digest text;
begin
 if p_loja is null or p_solicitacao is null or p_aplicacao is null or current_setting('transaction_isolation')<>'read committed'
  or nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,session_user::text) is not true
  or pg_has_role(session_user,'nano_lifecycle_gate_registrador','MEMBER') then return jsonb_build_object('estado','retida','homologada',false); end if;
 if not nano_lifecycle_interno.nano_lifecycle_travar_conferencia(p_loja,p_solicitacao) then return jsonb_build_object('estado','ocupada','homologada',false); end if;
 perform set_config('nano.gate_loja',p_loja::text,true);
 -- Leitura depois da trava comum de produto, aplicação, marca e fonte.
 select to_jsonb(a.*)||jsonb_build_object('marca_conferida',to_jsonb(m.*)) into snap
 from public.produto_aplicacoes a join public.marcas m on m.id=a.marca_veiculo_id and m.id=a.montadora_origem_id and m.loja_id=a.loja_id
 where a.loja_id=p_loja and a.id=p_aplicacao and a.produto_id::text=p_candidato->'escopo'->>'produto'
  and a.codigo_oem=p_candidato->'fato'->>'oem' and a.modelo=p_candidato->'fato'->>'modelo'
  and a.motorizacao=p_candidato->'fato'->>'motor'
  and a.ano_inicial::text=p_candidato->'fato'->>'ano_inicio' and a.ano_final::text=p_candidato->'fato'->>'ano_fim'
  and m.nome=p_candidato->'fato'->>'montadora' and m.tipo='veiculo' and m.status='aprovado';
 if not found or snap is null then return jsonb_build_object('estado','retida','homologada',false); end if;
 digest:=encode(sha256(convert_to(snap::text,'UTF8')),'hex');
 if nano_lifecycle_interno.nano_lifecycle_pre_gate(p_loja,p_item,p_execucao,p_geracao,p_versao,p_candidato,p_leitura,p_hash) is not true then return jsonb_build_object('estado','retida','homologada',false); end if;
 insert into nano_lifecycle_interno.conferencias_gate(loja_id,solicitacao,item_id,geracao,candidato,leitura_id,sha256,auditor,conferido_em,aplicacao_id,aplicacao_snapshot,aplicacao_sha256)
 values(p_loja,p_solicitacao,p_item,p_geracao,p_candidato,p_leitura,p_hash,session_user,clock_timestamp(),p_aplicacao,snap,digest)
 on conflict(loja_id,solicitacao) do nothing returning * into r;
 if found then return jsonb_build_object('estado','vinculo_registrado','solicitacao',r.solicitacao,'homologada',false); end if;
 select * into r from nano_lifecycle_interno.conferencias_gate where loja_id=p_loja and solicitacao=p_solicitacao;
 if not found or r.item_id is distinct from p_item or r.geracao is distinct from p_geracao or r.candidato is distinct from p_candidato or r.leitura_id is distinct from p_leitura or r.sha256 is distinct from p_hash or r.aplicacao_id is distinct from p_aplicacao or r.aplicacao_snapshot is distinct from snap or r.aplicacao_sha256 is distinct from digest then return jsonb_build_object('estado','retida','homologada',false); end if;
 return jsonb_build_object('estado','vinculo_ja_registrado','solicitacao',r.solicitacao,'homologada',false);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid,uuid) owner to nano_lifecycle_gate_registrador;
revoke all on function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid,uuid) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid,uuid) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_gate_registrador;
commit;
