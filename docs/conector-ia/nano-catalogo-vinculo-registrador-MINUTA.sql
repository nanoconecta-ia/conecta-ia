-- MINUTA CI descartável. Vínculo técnico candidato, jamais decisão humana.
begin;
-- CAT-125: dimensões explícitas na aplicação legada somente na minuta do CI.
-- NULL significa não demonstrado; sem backfill ou inferência por OEM, modelo ou ano.
alter table public.produto_aplicacoes
 add column nano_geracao_veicular text,
 add column nano_emissao text,
 add column nano_mercado text,
 add column nano_tipo_ano text,
 add constraint nano_aplicacao_dimensoes check (
  (nano_geracao_veicular is null and nano_emissao is null and nano_mercado is null and nano_tipo_ano is null)
  or (
   nano_geracao_veicular is not null and length(btrim(nano_geracao_veicular)) between 1 and 256 and nano_geracao_veicular=btrim(nano_geracao_veicular)
   and nano_emissao is not null and length(btrim(nano_emissao)) between 1 and 256 and nano_emissao=btrim(nano_emissao)
   and nano_mercado='BR'
   and nano_tipo_ano in ('ano_modelo_crlv','fabricacao','comercializacao_brasil','importacao_brasil')
  ) is true
 );
-- CAT-126: IDs explícitos da versão e do motor no grafo existente.
alter table public.produto_aplicacoes
 add column nano_versao_id uuid,
 add column nano_motor_id uuid,
 add constraint nano_aplicacao_grafo_par check ((nano_versao_id is null)=(nano_motor_id is null)),
 add constraint nano_aplicacao_grafo_fk foreign key(nano_versao_id,nano_motor_id) references public.versao_motor(versao_id,motor_id);
-- CAT-130: referência individualizada da peça e da aresta técnica, nunca por OEM isolado.
alter table public.produto_aplicacoes
 add column nano_produto_peca_ref_id uuid references public.produto_pecas_ref(id),
 add column nano_peca_aplicacao_id uuid references public.pecas_aplicacoes_tecnicas(id),
 add constraint nano_aplicacao_peca_par check ((nano_produto_peca_ref_id is null)=(nano_peca_aplicacao_id is null));
-- CAT-131: hash explícito do conteúdo documental da fonte global.
-- Sem backfill; o documento privado é revalidado pelo pre_gate.
alter table public.fontes
 add column nano_documento_sha256 text,
 add constraint nano_fonte_documento_hash check(nano_documento_sha256 is null or nano_documento_sha256 ~ '^[0-9a-f]{64}$');
-- Grafo global: leitores compartilham uma trava e escritores a adquirem exclusivamente.
create function nano_lifecycle_interno.nano_gate_guard_grafo()
returns trigger language plpgsql set search_path='' as $fn$
begin
 if not pg_try_advisory_xact_lock(hashtextextended('nano.gate.grafo.veicular',0)) then
  raise exception 'grafo veicular ocupado' using errcode='55P03';
 end if;
 return null;
end $fn$;
revoke all on function nano_lifecycle_interno.nano_gate_guard_grafo() from public,anon,authenticated,service_role;
do $grafo$
declare rel regclass;
begin
 foreach rel in array array['public.montadoras'::regclass,'public.modelos'::regclass,'public.geracoes'::regclass,'public.versoes'::regclass,'public.motores'::regclass,'public.versao_motor'::regclass,'public.fontes'::regclass,'public.pecas_ref'::regclass,'public.pecas_aplicacoes_tecnicas'::regclass] loop
  execute format('grant select on %s to nano_lifecycle_gate_registrador',rel);
  execute format('create policy nano_gate_grafo_ler on %s for select to nano_lifecycle_gate_registrador using(true)',rel);
  execute format('create trigger zz_nano_guard_grafo before insert or update or delete or truncate on %s for each statement execute function nano_lifecycle_interno.nano_gate_guard_grafo()',rel);
  execute format('alter table %s enable always trigger zz_nano_guard_grafo',rel);
 end loop;
