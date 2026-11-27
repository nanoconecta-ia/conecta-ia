-- MINUTA CI descartável; não é migração, não aplicar em produção.
-- Reutiliza a assinatura/autoridade legada, sem ampliar permissões.
-- Identidade humana continua responsabilidade do servidor autenticado.
begin;
create or replace function public.aplicacao_decidir(p_loja uuid,p_aplicacao uuid,p_user uuid,p_decisao text)
returns void language plpgsql security definer set search_path='' as $fn$
declare v_antes jsonb; v_depois jsonb;
begin
 if p_user is null or p_decisao is null or p_decisao not in ('aprovar','rejeitar') then
  raise exception 'decisão inválida' using errcode='22023';
 end if;
 -- Bloqueio de linha ANTES de capturar antes/depois; serializa a mesma aplicação.
 select to_jsonb(a.*) into v_antes from public.produto_aplicacoes a
 where a.id=p_aplicacao and a.loja_id=p_loja for update;
 if v_antes is null then raise exception 'aplicação não encontrada nesta loja' using errcode='P0002'; end if;
 if p_decisao='aprovar' then
  update public.produto_aplicacoes a set status='aprovado'
  where a.id=p_aplicacao and a.loja_id=p_loja returning to_jsonb(a.*) into v_depois;
 else
  -- Rejeitar revoga visibilidade na mesma instrução: CHECK existente exige aprovação.
  update public.produto_aplicacoes a set status='rejeitado',pagina_indexavel=false
  where a.id=p_aplicacao and a.loja_id=p_loja returning to_jsonb(a.*) into v_depois;
 end if;
 insert into public.auditoria(loja_id,user_id,acao,tabela,antes,depois,quando)
 values(p_loja,p_user,'aplicacao.'||p_decisao,'produto_aplicacoes',v_antes,v_depois,clock_timestamp());
end $fn$;
revoke all on function public.aplicacao_decidir(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.aplicacao_decidir(uuid,uuid,uuid,text) to service_role;
commit;
