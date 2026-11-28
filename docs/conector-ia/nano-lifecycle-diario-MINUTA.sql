-- MINUTA exclusivamente para PostgreSQL descartável. Sem implantação.
begin;
create role nano_lifecycle_diario nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,nano_lifecycle_interno to nano_lifecycle_diario;
grant create on schema nano_lifecycle_interno to nano_lifecycle_diario;
grant select on public.produtos to nano_lifecycle_diario;
grant select,update(revisao,atualizado_em) on public.nano_lifecycle_checkpoint to nano_lifecycle_diario;
grant select,insert,update on public.nano_lifecycle_reserva to nano_lifecycle_diario;
grant select,insert on public.nano_lifecycle_execucoes,public.nano_lifecycle_capturas,public.nano_lifecycle_snapshots,public.nano_lifecycle_varreduras to nano_lifecycle_diario;
grant execute on function public.nano_lifecycle_fence(uuid,uuid,bigint),public.nano_lifecycle_projecao(uuid) to nano_lifecycle_diario;
create policy nano_diario_acesso on public.produtos for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.produtos as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_checkpoint for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_checkpoint as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_reserva for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_reserva as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_execucoes for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_execucoes as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_capturas for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_capturas as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_snapshots for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_snapshots as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_acesso on public.nano_lifecycle_varreduras for all to nano_lifecycle_diario using (true) with check (true);
create policy nano_diario_escopo on public.nano_lifecycle_varreduras as restrictive for all to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
-- Mantém leitura do servidor e somente o privilégio de lock exigido pelo
-- trigger do espelho; não permite trocar revisão nem estado da ativação.
revoke update(revisao) on public.nano_lifecycle_checkpoint from service_role;
revoke insert,update,delete,truncate on public.nano_lifecycle_reserva,public.nano_lifecycle_execucoes,public.nano_lifecycle_capturas,public.nano_lifecycle_snapshots,public.nano_lifecycle_varreduras from service_role;
-- Registrador de captura deixa de ser uma RPC pública. Somente finalização.
alter function public.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb) set schema nano_lifecycle_interno;
alter function nano_lifecycle_interno.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb) owner to nano_lifecycle_diario;
revoke all on function nano_lifecycle_interno.nano_lifecycle_registrar(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
alter function public.nano_lifecycle_reservar(uuid,uuid,integer) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_reservar(p_loja uuid,p_execucao uuid,p_segundos integer default 180)
returns jsonb language plpgsql security definer set search_path='' set nano.lifecycle_fence='' as $fn$
declare c public.nano_lifecycle_checkpoint; r public.nano_lifecycle_reserva; t timestamptz;
begin
 perform set_config('nano.lifecycle_fence',p_loja::text||':'||coalesce(p_execucao::text,'')||':0',true);
 if p_execucao is null or p_segundos is null or p_segundos not between 10 and 300 then raise exception 'reserva inválida'; end if;
 select * into c from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not c.habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into r from public.nano_lifecycle_reserva where loja_id=p_loja for update;
 t:=clock_timestamp();
 if found and not r.encerrada and r.expira_em>t then
  if r.execucao=p_execucao then return jsonb_build_object('estado','reservado','geracao',r.geracao,'expira_em',r.expira_em); end if;
  return jsonb_build_object('estado','ocupado');
 end if;
 -- O histórico sobrevive às trocas de geração; uma execução encerrada nunca
 -- volta a ser titular, mesmo após várias outras reservas.
 if exists(select 1 from public.nano_lifecycle_execucoes h where h.loja_id=p_loja and h.execucao=p_execucao) then
  return jsonb_build_object('estado','execucao_encerrada');
 end if;
 insert into public.nano_lifecycle_reserva(loja_id,geracao,execucao,expira_em,encerrada)
 values(p_loja,coalesce(r.geracao,0)+1,p_execucao,t+make_interval(secs=>p_segundos),false)
 on conflict(loja_id) do update set geracao=excluded.geracao,execucao=excluded.execucao,expira_em=excluded.expira_em,encerrada=false
 returning * into r;
 insert into public.nano_lifecycle_execucoes(loja_id,execucao,geracao) values(p_loja,p_execucao,r.geracao);
 return jsonb_build_object('estado','reservado','geracao',r.geracao,'expira_em',r.expira_em);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_reservar(uuid,uuid,integer) owner to nano_lifecycle_diario;
revoke all on function nano_lifecycle_interno.nano_lifecycle_reservar(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_reservar(uuid,uuid,integer) to service_role;
create function public.nano_lifecycle_reservar(p_loja uuid,p_execucao uuid,p_segundos integer default 180) returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_reservar(p_loja,p_execucao,p_segundos)
$fn$;
revoke all on function public.nano_lifecycle_reservar(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_reservar(uuid,uuid,integer) to service_role;
alter function public.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(p_loja uuid,p_execucao uuid,p_geracao bigint)
returns boolean language plpgsql security definer set search_path='' set nano.lifecycle_fence='' as $fn$
begin
 perform set_config('nano.lifecycle_fence',p_loja::text||':'||coalesce(p_execucao::text,'')||':0',true);
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then return false; end if;
 update public.nano_lifecycle_reserva set encerrada=true where loja_id=p_loja and execucao=p_execucao and geracao=p_geracao;
 return found;
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) owner to nano_lifecycle_diario;
revoke all on function nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) to service_role;
create function public.nano_lifecycle_encerrar_reserva(p_loja uuid,p_execucao uuid,p_geracao bigint) returns boolean language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(p_loja,p_execucao,p_geracao)
$fn$;
revoke all on function public.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) to service_role;
alter function public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_registrar_varredura(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_grupos jsonb
) returns jsonb language plpgsql security definer set search_path='' set nano.lifecycle_fence='' as $fn$
declare g text; paginas jsonb; pagina jsonb; i integer; n integer;
 vistos text[]:=array[]::text[]; v jsonb; idv text; cand jsonb; digest_atual text; anterior public.nano_lifecycle_varreduras;
