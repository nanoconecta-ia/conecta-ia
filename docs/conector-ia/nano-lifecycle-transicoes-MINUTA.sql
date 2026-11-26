-- MINUTA somente CI descartável. Bloqueio temporário fail-closed de
-- transições e lançamentos Nano até existir consumidor com autoridade própria.
begin;
create function nano_lifecycle_interno.bloquear_transicao_legada()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op='TRUNCATE' then
  if exists(select 1 from public.pipeline_itens where entrada->>'origem'='nano_lifecycle') then raise exception 'fila Nano protegida' using errcode='42501'; end if;
  return null;
 end if;
 if tg_op='INSERT' then
  if new.entrada->>'origem'='nano_lifecycle' and (new.estado<>'entrada' or new.versao<>1 or new.tentativas<>0 or new.resultado<>'{}'::jsonb or new.proposta_id is not null or new.reservado_ate is not null or new.nano_execucao is not null or new.nano_geracao<>0 or new.erro is not null) then raise exception 'entrada Nano fora do contrato' using errcode='42501'; end if;
  return new;
 end if;
 if tg_op='DELETE' then
  if old.entrada->>'origem'='nano_lifecycle' and pg_trigger_depth()<=1 then raise exception 'exclusão direta Nano bloqueada' using errcode='42501'; end if;
  return old;
 end if;
 if old.entrada->>'origem'='nano_lifecycle' or new.entrada->>'origem'='nano_lifecycle' then
  -- Lease/geração ainda são alterados pelas RPCs de reserva. Demais campos
  -- imutáveis nesta fase. Nem pipeline_avancar/falhar nem DML direto avançam.
  if row(old.id,old.loja_id,old.produto_id,old.sku,old.estado,old.versao,old.entrada,old.resultado,old.tentativas,old.proxima_tentativa,old.erro,old.proposta_id,old.idempotency_key,old.criado_em,old.atualizado_em)
  is distinct from row(new.id,new.loja_id,new.produto_id,new.sku,new.estado,new.versao,new.entrada,new.resultado,new.tentativas,new.proxima_tentativa,new.erro,new.proposta_id,new.idempotency_key,new.criado_em,new.atualizado_em) then
   raise exception 'transição Nano exige consumidor homologado' using errcode='42501';
  end if;
 end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.bloquear_transicao_legada() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_bloquear_transicao before insert or update or delete on public.pipeline_itens for each row execute function nano_lifecycle_interno.bloquear_transicao_legada();
create trigger nano_lifecycle_bloquear_truncate before truncate on public.pipeline_itens for each statement execute function nano_lifecycle_interno.bloquear_transicao_legada();
create function nano_lifecycle_interno.bloquear_custo_legado()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if tg_op in ('UPDATE','DELETE') then
  if exists(select 1 from public.pipeline_itens i where i.id=old.item_id and i.loja_id=old.loja_id and i.entrada->>'origem'='nano_lifecycle') then
   raise exception 'custo Nano exige reserva de operação homologada' using errcode='42501';
  end if;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  if exists(select 1 from public.pipeline_itens i where i.id=new.item_id and i.loja_id=new.loja_id and i.entrada->>'origem'='nano_lifecycle') then
   raise exception 'custo Nano exige reserva de operação homologada' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $fn$;
revoke all on function nano_lifecycle_interno.bloquear_custo_legado() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_bloquear_custo before insert or update or delete on public.pipeline_custos for each row execute function nano_lifecycle_interno.bloquear_custo_legado();
commit;
