-- MINUTA: homologação exclusiva no banco descartável. Depende das minutas de captura e reserva.
begin;
create table public.nano_lifecycle_snapshots (
 loja_id uuid not null,
 revisao text not null,
 execucao uuid not null,
 geracao bigint not null check(geracao>0),
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 produtos jsonb not null check(jsonb_typeof(produtos)='array' and jsonb_array_length(produtos)<=5000),
 criado_em timestamptz not null default now(),
 primary key(loja_id,revisao),
 foreign key(loja_id,revisao) references public.nano_lifecycle_capturas(loja_id,revisao) on delete cascade
);
alter table public.nano_lifecycle_snapshots enable row level security;
revoke all on public.nano_lifecycle_snapshots from public,anon,authenticated,service_role;
grant select,insert on public.nano_lifecycle_snapshots to service_role;
-- Fence, comparação integral da projeção, captura, snapshot e encerramento
-- numa transação. Não usa uma chamada RPC separada para autorizar a escrita.
-- A evidência deve existir na mesma execução/geração e corresponder à projeção.
-- O digest canônico e autenticidade da origem ainda são responsabilidades do servidor.
create function public.nano_lifecycle_finalizar(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_revisao text,p_predecessor text,p_estado text,
 p_eventos jsonb,p_bloqueios jsonb,p_digest text,p_produtos jsonb
) returns text language plpgsql security invoker set search_path='' as $fn$
declare atual jsonb; resposta text; evid public.nano_lifecycle_varreduras;
begin
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
 resposta:=public.nano_lifecycle_registrar(p_loja,p_revisao,p_predecessor,p_estado,p_eventos,p_bloqueios);
 if resposta<>'gravado' then return resposta; end if;
 insert into public.nano_lifecycle_snapshots(loja_id,revisao,execucao,geracao,digest,produtos)
 values(p_loja,p_revisao,p_execucao,p_geracao,p_digest,atual);
 if not public.nano_lifecycle_encerrar_reserva(p_loja,p_execucao,p_geracao) then raise exception 'reserva perdida durante finalização'; end if;
 return 'gravado';
end $fn$;
revoke all on function public.nano_lifecycle_projecao(uuid), public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_projecao(uuid), public.nano_lifecycle_finalizar(uuid,uuid,bigint,text,text,text,jsonb,jsonb,text,jsonb) to service_role;
commit;
