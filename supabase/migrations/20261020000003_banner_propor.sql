-- O agente (chat ou cliente MCP) só PROPÕE banner: nasce RASCUNHO (ativo = false), invisível no site. Quem publica é o lojista no painel.
-- Só service_role chama (as ferramentas do Conector rodam no servidor). Limite de rascunhos para o agente não encher a lista.
create function public.banner_propor(p_loja uuid, p_produto uuid, p_estilo text, p_chamada text, p_inicio timestamptz, p_fim timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_n int;
begin
  if p_estilo not in ('auto', 'padrao', 'flash') then raise exception 'estilo inválido' using errcode = '22023'; end if;
  select count(*) into v_n from public.loja_banners where loja_id = p_loja and not ativo;
  if v_n >= 20 then raise exception 'muitos rascunhos de banner pendentes' using errcode = '54000'; end if;
  insert into public.loja_banners (loja_id, produto_id, estilo, chamada, inicio, fim, ativo)
  values (p_loja, p_produto, p_estilo, nullif(left(btrim(coalesce(p_chamada, '')), 80), ''), coalesce(p_inicio, now()), p_fim, false)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.banner_propor(uuid, uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.banner_propor(uuid, uuid, text, text, timestamptz, timestamptz) to service_role;
