-- MINUTA: apenas banco descartável, não migration. Não invocada pelo sincronizador.
-- Atualiza somente campos técnicos do espelho. O fluxo financeiro existente
-- permanece separado; novos produtos não recebem preço, saldo ou publicação aqui.
-- A integração futura deve decidir, explicitamente, a divisão com o sync legado.
begin;
create function public.nano_lifecycle_gravar_tecnico(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_linhas jsonb
) returns integer language plpgsql security invoker set search_path='' as $fn$
declare e jsonb; n integer; campos text[]:=array['loja_id','bling_id','sku','nome','situacao','categoria_bling_id','marca','gtin','descricao_curta','descricao_complementar','peso_kg','largura_cm','altura_cm','profundidade_cm','formato','pai_bling_id'];
begin
 -- Lock permanece até o commit do lote. Fence separado não autoriza escrita.
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva inválida' using errcode='42501'; end if;
 if p_linhas is null or jsonb_typeof(p_linhas)<>'array' then raise exception 'lote inválido'; end if;
 n:=jsonb_array_length(p_linhas);
 if n<1 or n>50 then raise exception 'lote fora do limite'; end if;
 for e in select value from jsonb_array_elements(p_linhas) loop
  if jsonb_typeof(e)<>'object' then raise exception 'linha inválida'; end if;
  if not (e ?& campos) or (e-campos)<>'{}'::jsonb or e->>'loja_id' is distinct from p_loja::text
     or coalesce(e->>'bling_id','') !~ '^[1-9][0-9]*$' or coalesce(e->>'situacao','') not in ('A','I','E')
     or jsonb_typeof(e->'bling_id') is distinct from 'string'
     or jsonb_typeof(e->'situacao') is distinct from 'string'
     or (e->>'situacao'='A' and nullif(btrim(e->>'sku'),'') is null)
  then raise exception 'linha fora do contrato'; end if;
  if exists(select 1 from jsonb_each(e) f where (f.key in ('peso_kg','largura_cm','altura_cm','profundidade_cm') and (jsonb_typeof(f.value) not in ('number','null') or (jsonb_typeof(f.value)='number' and (f.value#>>'{}')::numeric<=0))) or (f.key not in ('peso_kg','largura_cm','altura_cm','profundidade_cm') and jsonb_typeof(f.value) not in ('string','null'))) then raise exception 'tipo de campo inválido'; end if;
  if exists(select 1 from public.produtos p where p.loja_id=p_loja and p.bling_id<>e->>'bling_id' and nullif(btrim(e->>'sku'),'') is not null and upper(btrim(p.sku))=upper(btrim(e->>'sku'))) then raise exception 'SKU pertence a outro ID'; end if;
 end loop;
 if (select count(distinct v->>'bling_id') from jsonb_array_elements(p_linhas) v)<>n then raise exception 'ID duplicado no lote'; end if;
 if exists(select upper(btrim(v->>'sku')) from jsonb_array_elements(p_linhas) v where nullif(btrim(v->>'sku'),'') is not null group by 1 having count(*)>1) then raise exception 'SKU duplicado no lote'; end if;
 insert into public.produtos(loja_id,bling_id,sku,nome,situacao,categoria_bling_id,marca,gtin,descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,formato,pai_bling_id,publicado)
 select p_loja,x.bling_id,nullif(btrim(x.sku),''),x.nome,x.situacao,x.categoria_bling_id,x.marca,x.gtin,x.descricao_curta,x.descricao_complementar,x.peso_kg,x.largura_cm,x.altura_cm,x.profundidade_cm,x.formato,x.pai_bling_id,false
 from jsonb_populate_recordset(null::public.produtos,p_linhas) x
 on conflict(loja_id,bling_id) do update set
 sku=excluded.sku,nome=excluded.nome,situacao=excluded.situacao,categoria_bling_id=excluded.categoria_bling_id,marca=excluded.marca,gtin=excluded.gtin,descricao_curta=excluded.descricao_curta,descricao_complementar=excluded.descricao_complementar,peso_kg=excluded.peso_kg,largura_cm=excluded.largura_cm,altura_cm=excluded.altura_cm,profundidade_cm=excluded.profundidade_cm,formato=excluded.formato,pai_bling_id=excluded.pai_bling_id,
 publicado=case when excluded.situacao='A' then produtos.publicado else false end;
 get diagnostics n=row_count;
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva perdida durante lote'; end if;
 return n;
end $fn$;
revoke all on function public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_gravar_tecnico(uuid,uuid,bigint,jsonb) to service_role;
commit;
