-- MINUTA: apenas CI descartável. Sem atribuição de papéis reais.
begin;
create role nano_orcamento_escritor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role nano_orcamento_operador nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public to nano_orcamento_escritor;
grant usage on schema nano_financeiro_interno to nano_orcamento_escritor,nano_orcamento_operador;
grant create on schema nano_financeiro_interno to nano_orcamento_escritor;
grant select,insert(loja_id,mes,limite_usd),update(limite_usd) on public.pipeline_orcamentos to nano_orcamento_escritor;
grant execute on function nano_financeiro_interno.travar(uuid,date) to nano_orcamento_escritor;
create policy nano_orcamento_le on public.pipeline_orcamentos for select to nano_orcamento_escritor using(true);
create policy nano_orcamento_ins on public.pipeline_orcamentos for insert to nano_orcamento_escritor with check(true);
create policy nano_orcamento_upd on public.pipeline_orcamentos for update to nano_orcamento_escritor using(true) with check(true);
create policy nano_orcamento_escopo on public.pipeline_orcamentos as restrictive for all to nano_orcamento_escritor
 using(loja_id::text=current_setting('nano.orcamento_loja',true) and mes::text=current_setting('nano.orcamento_mes',true))
 with check(loja_id::text=current_setting('nano.orcamento_loja',true) and mes::text=current_setting('nano.orcamento_mes',true));
create table nano_financeiro_interno.diario_orcamento(
 id bigint generated always as identity primary key,
 loja_id uuid not null, mes date not null,
 anterior_usd numeric(12,4), novo_usd numeric(12,4) not null,
 motivo text not null check(length(btrim(motivo)) between 1 and 500),
 sessao name not null, papel_sessao text not null,
 registrado_em timestamptz not null default clock_timestamp()
);
alter table nano_financeiro_interno.diario_orcamento enable row level security;
revoke all on nano_financeiro_interno.diario_orcamento from public,anon,authenticated,service_role,nano_financeiro_escritor,nano_orcamento_operador;
grant insert(loja_id,mes,anterior_usd,novo_usd,motivo,sessao,papel_sessao) on nano_financeiro_interno.diario_orcamento to nano_orcamento_escritor;
grant usage on sequence nano_financeiro_interno.diario_orcamento_id_seq to nano_orcamento_escritor;
create policy nano_orcamento_diario_append on nano_financeiro_interno.diario_orcamento for insert to nano_orcamento_escritor
 with check(loja_id::text=current_setting('nano.orcamento_loja',true) and mes::text=current_setting('nano.orcamento_mes',true));
-- O operador não recebe DML. Apenas esta função estreita, sem vinculação a usuário real.
create function nano_financeiro_interno.definir_teto(p_loja uuid,p_mes date,p_teto numeric,p_motivo text)
returns void language plpgsql security definer set search_path=''
 set nano.orcamento_loja='' set nano.orcamento_mes='' as $fin$
declare anterior numeric(12,4);
begin
 if p_loja is null or p_mes is null or not isfinite(p_mes) or p_mes<>date_trunc('month',p_mes)::date
  or p_teto is null or p_teto<0 or p_teto::text in ('NaN','Infinity','-Infinity')
  or p_teto>99999999.9999 or p_teto<>round(p_teto,4)
  or p_motivo is null or length(btrim(p_motivo)) not between 1 and 500 then
  raise exception 'parâmetros de orçamento inválidos' using errcode='22023';
 end if;
 perform nano_financeiro_interno.travar(p_loja,p_mes);
 perform set_config('nano.orcamento_loja',p_loja::text,true);
 perform set_config('nano.orcamento_mes',p_mes::text,true);
 select limite_usd into anterior from public.pipeline_orcamentos where loja_id=p_loja and mes=p_mes;
 if anterior is not distinct from p_teto then return; end if;
 insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values(p_loja,p_mes,p_teto)
 on conflict(loja_id,mes) do update set limite_usd=excluded.limite_usd;
 insert into nano_financeiro_interno.diario_orcamento(loja_id,mes,anterior_usd,novo_usd,motivo,sessao,papel_sessao)
 values(p_loja,p_mes,anterior,p_teto,btrim(p_motivo),session_user,current_setting('role'));
end $fin$;
alter function nano_financeiro_interno.definir_teto(uuid,date,numeric,text) owner to nano_orcamento_escritor;
revoke all on function nano_financeiro_interno.definir_teto(uuid,date,numeric,text) from public,anon,authenticated,service_role,nano_financeiro_escritor;
grant execute on function nano_financeiro_interno.definir_teto(uuid,date,numeric,text) to nano_orcamento_operador;
revoke create on schema nano_financeiro_interno from nano_orcamento_escritor;
commit;