end $grafo$;
-- Campos candidatos, ainda sujeitos ao parecer e ao futuro gate humano.
-- Mesmo registrador NOLOGIN, escopo RLS e trava da conferência existente.
grant select on public.produto_aplicacoes,public.marcas,public.produto_pecas_ref to nano_lifecycle_gate_registrador;
create policy nano_gate_produto_peca_ler on public.produto_pecas_ref for select to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true));
create policy nano_gate_produto_peca_escopo on public.produto_pecas_ref as restrictive for all to nano_lifecycle_gate_registrador using(loja_id::text=current_setting('nano.gate_loja',true)) with check(false);
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
 if not pg_try_advisory_xact_lock_shared(hashtextextended('nano.gate.grafo.veicular',0)) then return jsonb_build_object('estado','ocupada','homologada',false); end if;
 perform set_config('nano.gate_loja',p_loja::text,true);
 -- Leitura depois da trava comum de produto, aplicação, marca e fonte.
 select to_jsonb(a.*)||jsonb_build_object('marca_conferida',to_jsonb(m.*),'grafo_conferido',jsonb_build_object('montadora',to_jsonb(ma.*),'modelo',to_jsonb(mo.*),'geracao',to_jsonb(g.*),'versao',to_jsonb(ve.*),'motor',to_jsonb(mt.*),'vinculo_motor',to_jsonb(vm.*),'fonte_motor',to_jsonb(fm.*),'fonte_vinculo',to_jsonb(fv.*),'produto_peca',to_jsonb(pp.*),'peca',to_jsonb(pr.*),'aplicacao_peca',to_jsonb(pa.*),'fonte_produto_peca',to_jsonb(fp.*),'fonte_peca',to_jsonb(fr.*),'fonte_aplicacao_peca',to_jsonb(fa.*))) into snap
 from public.produto_aplicacoes a join public.marcas m on m.id=a.marca_veiculo_id and m.id=a.montadora_origem_id and m.loja_id=a.loja_id
 join public.versao_motor vm on vm.versao_id=a.nano_versao_id and vm.motor_id=a.nano_motor_id
 join public.versoes ve on ve.id=vm.versao_id
 join public.geracoes g on g.id=ve.geracao_id
 join public.modelos mo on mo.id=g.modelo_id
 join public.montadoras ma on ma.id=mo.montadora_id
 join public.motores mt on mt.id=vm.motor_id
 join public.fontes fm on fm.id=mt.fonte_id
 join public.fontes fv on fv.id=vm.fonte_id
 join public.produto_pecas_ref pp on pp.id=a.nano_produto_peca_ref_id and pp.loja_id=a.loja_id and pp.produto_id=a.produto_id
 join public.pecas_ref pr on pr.id=pp.peca_id
 join public.pecas_aplicacoes_tecnicas pa on pa.id=a.nano_peca_aplicacao_id and pa.peca_id=pr.id and pa.versao_id=ve.id and pa.motor_id=mt.id
 join public.fontes fp on fp.id=pp.fonte_id
 join public.fontes fr on fr.id=pr.fonte_id
 join public.fontes fa on fa.id=pa.fonte_id
 where a.loja_id=p_loja and a.id=p_aplicacao and a.produto_id::text=p_candidato->'escopo'->>'produto'
  and a.codigo_oem=p_candidato->'fato'->>'oem' and a.modelo=p_candidato->'fato'->>'modelo'
  and a.motorizacao=p_candidato->'fato'->>'motor'
  and a.ano_inicial::text=p_candidato->'fato'->>'ano_inicio' and a.ano_final::text=p_candidato->'fato'->>'ano_fim'
  and a.nano_geracao_veicular=p_candidato->'fato'->>'geracao'
  and a.nano_emissao=p_candidato->'fato'->>'emissao'
  and a.nano_mercado=p_candidato->'fato'->>'mercado'
  and a.nano_tipo_ano=p_candidato->'fato'->>'tipo_ano'
  and ma.nome=m.nome and mo.nome=a.modelo and g.codigo_interno=a.nano_geracao_veicular
  and ve.mercado=a.nano_mercado and mt.codigo=a.motorizacao and mt.sistema_emissoes=a.nano_emissao
  and mt.status='aprovado' and vm.status='aprovado'
  and vm.periodo_inicio<=a.ano_inicial and vm.periodo_fim>=a.ano_final
  and fm.mercado=a.nano_mercado and fv.mercado=a.nano_mercado
  and pp.relacao='e_esta_peca' and pp.status='aprovado' and pp.verificado_em is not null
  and pr.classe='genuina' and pr.montadora_id=ma.id and pr.codigo=a.codigo_oem and pr.status='aprovado' and pr.verificado_em is not null
  and pa.status='aprovado' and pa.verificado_em is not null and pa.mercado=a.nano_mercado
  and pa.periodo_inicio<=a.ano_inicial and pa.periodo_fim>=a.ano_final
  and pa.faixa_serie is null and pa.restricoes is null
  and fp.mercado=a.nano_mercado and fr.mercado=a.nano_mercado and fa.mercado=a.nano_mercado
  -- Escopo conservador: todas as fontes devem apontar ao mesmo conteúdo
  -- efetivamente atestado; hash de metadados, URL ou rótulo não é suficiente.
  and fm.nano_documento_sha256=p_hash and fv.nano_documento_sha256=p_hash
  and fp.nano_documento_sha256=p_hash and fr.nano_documento_sha256=p_hash and fa.nano_documento_sha256=p_hash
  and fm.tipo in ('catalogo_montadora','epc','doc_fabricante_componente')
  and fv.tipo in ('catalogo_montadora','epc','doc_fabricante_componente')
  and fp.tipo in ('catalogo_montadora','epc','doc_fabricante_componente')
  and fr.tipo in ('catalogo_montadora','epc','doc_fabricante_componente')
  and fa.tipo in ('catalogo_montadora','epc','doc_fabricante_componente')
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
-- CAT-132: fronteira consultiva de sessão humana no CI, NÃO é decisão.
-- SECURITY INVOKER: preserva RLS, não amplia DML nem aceita ator do chamador.
-- Exige vínculo lojista persistido; super-admin por claim isolado não é
-- suficiente, pois a revogação dessa claim não integra a trava por loja.
create function private.nano_catalogo_conferir_autoridade(p_loja uuid,p_produto uuid,p_aplicacao uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $humano$
declare ator uuid;
begin
 if current_user<>'authenticated' or current_setting('transaction_isolation')<>'read committed'
  or p_loja is null or p_produto is null or p_aplicacao is null then
  return jsonb_build_object('estado','retida','homologada',false);
 end if;
 ator:=auth.uid();
 if ator is null then return jsonb_build_object('estado','retida','homologada',false); end if;
 -- A trava é a mesma dos escritores de usuários e aplicações (CAT-123).
 if not pg_try_advisory_xact_lock(hashtextextended('nano.gate.documental:'||p_loja::text,0)) then
  return jsonb_build_object('estado','ocupada','homologada',false);
 end if;
 -- Leitura VOLATILE depois da exclusão em READ COMMITTED.
 if public.pode_administrar_loja(p_loja) is not true
  or not exists(select 1 from public.usuarios_loja u where u.loja_id=p_loja and u.user_id=ator and u.papel='lojista')
  or not exists(select 1 from public.produto_aplicacoes a where a.loja_id=p_loja and a.produto_id=p_produto and a.id=p_aplicacao) then
  return jsonb_build_object('estado','retida','homologada',false);
 end if;
 return jsonb_build_object('estado','autoridade_consultiva','ator',ator,'loja',p_loja,'produto',p_produto,'aplicacao',p_aplicacao,'homologada',false);
end $humano$;
revoke all on function private.nano_catalogo_conferir_autoridade(uuid,uuid,uuid) from public,anon,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function private.nano_catalogo_conferir_autoridade(uuid,uuid,uuid) to authenticated;
commit;
