-- MINUTA: exclusivamente para PostgreSQL descartável. Não é migration nem deploy.
-- Reserva por loja e fencing monotônico. Não protege escritas no espelho por si só:
-- cada RPC de gravação futura deverá validar o fencing sob lock até o commit.
begin;
create table public.nano_lifecycle_reserva (
 loja_id uuid primary key references public.nano_lifecycle_checkpoint(loja_id) on delete cascade,
 geracao bigint not null check(geracao>0),
 execucao uuid not null,
 expira_em timestamptz not null,
 encerrada boolean not null default false
);
alter table public.nano_lifecycle_reserva enable row level security;
revoke all on public.nano_lifecycle_reserva from public,anon,authenticated,service_role;
grant select,insert,update on public.nano_lifecycle_reserva to service_role;
-- Histórico mínimo de execuções adquiridas: nunca reciclar UUID após outra geração.
create table public.nano_lifecycle_execucoes (
 loja_id uuid not null references public.nano_lifecycle_checkpoint(loja_id) on delete cascade,
 execucao uuid not null,
 geracao bigint not null check(geracao>0),
 criada_em timestamptz not null default clock_timestamp(),
 primary key(loja_id,execucao),
 unique(loja_id,geracao)
);
alter table public.nano_lifecycle_execucoes enable row level security;
revoke all on public.nano_lifecycle_execucoes from public,anon,authenticated,service_role;
grant select,insert on public.nano_lifecycle_execucoes to service_role;
-- Desligar invalida a reserva na própria transação. Religá-la não a restaura.
create function public.nano_lifecycle_revogar_ao_desligar()
returns trigger language plpgsql security invoker set search_path='' as $fn$
begin
 if old.habilitado and not new.habilitado then
  update public.nano_lifecycle_reserva set encerrada=true where loja_id=new.loja_id and not encerrada;
 end if;
 return new;
end $fn$;
revoke all on function public.nano_lifecycle_revogar_ao_desligar() from public,anon,authenticated,service_role;
create trigger nano_lifecycle_revogar_ao_desligar after update of habilitado on public.nano_lifecycle_checkpoint
for each row when (old.habilitado is distinct from new.habilitado)
execute function public.nano_lifecycle_revogar_ao_desligar();
-- Ordem única de locks: checkpoint -> reserva. Nenhum lock mantido durante rede.
create function public.nano_lifecycle_reservar(p_loja uuid,p_execucao uuid,p_segundos integer default 180)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare c public.nano_lifecycle_checkpoint; r public.nano_lifecycle_reserva; t timestamptz;
begin
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
-- Esta checagem só é útil para escrita se chamada NA MESMA transação da mutação.
-- O lock do checkpoint serializa desligamento e troca de geração.
create function public.nano_lifecycle_fence(p_loja uuid,p_execucao uuid,p_geracao bigint)
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare c public.nano_lifecycle_checkpoint; r public.nano_lifecycle_reserva;
begin
 select * into c from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not c.habilitado then return false; end if;
 select * into r from public.nano_lifecycle_reserva where loja_id=p_loja for update;
 return found and p_execucao is not null and p_geracao is not null and r.execucao=p_execucao and r.geracao=p_geracao and not r.encerrada and r.expira_em>clock_timestamp();
end $fn$;
create function public.nano_lifecycle_encerrar_reserva(p_loja uuid,p_execucao uuid,p_geracao bigint)
returns boolean language plpgsql security invoker set search_path='' as $fn$
begin
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then return false; end if;
 update public.nano_lifecycle_reserva set encerrada=true where loja_id=p_loja and execucao=p_execucao and geracao=p_geracao;
 return found;
end $fn$;
revoke all on function public.nano_lifecycle_reservar(uuid,uuid,integer),public.nano_lifecycle_fence(uuid,uuid,bigint),public.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_reservar(uuid,uuid,integer),public.nano_lifecycle_fence(uuid,uuid,bigint),public.nano_lifecycle_encerrar_reserva(uuid,uuid,bigint) to service_role;
commit;
