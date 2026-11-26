-- MINUTA exclusiva do CI. Papel sem login, sem membership do serviço,
-- sem bypass de RLS e sem privilégios administrativos.
begin;
create role nano_lifecycle_escritor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema nano_lifecycle_interno;
revoke all on schema nano_lifecycle_interno from public,anon,authenticated,service_role;
grant usage on schema public to nano_lifecycle_escritor;
grant usage on schema nano_lifecycle_interno to service_role,nano_lifecycle_escritor;
grant create on schema nano_lifecycle_interno to nano_lifecycle_escritor;
grant select on public.produtos to nano_lifecycle_escritor;
grant insert(loja_id,bling_id,sku,nome,preco,estoque,situacao,categoria_bling_id,marca,gtin,gtin_tributario,descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,unidade,condicao,formato,pai_bling_id,volumes,sincronizado_em,publicado),update(sku,nome,preco,estoque,situacao,categoria_bling_id,marca,gtin,gtin_tributario,descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,unidade,condicao,formato,pai_bling_id,volumes,sincronizado_em,publicado) on public.produtos to nano_lifecycle_escritor;
grant select,update(atualizado_em) on public.nano_lifecycle_checkpoint to nano_lifecycle_escritor;
grant select,update(encerrada) on public.nano_lifecycle_reserva to nano_lifecycle_escritor;
grant execute on function public.nano_lifecycle_fence(uuid,uuid,bigint) to nano_lifecycle_escritor;
-- O papel só pode ler/escrever linhas do escopo transitório definido pelas
-- funções estreitas. A política restritiva também vale se existir policy PUBLIC.
create policy nano_escritor_acesso on public.produtos for all to nano_lifecycle_escritor using (true) with check (true);
create policy nano_escritor_escopo on public.produtos as restrictive for all to nano_lifecycle_escritor using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_escritor_acesso on public.nano_lifecycle_checkpoint for all to nano_lifecycle_escritor using (true) with check (true);
create policy nano_escritor_escopo on public.nano_lifecycle_checkpoint as restrictive for all to nano_lifecycle_escritor using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_escritor_acesso on public.nano_lifecycle_reserva for all to nano_lifecycle_escritor using (true) with check (true);
create policy nano_escritor_escopo on public.nano_lifecycle_reserva as restrictive for all to nano_lifecycle_escritor using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1)) with check (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
-- O serviço não pode desativar a proteção por UPDATE direto de habilitado.
-- Ainda conserva update de revisão para o registrador atual, a isolar depois.
revoke insert,update on public.nano_lifecycle_checkpoint from service_role;
grant update(revisao,atualizado_em) on public.nano_lifecycle_checkpoint to service_role;
-- Implementação interna de autoridade restrita, não exposta pelo Data API.
alter function public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) set schema nano_lifecycle_interno;
alter function nano_lifecycle_interno.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) security definer;
alter function nano_lifecycle_interno.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) owner to nano_lifecycle_escritor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) to service_role;
create function public.nano_lifecycle_gravar_tecnico(p_loja uuid,p_execucao uuid,p_geracao bigint,p_linhas jsonb)
returns integer language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_gravar_tecnico(p_loja,p_execucao,p_geracao,p_linhas)
$fn$;
revoke all on function public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) to service_role;
-- Implementação interna de autoridade restrita, não exposta pelo Data API.
alter function public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) set schema nano_lifecycle_interno;
alter function nano_lifecycle_interno.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) security definer;
alter function nano_lifecycle_interno.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) owner to nano_lifecycle_escritor;
revoke all on function nano_lifecycle_interno.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) to service_role;
create function public.nano_lifecycle_gravar_espelho(p_loja uuid,p_execucao uuid,p_geracao bigint,p_linhas jsonb)
returns integer language sql security invoker set search_path='' as $fn$
 select nano_lifecycle_interno.nano_lifecycle_gravar_espelho(p_loja,p_execucao,p_geracao,p_linhas)
$fn$;
revoke all on function public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) to service_role;
revoke create on schema nano_lifecycle_interno from nano_lifecycle_escritor;
commit;
