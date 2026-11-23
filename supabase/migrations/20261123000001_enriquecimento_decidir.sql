-- Decisão humana sobre o enriquecimento: aprovar/rejeitar CÓDIGO (OEM/fabricante) e APLICAÇÃO veicular.
-- Espelha public.imagem_decidir: security definer, confere o dono da loja e grava auditoria (antes/depois).
-- Só o servidor executa (service_role). A pessoa decide pela rota autenticada (conector-aprovacoes),
-- que já verifica se é membro da loja. A chave do agente/MCP nunca aprova.
-- O CHECK do banco garante que aprovado exige fonte + coletado_em; aqui não há como furar isso.

create or replace function public.codigo_decidir(p_loja uuid, p_codigo uuid, p_user uuid, p_decisao text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_antes jsonb;
begin
  select to_jsonb(c.*) into v_antes from public.produto_codigos c where c.id = p_codigo and c.loja_id = p_loja;
  if v_antes is null then raise exception 'código não encontrado nesta loja' using errcode = 'P0002'; end if;
  if p_decisao = 'aprovar' then
    update public.produto_codigos set status = 'aprovado' where id = p_codigo;
  elsif p_decisao = 'rejeitar' then
    update public.produto_codigos set status = 'rejeitado' where id = p_codigo;
  else raise exception 'decisão inválida (use aprovar ou rejeitar)' using errcode = '22023'; end if;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
    values (p_loja, p_user, 'codigo.' || p_decisao, 'produto_codigos', v_antes,
            (select to_jsonb(c.*) from public.produto_codigos c where c.id = p_codigo));
end $$;

create or replace function public.aplicacao_decidir(p_loja uuid, p_aplicacao uuid, p_user uuid, p_decisao text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_antes jsonb;
begin
  select to_jsonb(a.*) into v_antes from public.produto_aplicacoes a where a.id = p_aplicacao and a.loja_id = p_loja;
  if v_antes is null then raise exception 'aplicação não encontrada nesta loja' using errcode = 'P0002'; end if;
  if p_decisao = 'aprovar' then
    update public.produto_aplicacoes set status = 'aprovado' where id = p_aplicacao;
  elsif p_decisao = 'rejeitar' then
    update public.produto_aplicacoes set status = 'rejeitado' where id = p_aplicacao;
  else raise exception 'decisão inválida (use aprovar ou rejeitar)' using errcode = '22023'; end if;
  insert into public.auditoria (loja_id, user_id, acao, tabela, antes, depois)
    values (p_loja, p_user, 'aplicacao.' || p_decisao, 'produto_aplicacoes', v_antes,
            (select to_jsonb(a.*) from public.produto_aplicacoes a where a.id = p_aplicacao));
end $$;

revoke all on function public.codigo_decidir(uuid, uuid, uuid, text) from public;
revoke all on function public.aplicacao_decidir(uuid, uuid, uuid, text) from public;
grant execute on function public.codigo_decidir(uuid, uuid, uuid, text) to service_role;
grant execute on function public.aplicacao_decidir(uuid, uuid, uuid, text) to service_role;
