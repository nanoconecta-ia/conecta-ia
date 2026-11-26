-- MINUTA, somente CI descartável. Evidência declarada pelo servidor de sync,
-- não prova criptográfica da resposta do ERP. Não altera produtos/publicação.
begin;
create table public.nano_lifecycle_varreduras (
 loja_id uuid not null,
 execucao uuid not null,
 geracao bigint not null,
 grupos jsonb not null,
 digest_projecao text not null check(digest_projecao ~ '^[0-9a-f]{64}$'),
 candidatos jsonb not null check(jsonb_typeof(candidatos)='array' and jsonb_array_length(candidatos)<=5000),
 criado_em timestamptz not null default clock_timestamp(),
 primary key(loja_id,execucao),
 foreign key(loja_id,execucao) references public.nano_lifecycle_execucoes(loja_id,execucao) on delete cascade
);
alter table public.nano_lifecycle_varreduras enable row level security;
revoke all on public.nano_lifecycle_varreduras from public,anon,authenticated,service_role;
grant select,insert on public.nano_lifecycle_varreduras to service_role;
-- Grupos: {"ativos":[["123",...],[]],"inativos":[[]],"excluidos":[[]]}.
-- Cada página não final precisa ter 100 IDs; a final precisa ter menos.
-- Toda a lista é validada sob fence. Não aceitar um mero booleano "completa".
create function public.nano_lifecycle_registrar_varredura(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_grupos jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare g text; paginas jsonb; pagina jsonb; i integer; n integer;
 vistos text[]:=array[]::text[]; v jsonb; idv text; cand jsonb; digest_atual text; anterior public.nano_lifecycle_varreduras;
begin
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
revoke all on function public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_registrar_varredura(uuid,uuid,bigint,jsonb) to service_role;
commit;
