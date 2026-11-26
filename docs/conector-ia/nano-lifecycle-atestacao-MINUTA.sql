-- MINUTA CI descartável. Parecer registrado não homologa aplicação.
begin;
create table nano_lifecycle_interno.leituras_documentais(
 id uuid primary key default gen_random_uuid(),
 loja_id uuid not null,item_id uuid not null,geracao bigint not null,
 escopo jsonb not null,documento_id text not null,fonte_id text not null,
 sha256 text not null,localizador text not null,trecho text not null,
 fato jsonb not null,verificador name not null,
 verificado_em timestamptz not null default clock_timestamp(),
 resultado text not null check(resultado in ('confere','diverge')),
 foreign key(loja_id,item_id,geracao) references nano_lifecycle_interno.autorias_engenharia(loja_id,item_id,geracao),
 foreign key(loja_id,documento_id) references nano_lifecycle_interno.documentos_tecnicos(loja_id,id),
 unique(loja_id,item_id,geracao,documento_id,localizador,verificador)
);
alter table nano_lifecycle_interno.leituras_documentais enable row level security;
revoke all on nano_lifecycle_interno.leituras_documentais from public,anon,authenticated,service_role,nano_lifecycle_consumidor,nano_lifecycle_produtor,nano_lifecycle_auditoria,nano_lifecycle_auditor_leitor;
-- Única escrita do leitor: novo parecer documental. Não altera evidência ou fonte.
grant select,insert on nano_lifecycle_interno.leituras_documentais to nano_lifecycle_auditor_leitor;
create policy nano_leitura_select on nano_lifecycle_interno.leituras_documentais for select to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=leituras_documentais.loja_id and a.habilitado));
create policy nano_leitura_insert on nano_lifecycle_interno.leituras_documentais for insert to nano_lifecycle_auditor_leitor with check(verificador=session_user and exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=leituras_documentais.loja_id and a.habilitado));
create policy nano_leitura_escopo on nano_lifecycle_interno.leituras_documentais as restrictive for all to nano_lifecycle_auditor_leitor using(exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=leituras_documentais.loja_id and a.habilitado)) with check(verificador=session_user and exists(select 1 from nano_lifecycle_interno.auditoria_escopos a where a.login_db=session_user and a.loja_id=leituras_documentais.loja_id and a.habilitado));
create trigger nano_leitura_imutavel before update or delete on nano_lifecycle_interno.leituras_documentais for each row execute function nano_lifecycle_interno.proteger_documento_tecnico();
create trigger nano_leitura_truncate before truncate on nano_lifecycle_interno.leituras_documentais for each statement execute function nano_lifecycle_interno.proteger_documento_tecnico();
grant create on schema nano_lifecycle_interno to nano_lifecycle_auditor_leitor;
create function nano_lifecycle_interno.nano_lifecycle_atestar_fato(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_documento text,p_hash text,p_localizador text,p_trecho text,p_fato jsonb,p_resultado text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare e jsonb; a jsonb; d jsonb; f jsonb; s jsonb; l nano_lifecycle_interno.leituras_documentais; k text;
begin
 if not nano_lifecycle_interno.auditor_documental_valido() then return jsonb_build_object('estado','auditor_nao_autorizado'); end if;
 e:=nano_lifecycle_interno.nano_lifecycle_ler_evidencia(p_loja,p_item,p_geracao);
 a:=nano_lifecycle_interno.nano_lifecycle_ler_autoria(p_loja,p_item,p_execucao,p_geracao,p_versao);
 if a is null or e->>'estado' is distinct from 'evidencia_historica' or e->>'execucao' is distinct from p_execucao::text or e->>'versao' is distinct from p_versao::text or a->>'produtor'=session_user::text or a->>'hashEntrada' is distinct from e->>'hash_entrada' or a->>'hashExtracao' is distinct from e->>'hash_extracao' then return jsonb_build_object('estado','evidencia_indisponivel'); end if;
 d:=nano_lifecycle_interno.nano_lifecycle_ler_documento(p_loja,p_documento);
 f:=nano_lifecycle_interno.nano_lifecycle_ler_fonte(p_loja,d->>'fonteId');
 if d is null or f is null or f->>'tipo' not in ('catalogo_fabricante','manual_montadora') or p_hash is distinct from d->>'sha256' then return jsonb_build_object('estado','documento_indisponivel'); end if;
 if p_localizador is null or length(btrim(p_localizador)) not between 1 and 512 or p_localizador<>btrim(p_localizador) or p_trecho is null or length(btrim(p_trecho)) not between 1 and 4000 or position(p_trecho in d->>'conteudo')=0 or p_resultado is null or p_resultado not in ('confere','diverge') then return jsonb_build_object('estado','leitura_invalida'); end if;
 if jsonb_typeof(p_fato) is distinct from 'object' or not (p_fato ?& array['oem','montadora','modelo','geracao','motor','emissao','mercado','tipo_ano','ano_inicio','ano_fim']) or p_fato-array['oem','montadora','modelo','geracao','motor','emissao','mercado','tipo_ano','ano_inicio','ano_fim']<>'{}'::jsonb then return jsonb_build_object('estado','fato_invalido'); end if;
 foreach k in array array['oem','montadora','modelo','geracao','motor','emissao','mercado','tipo_ano'] loop
  if jsonb_typeof(p_fato->k) is distinct from 'string' or length(btrim(p_fato->>k)) not between 1 and 256 or p_fato->>k<>btrim(p_fato->>k) then return jsonb_build_object('estado','fato_invalido'); end if;
 end loop;
 if p_fato->>'mercado'<>'BR' or p_fato->>'tipo_ano' not in ('ano_modelo_crlv','fabricacao','comercializacao_brasil','importacao_brasil') or jsonb_typeof(p_fato->'ano_inicio') is distinct from 'number' or jsonb_typeof(p_fato->'ano_fim') is distinct from 'number' or p_fato->>'ano_inicio' !~ '^[0-9]{4}$' or p_fato->>'ano_fim' !~ '^[0-9]{4}$' then return jsonb_build_object('estado','fato_invalido'); end if;
 if (p_fato->>'ano_inicio')::integer not between 1950 and 2100 or (p_fato->>'ano_fim')::integer not between (p_fato->>'ano_inicio')::integer and least(2100,extract(year from clock_timestamp() at time zone 'UTC')::integer+1) then return jsonb_build_object('estado','fato_invalido'); end if;
 s:=(a->'chave')||jsonb_build_object('produto',e->>'produto_id','sku',e->'entrada_snapshot'->'produto'->>'sku','revisao',e->>'revisao','checkpoint',e->>'checkpoint','hashEntrada',a->>'hashEntrada','hashExtracao',a->>'hashExtracao','produtor',a->>'produtor');
 insert into nano_lifecycle_interno.leituras_documentais(loja_id,item_id,geracao,escopo,documento_id,fonte_id,sha256,localizador,trecho,fato,verificador,resultado)
 values(p_loja,p_item,p_geracao,s,p_documento,d->>'fonteId',p_hash,p_localizador,p_trecho,p_fato,session_user,p_resultado)
 on conflict(loja_id,item_id,geracao,documento_id,localizador,verificador) do nothing returning * into l;
 if not found then
  select * into l from nano_lifecycle_interno.leituras_documentais where loja_id=p_loja and item_id=p_item and geracao=p_geracao and documento_id=p_documento and localizador=p_localizador and verificador=session_user;
  if not found or l.escopo is distinct from s or l.fato is distinct from p_fato or l.trecho is distinct from p_trecho or l.sha256 is distinct from p_hash or l.resultado is distinct from p_resultado then return jsonb_build_object('estado','parecer_divergente'); end if;
  return jsonb_build_object('estado','ja_registrado','id',l.id,'homologada',false);
 end if;
 return jsonb_build_object('estado','registrado','id',l.id,'homologada',false);
end $fn$;
create function nano_lifecycle_interno.nano_lifecycle_ler_pareceres(p_loja uuid,p_documento text,p_localizador text,p_escopo jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
begin
 if not nano_lifecycle_interno.auditor_documental_valido() or nano_lifecycle_interno.nano_lifecycle_ler_documento(p_loja,p_documento) is null then return '[]'::jsonb; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'escopo',l.escopo,'fonteId',l.fonte_id,'documentoId',l.documento_id,'sha256',l.sha256,'localizador',l.localizador,'fato',l.fato,'verificador',l.verificador,'verificadoEm',to_char(l.verificado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'resultado',l.resultado) order by l.id),'[]'::jsonb) from nano_lifecycle_interno.leituras_documentais l where l.loja_id=p_loja and l.documento_id=p_documento and l.localizador=p_localizador and l.escopo=p_escopo);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_atestar_fato(uuid,uuid,uuid,bigint,integer,text,text,text,text,jsonb,text) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_atestar_fato(uuid,uuid,uuid,bigint,integer,text,text,text,text,jsonb,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_atestar_fato(uuid,uuid,uuid,bigint,integer,text,text,text,text,jsonb,text) to nano_lifecycle_auditoria;
alter function nano_lifecycle_interno.nano_lifecycle_ler_pareceres(uuid,text,text,jsonb) owner to nano_lifecycle_auditor_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_ler_pareceres(uuid,text,text,jsonb) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_pareceres(uuid,text,text,jsonb) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_auditor_leitor;
commit;
