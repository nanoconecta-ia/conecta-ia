-- MINUTA: somente CI descartável, após caracterização legada. Não é migração de produção.
begin;
create role nano_financeiro_escritor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema nano_financeiro_interno;
revoke all on schema nano_financeiro_interno from public,anon,authenticated,service_role;
grant usage on schema public to nano_financeiro_escritor;
grant usage on schema nano_financeiro_interno to nano_financeiro_escritor,service_role;
grant create on schema nano_financeiro_interno to nano_financeiro_escritor;
-- O serviço conserva leitura; perde DML, TRUNCATE e TRIGGER diretos.
revoke all on public.pipeline_orcamentos,public.pipeline_custos from service_role;
grant select on public.pipeline_orcamentos,public.pipeline_custos to service_role;
grant select on public.pipeline_orcamentos,public.pipeline_custos to nano_financeiro_escritor;
grant insert(loja_id,item_id,mes,capacidade,tipo,fonte,usd,estado,duracao_ms),
 update(usd,chamadas,tokens_in,tokens_out,duracao_ms,estado) on public.pipeline_custos to nano_financeiro_escritor;
grant usage on sequence public.pipeline_custos_id_seq to nano_financeiro_escritor;
-- O trigger legado SECURITY INVOKER consulta somente id, loja_id e entrada.
-- Manter o guardião ativo, sem ampliar DML, sem BYPASSRLS e sem leitura de outras lojas.
grant select(id,loja_id,entrada) on public.pipeline_itens to nano_financeiro_escritor;
create policy nano_financeiro_le_origem on public.pipeline_itens for select to nano_financeiro_escritor
 using(loja_id::text=coalesce(current_setting('nano.financeiro_loja',true),''));
create policy nano_financeiro_escopo_origem on public.pipeline_itens as restrictive for select to nano_financeiro_escritor
 using(loja_id::text=coalesce(current_setting('nano.financeiro_loja',true),''));
create policy nano_financeiro_le_orcamento on public.pipeline_orcamentos for select to nano_financeiro_escritor using(true);
create policy nano_financeiro_le_custo on public.pipeline_custos for select to nano_financeiro_escritor using(true);
create policy nano_financeiro_ins_custo on public.pipeline_custos for insert to nano_financeiro_escritor with check(true);
create policy nano_financeiro_conf_custo on public.pipeline_custos for update to nano_financeiro_escritor using(estado='reservado') with check(estado='confirmado');
-- Diário novo: identidade, valor anterior, real e excesso observado; sem backfill inferido.
create table nano_financeiro_interno.diario(
 custo_id bigint not null references public.pipeline_custos(id) on delete restrict,
 evento text not null check(evento in ('reserva','confirmacao','registro_zero')),
 loja_id uuid not null, mes date not null,
 reservado_usd numeric(12,6) not null check(reservado_usd>=0),
 real_usd numeric(12,6) check(real_usd>=0),
 limite_usd numeric(12,4),
 saldo_usd numeric,
 registrado_em timestamptz not null default clock_timestamp(),
 primary key(custo_id,evento)
);
alter table nano_financeiro_interno.diario enable row level security;
revoke all on nano_financeiro_interno.diario from public,anon,authenticated,service_role;
grant insert on nano_financeiro_interno.diario to nano_financeiro_escritor;
create policy nano_financeiro_append on nano_financeiro_interno.diario for insert to nano_financeiro_escritor with check(true);
-- Mesma chave legada, isolamento forte recusado para evitar snapshot obsoleto após espera.
create function nano_financeiro_interno.travar(p_loja uuid,p_mes date)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'isolamento financeiro exige read committed' using errcode='25001';
 end if;
 if p_loja is null or p_mes is null then raise exception 'escopo financeiro inválido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('pipeline_orcamento:'||p_loja::text||p_mes::text,0));
