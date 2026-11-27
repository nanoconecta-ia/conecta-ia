-- MINUTA CI descartável: pré-gate somente leitura com snapshot de uma instrução.
begin;
-- Funções abaixo exclusivamente consultam tabelas; STABLE preserva o snapshot
-- da instrução chamadora. set_config apenas delimita o escopo local da função.
alter function nano_lifecycle_interno.nano_lifecycle_ler_evidencia(uuid,uuid,bigint) stable;
alter function nano_lifecycle_interno.nano_lifecycle_ler_autoria(uuid,uuid,uuid,bigint,integer) stable;
alter function nano_lifecycle_interno.nano_lifecycle_ler_fonte(uuid,text) stable;
alter function nano_lifecycle_interno.nano_lifecycle_ler_pareceres(uuid,text,text,jsonb) stable;
alter function nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(uuid,text) stable;
create or replace function nano_lifecycle_interno.nano_lifecycle_ler_documento(p_loja uuid,p_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare d nano_lifecycle_interno.documentos_tecnicos;
begin
 if not nano_lifecycle_interno.auditor_documental_valido() then return null; end if;
 select x.* into d from nano_lifecycle_interno.documentos_tecnicos x join nano_lifecycle_interno.fontes_documentais f on f.loja_id=x.loja_id and f.id=x.fonte_id
 where x.loja_id=p_loja and x.id=p_id and f.autorizada and x.consultado_em<=statement_timestamp();
 if not found then return null; end if;
 return jsonb_build_object('id',d.id,'loja',d.loja_id,'fonteId',d.fonte_id,'conteudo',d.conteudo,'sha256',d.sha256,'consultadoEm',to_char(d.consultado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $fn$;

grant execute on function nano_lifecycle_interno.nano_lifecycle_ler_fonte(uuid,text),nano_lifecycle_interno.nano_lifecycle_ler_documento(uuid,text),nano_lifecycle_interno.nano_lifecycle_ler_pareceres(uuid,text,text,jsonb) to nano_lifecycle_atualidade_leitor;
grant create on schema nano_lifecycle_interno to nano_lifecycle_atualidade_leitor;
-- CAT-137: predicado comum, sem acesso a tabelas ou autoridade própria.
create function nano_lifecycle_interno.nano_catalogo_documento_confere(p_loja uuid,d jsonb,f jsonb,c jsonb,p_hash text)
returns boolean language sql stable security invoker set search_path='' as $doc$
 select coalesce(p_loja is not null and d->>'loja'=p_loja::text and f->>'loja'=p_loja::text
  and d->>'id'=c->>'documentoId' and d->>'fonteId'=f->>'id' and f->>'id'=c->>'fonteId'
  and f->'autorizada'='true'::jsonb and f->>'tipo' in ('catalogo_fabricante','manual_montadora')
  and p_hash ~ '^[0-9a-f]{64}$' and d->>'sha256'=p_hash
  and encode(sha256(convert_to(d->>'conteudo','UTF8')),'hex')=p_hash,false)
$doc$;
revoke all on function nano_lifecycle_interno.nano_catalogo_documento_confere(uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_catalogo_documento_confere(uuid,jsonb,jsonb,jsonb,text) to nano_lifecycle_atualidade_leitor;
-- CAT-138: identidade, escopo, fato e independência do parecer, sem ler tabelas.
-- Autorização DB e temporalidade permanecem nas fronteiras de leitura existentes.
create function nano_lifecycle_interno.nano_catalogo_parecer_confere(p_leitura uuid,c jsonb,p_hash text,p_auditor text,l jsonb)
returns boolean language sql stable security invoker set search_path='' as $parecer$
 select coalesce(p_leitura is not null and p_auditor is not null and p_hash ~ '^[0-9a-f]{64}$'
  and l->>'id'=p_leitura::text and l->'escopo'=c->'escopo' and l->'fato'=c->'fato'
  and l->>'fonteId'=c->>'fonteId' and l->>'documentoId'=c->>'documentoId'
  and l->>'localizador'=c->>'localizador' and l->>'sha256'=p_hash and l->>'resultado'='confere'
  and l->>'verificador'<>c->'escopo'->>'produtor' and l->>'verificador'<>p_auditor,false)
$parecer$;
revoke all on function nano_lifecycle_interno.nano_catalogo_parecer_confere(uuid,jsonb,text,text,jsonb) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_catalogo_parecer_confere(uuid,jsonb,text,text,jsonb) to nano_lifecycle_atualidade_leitor;
create function nano_lifecycle_interno.nano_lifecycle_pre_gate(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer,p_candidato jsonb,p_leitura uuid,p_hash text)
returns boolean language plpgsql stable security definer set search_path='' as $fn$
declare e jsonb; d jsonb; f jsonb; ls jsonb; l jsonb; esc jsonb; fato jsonb;
begin
 if p_leitura is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_candidato) is distinct from 'object' or not (p_candidato ?& array['escopo','fato','fonteId','documentoId','localizador']) or p_candidato-array['escopo','fato','fonteId','documentoId','localizador']<>'{}'::jsonb then return false; end if;
 esc:=p_candidato->'escopo'; fato:=p_candidato->'fato';
 if not nano_lifecycle_interno.nano_lifecycle_conferir_atualidade(p_loja,p_item,p_execucao,p_geracao,p_versao,esc) then return false; end if;
 e:=nano_lifecycle_interno.nano_lifecycle_ler_evidencia(p_loja,p_item,p_geracao);
 if e->>'estado' is distinct from 'evidencia_historica' or e->'extracao_candidata'->'nao_se_aplica' is distinct from 'null'::jsonb or not exists(select 1 from jsonb_array_elements(e->'extracao_candidata'->'codigos_oem') o where o->>'normalizado'=fato->>'oem') then return false; end if;
 d:=nano_lifecycle_interno.nano_lifecycle_ler_documento(p_loja,p_candidato->>'documentoId');
 f:=nano_lifecycle_interno.nano_lifecycle_ler_fonte(p_loja,p_candidato->>'fonteId');
 if not nano_lifecycle_interno.nano_catalogo_documento_confere(p_loja,d,f,p_candidato,p_hash) then return false; end if;
 ls:=nano_lifecycle_interno.nano_lifecycle_ler_pareceres(p_loja,d->>'id',p_candidato->>'localizador',esc);
 if jsonb_array_length(ls) is distinct from 1 then return false; end if;
 l:=ls->0;
 if not nano_lifecycle_interno.nano_catalogo_parecer_confere(p_leitura,p_candidato,p_hash,session_user::text,l)
  or (l->>'verificadoEm')::timestamptz<(d->>'consultadoEm')::timestamptz or (l->>'verificadoEm')::timestamptz>statement_timestamp() then return false; end if;
 return nano_lifecycle_interno.nano_lifecycle_verificador_autorizado(p_loja,l->>'verificador');
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_pre_gate(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text) owner to nano_lifecycle_atualidade_leitor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_pre_gate(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text) from public,anon,authenticated,service_role,nano_lifecycle_produtor,nano_lifecycle_auditoria;
grant execute on function nano_lifecycle_interno.nano_lifecycle_pre_gate(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text) to nano_lifecycle_auditoria;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_atualidade_leitor;
commit;
