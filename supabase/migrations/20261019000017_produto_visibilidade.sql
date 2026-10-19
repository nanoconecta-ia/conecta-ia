-- Botão mostrar/ocultar produto no site, para o LOJISTA (usuário logado). Reaproveita a regra que já existe em publicar_produto
-- (produto incompleto NÃO publica; tudo auditado), que continua só para service_role. Aqui só entra a porta do lojista:
-- autenticado, administrador da loja do produto, nunca editor. Ocultar é sempre permitido; mostrar passa pelos mesmos gates.
create function public.produto_visibilidade(p_produto uuid, p_publicar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_loja uuid;
begin
  if v_uid is null then raise exception 'não autenticado' using errcode = '28000'; end if;
  select loja_id into v_loja from public.produtos where id = p_produto;
  -- mesma resposta para produto inexistente e de outra loja: sem oráculo entre lojas
  if v_loja is null or not private.administra_loja(v_loja, v_uid) then raise exception 'produto não encontrado' using errcode = '42501'; end if;
  return public.publicar_produto(p_produto, coalesce(p_publicar, false), v_uid);
end $$;
revoke all on function public.produto_visibilidade(uuid, boolean) from public, anon;
grant execute on function public.produto_visibilidade(uuid, boolean) to authenticated, service_role;