end $$;
revoke all on function nano_financeiro_interno.travar(uuid,date) from public,anon,authenticated,service_role;
grant execute on function nano_financeiro_interno.travar(uuid,date) to nano_financeiro_escritor;
create function nano_financeiro_interno.reservar(p_loja uuid,p_item uuid,p_capacidade text,p_tipo text,p_fonte text,p_usd_estimado numeric)
returns bigint language plpgsql security definer set search_path='' set nano.financeiro_loja='' as $$
declare m date:=date_trunc('month',now())::date; teto numeric; gasto numeric; estimado numeric(12,6); novo bigint;
begin
 if p_usd_estimado is null or p_usd_estimado<0 or p_usd_estimado::text in ('NaN','Infinity','-Infinity') then raise exception 'estimativa inválida' using errcode='22023'; end if;
 -- Arredonda para cima na precisão do razão, nunca autoriza fração positiva como zero.
 estimado:=ceil(p_usd_estimado*1000000)/1000000;
 perform nano_financeiro_interno.travar(p_loja,m);
 perform set_config('nano.financeiro_loja',p_loja::text,true);
 select limite_usd into teto from public.pipeline_orcamentos where loja_id=p_loja and mes=m;
 if teto is null then return null; end if;
 select coalesce(sum(usd),0) into gasto from public.pipeline_custos where loja_id=p_loja and mes=m;
 if gasto>teto or gasto+estimado>teto then return null; end if;
 insert into public.pipeline_custos(loja_id,item_id,mes,capacidade,tipo,fonte,usd,estado)
 values(p_loja,p_item,m,p_capacidade,p_tipo,p_fonte,estimado,'reservado') returning id into novo;
 insert into nano_financeiro_interno.diario(custo_id,evento,loja_id,mes,reservado_usd,limite_usd,saldo_usd)
 values(novo,'reserva',p_loja,m,estimado,teto,teto-gasto-estimado);
 return novo;
end $$;
create function nano_financeiro_interno.confirmar(p_loja uuid,p_custo bigint,p_usd_real numeric,p_chamadas int,p_tokens_in bigint,p_tokens_out bigint,p_duracao_ms int)
returns void language plpgsql security definer set search_path='' set nano.financeiro_loja='' as $$
declare m date; anterior numeric; realvalor numeric(12,6); teto numeric; gasto numeric;
begin
 if p_usd_real is null or p_usd_real<0 or p_usd_real::text in ('NaN','Infinity','-Infinity') then raise exception 'custo real inválido' using errcode='22023'; end if;
 realvalor:=p_usd_real;
 -- A confirmação pertence ao mês original da reserva, não ao mês de processamento.
 select mes into m from public.pipeline_custos where id=p_custo and loja_id=p_loja and estado='reservado';
 if not found then raise exception 'reserva de custo inexistente nesta loja' using errcode='P0002'; end if;
 perform nano_financeiro_interno.travar(p_loja,m);
 perform set_config('nano.financeiro_loja',p_loja::text,true);
 select usd into anterior from public.pipeline_custos where id=p_custo and loja_id=p_loja and mes=m and estado='reservado';
 if not found then raise exception 'reserva de custo inexistente nesta loja' using errcode='P0002'; end if;
 update public.pipeline_custos set usd=realvalor,chamadas=p_chamadas,tokens_in=p_tokens_in,tokens_out=p_tokens_out,duracao_ms=p_duracao_ms,estado='confirmado'
 where id=p_custo and loja_id=p_loja and mes=m and estado='reservado';
 if not found then raise exception 'reserva de custo inexistente nesta loja' using errcode='P0002'; end if;
 select limite_usd into teto from public.pipeline_orcamentos where loja_id=p_loja and mes=m;
 select coalesce(sum(usd),0) into gasto from public.pipeline_custos where loja_id=p_loja and mes=m;
 -- Não esconder gasto real já incorrido: excesso vira saldo negativo e bloqueia reserva posterior.
 insert into nano_financeiro_interno.diario(custo_id,evento,loja_id,mes,reservado_usd,real_usd,limite_usd,saldo_usd)
 values(p_custo,'confirmacao',p_loja,m,anterior,realvalor,teto,teto-gasto);
