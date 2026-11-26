-- MINUTA: somente CI descartável, não migration nem deploy.
-- Mesmo contrato LinhaProduto do sincronizador existente. Preço e saldo são
-- apenas cópia do ERP para o espelho privado; não escreve no ERP nem publica.
-- Esta RPC substitui o upsert direto quando a integração estiver homologada.
begin;
create function public.nano_lifecycle_gravar_espelho(
 p_loja uuid,p_execucao uuid,p_geracao bigint,p_linhas jsonb
) returns integer language plpgsql security invoker set search_path='' as $fn$
declare e jsonb; n integer; campos text[]:=array['loja_id','bling_id','sku','nome','preco','estoque','situacao','categoria_bling_id','marca','gtin','gtin_tributario','descricao_curta','descricao_complementar','peso_kg','largura_cm','altura_cm','profundidade_cm','unidade','condicao','formato','pai_bling_id','volumes','sincronizado_em'];
 numeros text[]:=array['preco','estoque','peso_kg','largura_cm','altura_cm','profundidade_cm','volumes'];
begin
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva inválida' using errcode='42501'; end if;
 if p_linhas is null or jsonb_typeof(p_linhas)<>'array' then raise exception 'lote inválido'; end if;
 n:=jsonb_array_length(p_linhas);
 if n<1 or n>50 then raise exception 'lote fora do limite'; end if;
 for e in select value from jsonb_array_elements(p_linhas) loop
  if jsonb_typeof(e)<>'object' then raise exception 'linha inválida'; end if;
  if not (e ?& campos) or (e-campos)<>'{}'::jsonb or e->>'loja_id' is distinct from p_loja::text
   or jsonb_typeof(e->'bling_id') is distinct from 'string' or coalesce(e->>'bling_id','') !~ '^[1-9][0-9]*$'
   or jsonb_typeof(e->'sincronizado_em') is distinct from 'string'
   or (e->>'situacao' is not null and e->>'situacao' not in ('A','I','E'))
  then raise exception 'linha fora do contrato'; end if;
  if exists(select 1 from jsonb_each(e) f where (f.key=any(numeros) and jsonb_typeof(f.value) not in ('number','null')) or (not(f.key=any(numeros)) and jsonb_typeof(f.value) not in ('string','null'))) then raise exception 'tipo de campo inválido'; end if;
  if exists(select 1 from public.produtos p where p.loja_id=p_loja and p.bling_id<>e->>'bling_id' and nullif(btrim(e->>'sku'),'') is not null and upper(btrim(p.sku))=upper(btrim(e->>'sku'))) then raise exception 'SKU pertence a outro ID'; end if;
 end loop;
 if (select count(distinct v->>'bling_id') from jsonb_array_elements(p_linhas) v)<>n then raise exception 'ID duplicado no lote'; end if;
 if exists(select upper(btrim(v->>'sku')) from jsonb_array_elements(p_linhas) v where nullif(btrim(v->>'sku'),'') is not null group by 1 having count(*)>1) then raise exception 'SKU duplicado no lote'; end if;
 -- Marcador local da RPC, validado pelo trigger junto com fence real.
 perform set_config('nano.lifecycle_fence',p_loja::text||':'||p_execucao::text||':'||p_geracao::text,true);
 insert into public.produtos(loja_id,bling_id,sku,nome,preco,estoque,situacao,categoria_bling_id,marca,gtin,gtin_tributario,descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,unidade,condicao,formato,pai_bling_id,volumes,sincronizado_em,publicado)
 select p_loja,x.bling_id,nullif(btrim(x.sku),''),x.nome,x.preco,x.estoque,x.situacao,x.categoria_bling_id,x.marca,x.gtin,x.gtin_tributario,x.descricao_curta,x.descricao_complementar,x.peso_kg,x.largura_cm,x.altura_cm,x.profundidade_cm,x.unidade,x.condicao,x.formato,x.pai_bling_id,x.volumes,x.sincronizado_em,false
 from jsonb_populate_recordset(null::public.produtos,p_linhas) x
 on conflict(loja_id,bling_id) do update set
 sku=excluded.sku,
 nome=excluded.nome,
 preco=excluded.preco,
 estoque=excluded.estoque,
 situacao=excluded.situacao,
 categoria_bling_id=excluded.categoria_bling_id,
 marca=excluded.marca,
 gtin=excluded.gtin,
 gtin_tributario=excluded.gtin_tributario,
 descricao_curta=excluded.descricao_curta,
 descricao_complementar=excluded.descricao_complementar,
 peso_kg=excluded.peso_kg,
 largura_cm=excluded.largura_cm,
 altura_cm=excluded.altura_cm,
 profundidade_cm=excluded.profundidade_cm,
 unidade=excluded.unidade,
 condicao=excluded.condicao,
 formato=excluded.formato,
 pai_bling_id=excluded.pai_bling_id,
 volumes=excluded.volumes,
 sincronizado_em=excluded.sincronizado_em,
 publicado=case when excluded.situacao='A' then produtos.publicado else false end;
 get diagnostics n=row_count;
 perform set_config('nano.lifecycle_fence','',true);
 if not public.nano_lifecycle_fence(p_loja,p_execucao,p_geracao) then raise exception 'reserva perdida durante lote'; end if;
 return n;
end $fn$;
revoke all on function public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_gravar_espelho(uuid,uuid,bigint,jsonb) to service_role;
commit;