begin
 perform set_config('nano.lifecycle_fence',p_loja::text||':'||coalesce(p_execucao::text,'')||':0',true);
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva inválida' using errcode='42501'; end if;
 if p_grupos is null or jsonb_typeof(p_grupos)<>'object' or not(p_grupos ?& array['ativos','inativos','excluidos']) or (p_grupos-array['ativos','inativos','excluidos'])<>'{}'::jsonb then raise exception 'grupos incompletos'; end if;
 foreach g in array array['ativos','inativos','excluidos'] loop
  paginas:=p_grupos->g;
  if jsonb_typeof(paginas) is distinct from 'array' then raise exception 'páginas inválidas'; end if;
  n:=jsonb_array_length(paginas);
  if n<1 or n>51 then raise exception 'quantidade de páginas inválida'; end if;
  for i in 0..n-1 loop
   pagina:=paginas->i;
   if jsonb_typeof(pagina) is distinct from 'array' then raise exception 'página inválida'; end if;
   if (i<n-1 and jsonb_array_length(pagina)<>100) or (i=n-1 and jsonb_array_length(pagina)>=100) then raise exception 'paginação incompleta'; end if;
   for v in select value from jsonb_array_elements(pagina) loop
    idv:=v#>>'{}';
    if jsonb_typeof(v) is distinct from 'string' or coalesce(idv,'') !~ '^[1-9][0-9]{0,15}$' or idv=any(vistos) then raise exception 'ID inválido ou repetido'; end if;
    -- Grupo informado deve coincidir com a situação efetivamente espelhada.
    if not exists(select 1 from public.produtos p where p.loja_id=p_loja and p.bling_id=idv and p.situacao=case g when 'ativos' then 'A' when 'inativos' then 'I' else 'E' end) then raise exception 'situação observada diverge do espelho'; end if;
    vistos:=array_append(vistos,idv);
    if cardinality(vistos)>5000 then raise exception 'varredura excede limite'; end if;
   end loop;
  end loop;
 end loop;
 if cardinality(vistos)=0 and exists(select 1 from public.produtos where loja_id=p_loja) then raise exception 'varredura vazia inesperada'; end if;
 if exists(select 1 from unnest(vistos) x(bling_id) where not exists(select 1 from public.produtos p where p.loja_id=p_loja and p.bling_id=x.bling_id)) then raise exception 'ID observado sem espelho'; end if;
 -- Hash interno PostgreSQL: detecta mudança entre evidência e finalização.
 -- Não é o digest canônico TypeScript e não substitui a prova da origem ERP.
 if jsonb_array_length(public.nano_lifecycle_projecao(p_loja))>5000 then raise exception 'projeção excede limite'; end if;
 digest_atual:=encode(sha256(convert_to(public.nano_lifecycle_projecao(p_loja)::text,'UTF8')),'hex');
 select * into anterior from public.nano_lifecycle_varreduras where loja_id=p_loja and execucao=p_execucao;
 if found then
  if anterior.geracao<>p_geracao or anterior.grupos<>p_grupos or anterior.digest_projecao<>digest_atual then raise exception 'varredura divergente'; end if;
  return jsonb_build_object('estado','ja_registrada','candidatos',anterior.candidatos);
 end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.bling_id),'[]'::jsonb) into cand
 from (select id as produto_id,bling_id,sku,situacao from public.produtos where loja_id=p_loja and situacao is distinct from 'ausente' and not(bling_id=any(vistos)) order by bling_id limit 5001) t;
 if jsonb_array_length(cand)>5000 then raise exception 'candidatos excedem limite'; end if;
 insert into public.nano_lifecycle_varreduras(loja_id,execucao,geracao,grupos,candidatos,digest_projecao) values(p_loja,p_execucao,p_geracao,p_grupos,cand,digest_atual);
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva perdida durante varredura'; end if;
 return jsonb_build_object('estado','registrada','candidatos',cand);
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) owner to nano_lifecycle_diario;
revoke all on function nano_lifecycle_interno.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) to service_role;
create function public.nano_lifecycle_registrar_varredura(p_loja uuid,p_execucao uuid,p_geracao bigint,p_grupos jsonb) returns jsonb language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_registrar_varredura(p_loja,p_execucao,p_geracao,p_grupos)
$fn$;
revoke all on function public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) to service_role;
alter function public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) set schema nano_lifecycle_interno;
create or replace function nano_lifecycle_interno.nano_lifecycle_finalizar(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_revisao text,p_predecessor text,p_estado text,
 p_eventos jsonb,p_bloqueios jsonb,p_digest text,p_produtos jsonb
) returns text language plpgsql security definer set search_path='' set nano.lifecycle_fence='' as $fn$
declare atual jsonb; resposta text; evid public.nano_lifecycle_varreduras;
begin
 perform set_config('nano.lifecycle_fence',p_loja::text||':'||coalesce(p_execucao::text,'')||':0',true);
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then return 'reserva_invalida'; end if;
 if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' or p_produtos is null or jsonb_typeof(p_produtos)<>'array' then raise exception 'snapshot inválido'; end if;
 atual:=public.nano_lifecycle_projecao(p_loja);
 if jsonb_array_length(atual)>5000 or atual is distinct from p_produtos then return 'snapshot_divergente'; end if;
 -- Sem evidência, candidatos pendentes ou projeção alterada: não avança.
 select * into evid from public.nano_lifecycle_varreduras where loja_id=p_loja and execucao=p_execucao and geracao=p_geracao;
 if not found then return 'varredura_nao_confirmada'; end if;
 if evid.candidatos<>'[]'::jsonb then return 'ausencias_pendentes'; end if;
 if evid.digest_projecao is distinct from encode(sha256(convert_to(atual::text,'UTF8')),'hex') then return 'varredura_divergente'; end if;
 -- Não permitir avanço a partir de uma captura que não tem snapshot correspondente.
 if p_predecessor is not null and not exists(select 1 from public.nano_lifecycle_snapshots where loja_id=p_loja and revisao=p_predecessor) then return 'predecessor_sem_snapshot'; end if;
 if not nano_lifecycle_interno.conferir_eventos(p_loja,p_revisao,p_predecessor,atual,p_eventos,p_bloqueios) then return 'eventos_divergentes'; end if;
 resposta:=nano_lifecycle_interno.nano_lifecycle_registrar(p_loja,p_revisao,p_predecessor,p_estado,p_eventos,p_bloqueios);
 if resposta<>'gravado' then return resposta; end if;
 insert into public.nano_lifecycle_snapshots(loja_id,revisao,execucao,geracao,digest,produtos)
 values(p_loja,p_revisao,p_execucao,p_geracao,p_digest,atual);
 if not nano_lifecycle_interno.nano_lifecycle_encerrar_reserva(p_loja,p_execucao,p_geracao) then raise exception 'reserva perdida durante finalização'; end if;
 return 'gravado';
end $fn$;
alter function nano_lifecycle_interno.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) owner to nano_lifecycle_diario;
revoke all on function nano_lifecycle_interno.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) to service_role;
create function public.nano_lifecycle_finalizar(p_loja uuid,p_execucao uuid,p_geracao bigint,p_revisao text,p_predecessor text,p_estado text,p_eventos jsonb,p_bloqueios jsonb,p_digest text,p_produtos jsonb) returns text language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_finalizar(p_loja,p_execucao,p_geracao,p_revisao,p_predecessor,p_estado,p_eventos,p_bloqueios,p_digest,p_produtos)
$fn$;
revoke all on function public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) to service_role;
revoke execute on function public.nano_lifecycle_fence(uuid,uuid,bigint) from service_role;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_diario;
commit;