end $$;
create function nano_financeiro_interno.registrar_zero(p_loja uuid,p_item uuid,p_capacidade text,p_tipo text,p_fonte text,p_duracao_ms int)
returns bigint language plpgsql security definer set search_path='' set nano.financeiro_loja='' as $$
declare m date:=date_trunc('month',now())::date; novo bigint;
begin
 perform nano_financeiro_interno.travar(p_loja,m);
 perform set_config('nano.financeiro_loja',p_loja::text,true);
 insert into public.pipeline_custos(loja_id,item_id,mes,capacidade,tipo,fonte,usd,estado,duracao_ms)
 values(p_loja,p_item,m,p_capacidade,p_tipo,p_fonte,0,'confirmado',p_duracao_ms) returning id into novo;
 insert into nano_financeiro_interno.diario(custo_id,evento,loja_id,mes,reservado_usd,real_usd)
 values(novo,'registro_zero',p_loja,m,0,0);
 return novo;
end $$;
alter function nano_financeiro_interno.reservar(uuid,uuid,text,text,text,numeric) owner to nano_financeiro_escritor;
alter function nano_financeiro_interno.confirmar(uuid,bigint,numeric,int,bigint,bigint,int) owner to nano_financeiro_escritor;
alter function nano_financeiro_interno.registrar_zero(uuid,uuid,text,text,text,int) owner to nano_financeiro_escritor;
revoke all on function nano_financeiro_interno.reservar(uuid,uuid,text,text,text,numeric),nano_financeiro_interno.confirmar(uuid,bigint,numeric,int,bigint,bigint,int),nano_financeiro_interno.registrar_zero(uuid,uuid,text,text,text,int) from public,anon,authenticated,service_role;
grant execute on function nano_financeiro_interno.reservar(uuid,uuid,text,text,text,numeric),nano_financeiro_interno.confirmar(uuid,bigint,numeric,int,bigint,bigint,int),nano_financeiro_interno.registrar_zero(uuid,uuid,text,text,text,int) to service_role;
revoke create on schema nano_financeiro_interno from nano_financeiro_escritor;
-- Mantém assinaturas públicas e o contrato de retorno legado, invoker sem poder de escrita.
create or replace function public.pipeline_custo_tentar(p_loja uuid,p_item uuid,p_capacidade text,p_tipo text,p_fonte text,p_usd_estimado numeric)
returns bigint language sql security invoker set search_path='' as $$
 select nano_financeiro_interno.reservar(p_loja,p_item,p_capacidade,p_tipo,p_fonte,p_usd_estimado)
$$;
create or replace function public.pipeline_custo_confirmar(p_loja uuid,p_custo bigint,p_usd_real numeric,p_chamadas int,p_tokens_in bigint,p_tokens_out bigint,p_duracao_ms int)
returns void language sql security invoker set search_path='' as $$
 select nano_financeiro_interno.confirmar(p_loja,p_custo,p_usd_real,p_chamadas,p_tokens_in,p_tokens_out,p_duracao_ms)
$$;
create or replace function public.pipeline_custo_registrar(p_loja uuid,p_item uuid,p_capacidade text,p_tipo text,p_fonte text,p_duracao_ms int)
returns bigint language sql security invoker set search_path='' as $$
 select nano_financeiro_interno.registrar_zero(p_loja,p_item,p_capacidade,p_tipo,p_fonte,p_duracao_ms)
$$;
revoke all on function public.pipeline_custo_tentar(uuid,uuid,text,text,text,numeric),public.pipeline_custo_confirmar(uuid,bigint,numeric,int,bigint,bigint,int),public.pipeline_custo_registrar(uuid,uuid,text,text,text,int) from public,anon,authenticated,service_role;
grant execute on function public.pipeline_custo_tentar(uuid,uuid,text,text,text,numeric),public.pipeline_custo_confirmar(uuid,bigint,numeric,int,bigint,bigint,int),public.pipeline_custo_registrar(uuid,uuid,text,text,text,int) to service_role;
commit;
