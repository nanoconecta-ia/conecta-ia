-- MINUTA exclusiva de CI. Recalcula eventos/bloqueios a partir de snapshots
-- protegidos; não aceita lista declarada pelo chamador como evidência suficiente.
begin;
grant select on public.produto_automacao to nano_lifecycle_diario;
create policy nano_diario_pausas on public.produto_automacao for select to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
create policy nano_diario_pausas_escopo on public.produto_automacao as restrictive for select to nano_lifecycle_diario using (loja_id::text=split_part(coalesce(current_setting('nano.lifecycle_fence',true),''),':',1));
-- Espaços ECMAScript trim (inclusive NBSP e BOM); números são JSONB numéricos.
create function nano_lifecycle_interno.normalizar(v jsonb) returns jsonb language sql immutable security invoker set search_path='' as $fn$
 select case when jsonb_typeof(v)='string' then coalesce(to_jsonb(nullif(btrim(v#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),'')),'null'::jsonb) else coalesce(v,'null'::jsonb) end
$fn$;
revoke all on function nano_lifecycle_interno.normalizar(jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.normalizar(jsonb) to nano_lifecycle_diario;
create function nano_lifecycle_interno.conferir_eventos(p_loja uuid,p_revisao text,p_predecessor text,p_atual jsonb,p_eventos jsonb,p_bloqueios jsonb)
returns boolean language plpgsql security invoker set search_path='' as $fn$
declare antes jsonb; p jsonb; prev jsonb; campos text[]:=array['sku','nome','marca','gtin','categoria_bling_id','descricao_curta','descricao_complementar','peso_kg','largura_cm','altura_cm','profundidade_cm','formato','pai_bling_id']; mudancas text[]; c text; sku text; tipo text; motivo text; chave text; eventos jsonb:='[]'; bloqueios jsonb:='[]'; pausado boolean;
begin
 if p_eventos is null or jsonb_typeof(p_eventos)<>'array' or p_bloqueios is null or jsonb_typeof(p_bloqueios)<>'array' then return false; end if;
 if p_predecessor is null then return p_eventos='[]'::jsonb and p_bloqueios='[]'::jsonb; end if;
 select produtos into antes from public.nano_lifecycle_snapshots where loja_id=p_loja and revisao=p_predecessor;
 if not found then return false; end if;
 if exists(select 1 from jsonb_array_elements(antes) a where a->>'situacao'='A' and not exists(select 1 from jsonb_array_elements(p_atual) b where b->>'id'=a->>'id' and (b->>'bling_id') is not distinct from (a->>'bling_id'))) then return false; end if;
 if exists(select 1 from jsonb_array_elements(antes) a where a->>'bling_id' is not null group by a->>'bling_id' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_atual) a where a->>'bling_id' is not null group by a->>'bling_id' having count(*)>1) then return false; end if;
 for p in select value from jsonb_array_elements(p_atual) loop
  select value into prev from jsonb_array_elements(antes) where value->>'bling_id'=p->>'bling_id';
  if p->>'situacao' is distinct from 'A' and prev->>'situacao' is distinct from 'A' then continue; end if;
  sku:=nano_lifecycle_interno.normalizar(p->'sku')#>>'{}';
  motivo:=null;
  if sku is null or coalesce(p->>'bling_id','') !~ '^[1-9][0-9]*$' then motivo:='identidade_incompleta';
  elsif exists(select 1 from jsonb_array_elements(p_atual) b where b->>'bling_id' is not null and b->>'bling_id'<>p->>'bling_id' and upper(nano_lifecycle_interno.normalizar(b->'sku')#>>'{}')=upper(sku)) then motivo:='sku_duplicado';
  elsif prev is not null and prev->>'id'<>p->>'id' then motivo:='identidade_alterada'; end if;
  if motivo is not null then
   bloqueios:=bloqueios||jsonb_build_array(jsonb_build_object('produto_id',p->>'id','motivo',motivo));
   continue;
  end if;
  mudancas:=array[]::text[];
  foreach c in array campos loop
   if prev is null or nano_lifecycle_interno.normalizar(prev->c) is distinct from nano_lifecycle_interno.normalizar(p->c) then mudancas:=array_append(mudancas,c); end if;
  end loop;
  tipo:=case when p->>'situacao' is distinct from 'A' then 'inativado' when prev is null then 'novo' when prev->>'situacao' is distinct from 'A' then 'reativado' when cardinality(mudancas)>0 then 'alteracao_tecnica' else null end;
  if tipo is null then continue; end if;
  -- Chave JSON.stringify de cinco strings com alfabeto restrito (UUID, ID, revisão, tipo).
  if p_revisao !~ '^[A-Za-z0-9_-]{8,96}$' then return false; end if;
  chave:='nano-lifecycle:'||encode(sha256(convert_to('['||to_json(p_loja::text)::text||','||to_json(p->>'id')::text||','||to_json(p->>'bling_id')::text||','||to_json(p_revisao)::text||','||to_json(tipo)::text||']','UTF8')),'hex');
  pausado:=exists(select 1 from public.produto_automacao a where a.loja_id=p_loja and a.produto_id::text=p->>'id' and a.pausado);
  eventos:=eventos||jsonb_build_array(jsonb_build_object('produto_id',p->>'id','loja_id',p_loja,'bling_id',p->>'bling_id','sku',sku,'tipo',tipo,'campos',to_jsonb(mudancas),'revisao',p_revisao,'idempotency_key',chave,'destino',case when tipo='inativado' then 'revisao_inativacao' else 'pesquisa' end,'pausado_na_captura',pausado));
 end loop;
 return (select coalesce(jsonb_agg(v order by v->>'produto_id',v::text),'[]'::jsonb) from jsonb_array_elements(eventos) v)
 = (select coalesce(jsonb_agg(v order by v->>'produto_id',v::text),'[]'::jsonb) from jsonb_array_elements(p_eventos) v)
 and (select coalesce(jsonb_agg(v order by v->>'produto_id',v::text),'[]'::jsonb) from jsonb_array_elements(bloqueios) v)
 = (select coalesce(jsonb_agg(v order by v->>'produto_id',v::text),'[]'::jsonb) from jsonb_array_elements(p_bloqueios) v);
end $fn$;
revoke all on function nano_lifecycle_interno.conferir_eventos(uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function nano_lifecycle_interno.conferir_eventos(uuid,text,text,jsonb,jsonb,jsonb) to nano_lifecycle_diario;
commit;
