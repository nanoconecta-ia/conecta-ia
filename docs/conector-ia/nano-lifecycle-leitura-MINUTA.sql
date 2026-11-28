-- MINUTA para CI descartável. Leitura privada do protocolo, sem escrita.
begin;
create function public.nano_lifecycle_ler(p_loja uuid,p_tipo text,p_revisao text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare r jsonb; n integer;
begin
 if p_loja is null then raise exception 'loja inválida'; end if;
 case p_tipo
 when 'checkpoint' then
  select jsonb_build_object('loja_id',loja_id,'revisao',revisao,'habilitado',habilitado) into r from public.nano_lifecycle_checkpoint where loja_id=p_loja;
 when 'snapshot' then
  select to_jsonb(s) into r from public.nano_lifecycle_snapshots s where loja_id=p_loja and revisao=p_revisao;
 when 'captura' then
  select to_jsonb(c) into r from public.nano_lifecycle_capturas c where loja_id=p_loja and revisao=p_revisao;
 when 'projecao' then
  r:=public.nano_lifecycle_projecao(p_loja);
  n:=jsonb_array_length(r);
  if n>5000 then raise exception 'projeção excede limite'; end if;
  r:=jsonb_build_object('loja_id',p_loja,'produtos',r,'total',n);
 when 'pausas' then
  select coalesce(jsonb_agg(produto_id order by produto_id),'[]'::jsonb),count(*)::integer into r,n
  from (select a.produto_id from public.produto_automacao a join public.produtos p on p.id=a.produto_id and p.loja_id=a.loja_id where a.loja_id=p_loja and a.pausado order by a.produto_id limit 5001) s;
  if n>5000 then raise exception 'pausas excedem limite'; end if;
  r:=jsonb_build_object('loja_id',p_loja,'produtos',r,'total',n);
 else raise exception 'tipo de leitura inválido';
 end case;
 return r;
end $fn$;
revoke all on function public.nano_lifecycle_ler(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_ler(uuid,text,text) to service_role;
commit;
