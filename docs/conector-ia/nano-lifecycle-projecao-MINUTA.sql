-- MINUTA somente PostgreSQL descartável.
begin;
-- Projeção explícita: nenhuma coluna de preço, saldo, custo, publicação ou fornecedor.
-- Descrições legadas continuam dados privados; nunca expor o snapshot ao público.
create function public.nano_lifecycle_projecao(p_loja uuid)
returns jsonb language sql stable security invoker set search_path='' as $fn$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
 from (select id,loja_id,bling_id,sku,situacao,nome,marca,gtin,categoria_bling_id,
 descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,formato,pai_bling_id
 from public.produtos where loja_id=p_loja order by id limit 5001) t
$fn$;
revoke all on function public.nano_lifecycle_projecao(uuid) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_projecao(uuid) to service_role;
commit;
