-- MINUTA: CI descartável. Exige papel interno restrito e fence válido.
-- Administradores do banco continuam sendo autoridade de manutenção.
begin;
create function public.nano_lifecycle_guard_espelho()
returns trigger language plpgsql security invoker set search_path='' as $fn$
declare loja uuid; ativo boolean; token text; partes text[];
begin
 if tg_op='TRUNCATE' then
  if exists(select 1 from public.nano_lifecycle_checkpoint where habilitado) then raise exception 'espelho protegido contra truncate' using errcode='42501'; end if;
  return null;
 end if;
 if tg_op='UPDATE' then
  -- Não interferir nas rotinas existentes de publicação, taxonomia e proteção fiscal.
  if row(old.id,old.loja_id,old.bling_id,old.sku,old.nome,old.preco,old.estoque,old.situacao,old.categoria_bling_id,old.marca,old.gtin,old.gtin_tributario,old.descricao_curta,old.descricao_complementar,old.peso_kg,old.largura_cm,old.altura_cm,old.profundidade_cm,old.unidade,old.condicao,old.formato,old.pai_bling_id,old.volumes,old.sincronizado_em) is not distinct from row(new.id,new.loja_id,new.bling_id,new.sku,new.nome,new.preco,new.estoque,new.situacao,new.categoria_bling_id,new.marca,new.gtin,new.gtin_tributario,new.descricao_curta,new.descricao_complementar,new.peso_kg,new.largura_cm,new.altura_cm,new.profundidade_cm,new.unidade,new.condicao,new.formato,new.pai_bling_id,new.volumes,new.sincronizado_em) then return new; end if;
  if old.id is distinct from new.id or old.loja_id is distinct from new.loja_id or old.bling_id is distinct from new.bling_id then
   -- Bloqueia movimento de identidade em qualquer loja habilitada.
   if exists(select 1 from public.nano_lifecycle_checkpoint where loja_id in(old.loja_id,new.loja_id) and habilitado for update nowait) then raise exception 'identidade protegida' using errcode='42501'; end if;
   return new;
  end if;
 end if;
 loja:=case when tg_op='DELETE' then old.loja_id else new.loja_id end;
 -- NOWAIT evita inverter a ordem checkpoint -> produto sob disputa:
 -- writer direto não fica esperando checkpoint com linha de produto bloqueada.
 select habilitado into ativo from public.nano_lifecycle_checkpoint where loja_id=loja for update nowait;
 if not found or not ativo then
  if tg_op='DELETE' then return old; end if;
  return new;
 end if;
 if tg_op='DELETE' then raise exception 'exclusão física protegida' using errcode='42501'; end if;
 if current_user<>'nano_lifecycle_escritor' then raise exception 'papel de escrita não autorizado' using errcode='42501'; end if;
 token:=current_setting('nano.lifecycle_fence',true);
 partes:=string_to_array(coalesce(token,''),':');
 if coalesce(cardinality(partes),0)<>3 or partes[1] is distinct from loja::text then raise exception 'gravação direta do espelho bloqueada' using errcode='42501'; end if;
 if not public.nano_lifecycle_fence(loja,partes[2]::uuid,partes[3]::bigint) then raise exception 'fence do escritor inválido' using errcode='42501'; end if;
 return new;
end $fn$;
revoke all on function public.nano_lifecycle_guard_espelho() from public,anon,authenticated,service_role;
create trigger zz_nano_lifecycle_guard_espelho before insert or update or delete on public.produtos
for each row execute function public.nano_lifecycle_guard_espelho();
create trigger zz_nano_lifecycle_guard_truncate before truncate on public.produtos
for each statement execute function public.nano_lifecycle_guard_espelho();
commit;
