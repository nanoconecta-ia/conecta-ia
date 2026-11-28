-- MINUTA exclusivamente CI descartável. Não executa pesquisa ou transição de estado.
begin;
alter table public.nano_lifecycle_checkpoint add column consumo_habilitado boolean not null default false;
alter table public.pipeline_itens add column nano_execucao uuid, add column nano_geracao bigint not null default 0 check(nano_geracao>=0);
-- O consumidor legado não pode tomar tarefas Nano, mesmo quando elegíveis.
create or replace function public.pipeline_reservar(p_loja uuid, p_limite int default 10, p_lease_s int default 120, p_max_simultaneos int default 5)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare v_ativos int; v_vagas int;
begin
  select count(*) into v_ativos from public.pipeline_itens where loja_id = p_loja and reservado_ate > now();
  v_vagas := least(greatest(p_limite, 0), greatest(p_max_simultaneos - v_ativos, 0));
  if v_vagas = 0 then return; end if;
  return query
    with c as (
      select id from public.pipeline_itens
      where loja_id = p_loja and (entrada->>'origem') is distinct from 'nano_lifecycle' and estado not in ('sincronizado', 'rejeitado', 'falhou', 'aguardando_aprovacao', 'conflito')
        and proxima_tentativa <= now() and (reservado_ate is null or reservado_ate <= now())
      order by proxima_tentativa, criado_em limit v_vagas for update skip locked)
    update public.pipeline_itens i set reservado_ate = now() + make_interval(secs => p_lease_s) from c where i.id = c.id returning i.id;
end $$;


create function public.nano_lifecycle_reivindicar(p_loja uuid,p_item uuid,p_execucao uuid,p_segundos integer default 120)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare cp public.nano_lifecycle_checkpoint; i public.pipeline_itens; r jsonb; t timestamptz; restante numeric;
begin
 if p_execucao is null or p_segundos is null or p_segundos not between 10 and 180 then raise exception 'reserva inválida'; end if;
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado or not cp.consumo_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle';
 if not found then return jsonb_build_object('estado','item_inexistente'); end if;
 if i.estado<>'entrada' then return jsonb_build_object('estado','estado_invalido'); end if;
 -- Revalida a identidade, revisão técnica, pausa e vínculo ao evento capturado.
 -- Encaminhar pode criar item se outro escritor removê-lo entre as leituras;
 -- qualquer resultado diferente do item existente provoca rollback ou recusa.
 r:=public.nano_lifecycle_encaminhar(p_loja,i.entrada->>'revisao',i.idempotency_key);
 if r->>'estado'='encaminhado' then raise exception 'item desapareceu durante reivindicação'; end if;
 if r->>'estado'<>'ja_encaminhado' then return r; end if;
 if r->>'item_id' is distinct from p_item::text then raise exception 'item divergente'; end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item for update;
 if not found or i.estado<>'entrada' or i.entrada->>'origem' is distinct from 'nano_lifecycle' then return jsonb_build_object('estado','estado_invalido'); end if;
 t:=clock_timestamp();
 if i.reservado_ate>t then return jsonb_build_object('estado','ocupado'); end if;
 if i.proxima_tentativa>t then return jsonb_build_object('estado','aguardar'); end if;
 if i.nano_execucao=p_execucao then return jsonb_build_object('estado','execucao_reutilizada'); end if;
 -- Limite conservador: apenas uma reserva Nano ativa por loja neste piloto.
 if exists(select 1 from public.pipeline_itens where loja_id=p_loja and id<>p_item and entrada->>'origem'='nano_lifecycle' and reservado_ate>t) then return jsonb_build_object('estado','ocupado'); end if;
 restante:=(public.pipeline_orcamento_estado(p_loja)->>'restante_usd')::numeric;
 if restante is null or restante<=0 then return jsonb_build_object('estado','orcamento_indisponivel'); end if;
 update public.pipeline_itens set nano_execucao=p_execucao,nano_geracao=nano_geracao+1,reservado_ate=t+make_interval(secs=>p_segundos)
 where id=p_item and loja_id=p_loja returning * into i;
 return jsonb_build_object('estado','reservado','item_id',i.id,'geracao',i.nano_geracao,'versao',i.versao,'expira_em',i.reservado_ate);
end $fn$;
-- Libera somente a própria reserva, não altera etapa, custo ou evidências.
create function public.nano_lifecycle_liberar_item(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns boolean language plpgsql security invoker set search_path='' as $fn$
begin
 update public.pipeline_itens set reservado_ate=null where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle'
 and nano_execucao=p_execucao and nano_geracao=p_geracao and versao=p_versao and reservado_ate>clock_timestamp();
 return found;
end $fn$;
revoke all on function public.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer),public.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_reivindicar(uuid,uuid,uuid,integer),public.nano_lifecycle_liberar_item(uuid,uuid,uuid,bigint,integer) to service_role;
commit;
