-- MINUTA para PostgreSQL descartável. Preparação técnica sem avançar estado.
begin;
create function public.nano_lifecycle_entrada_tecnica(p_loja uuid,p_item uuid,p_execucao uuid,p_geracao bigint,p_versao integer)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare cp public.nano_lifecycle_checkpoint; i public.pipeline_itens; r jsonb; p jsonb;
begin
 select * into cp from public.nano_lifecycle_checkpoint where loja_id=p_loja for update;
 if not found or not cp.habilitado or not cp.despacho_habilitado or not cp.consumo_habilitado then return jsonb_build_object('estado','desabilitado'); end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item and entrada->>'origem'='nano_lifecycle';
 if not found then return jsonb_build_object('estado','item_inexistente'); end if;
 if i.estado<>'entrada' or p_execucao is null or p_geracao is null or p_versao is null or i.nano_execucao is distinct from p_execucao or i.nano_geracao<>p_geracao or i.versao<>p_versao or i.reservado_ate is null or i.reservado_ate<=clock_timestamp() then return jsonb_build_object('estado','reserva_invalida'); end if;
 -- Revalida evento, revisão, snapshot, identidade e pausa sob locks do despacho.
 r:=public.nano_lifecycle_encaminhar(p_loja,i.entrada->>'revisao',i.idempotency_key);
 if r->>'estado'='encaminhado' then raise exception 'tarefa desapareceu durante leitura'; end if;
 if r->>'estado'<>'ja_encaminhado' then return r; end if;
 if r->>'item_id' is distinct from p_item::text then raise exception 'tarefa divergente'; end if;
 select * into i from public.pipeline_itens where loja_id=p_loja and id=p_item for update;
 if not found or i.estado<>'entrada' or i.nano_execucao is distinct from p_execucao or i.nano_geracao<>p_geracao or i.versao<>p_versao or i.reservado_ate is null or i.reservado_ate<=clock_timestamp() then return jsonb_build_object('estado','reserva_invalida'); end if;
 select v into p from public.nano_lifecycle_snapshots s cross join lateral jsonb_array_elements(s.produtos) v where s.loja_id=p_loja and s.revisao=cp.revisao and v->>'id'=i.produto_id::text;
 if p is null or p->>'loja_id' is distinct from p_loja::text or p->>'situacao' is distinct from 'A' or btrim(p->>'sku') is distinct from i.sku or nullif(btrim(p->>'nome'),'') is null then return jsonb_build_object('estado','dados_tecnicos_incompletos'); end if;
 return jsonb_build_object('estado','preparada','loja_id',p_loja,'item_id',p_item,'execucao',p_execucao,'geracao',p_geracao,'versao',p_versao,'revisao',i.entrada->>'revisao','checkpoint',cp.revisao,
 'produto',jsonb_build_object('id',p->>'id','bling_id',p->>'bling_id','sku',i.sku,'nome',p->>'nome','marca',p->>'marca','gtin',p->>'gtin','descricao_curta',p->>'descricao_curta','descricao_complementar',p->>'descricao_complementar'));
end $fn$;
revoke all on function public.nano_lifecycle_entrada_tecnica(uuid,uuid,uuid,bigint,integer) from public,anon,authenticated,service_role;
grant execute on function public.nano_lifecycle_entrada_tecnica(uuid,uuid,uuid,bigint,integer) to service_role;
commit;
