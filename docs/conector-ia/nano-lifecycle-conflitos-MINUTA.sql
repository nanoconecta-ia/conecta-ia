-- MINUTA de CI descartável. Conflitos Nano aguardam autoridade própria.
begin;
create function nano_lifecycle_interno.proteger_conflitos_fila() returns trigger
language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op='TRUNCATE' then raise exception 'TRUNCATE de conflitos bloqueado' using errcode='42501'; end if;
 if tg_op in ('UPDATE','DELETE') then
  if exists(select 1 from public.pipeline_itens i where i.id=old.item_id and i.loja_id=old.loja_id and i.entrada->>'origem'='nano_lifecycle') then raise exception 'conflito Nano exige autoridade homologada' using errcode='42501'; end if;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  if exists(select 1 from public.pipeline_itens i where i.id=new.item_id and i.loja_id=new.loja_id and i.entrada->>'origem'='nano_lifecycle') then raise exception 'conflito Nano exige autoridade homologada' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.proteger_conflitos_fila() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_proteger_conflitos before insert or update or delete on public.pipeline_conflitos for each row execute function nano_lifecycle_interno.proteger_conflitos_fila();
create trigger nano_lifecycle_conflitos_truncate before truncate on public.pipeline_conflitos for each statement execute function nano_lifecycle_interno.proteger_conflitos_fila();
commit;
