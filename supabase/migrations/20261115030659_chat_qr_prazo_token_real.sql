-- O painel so deve indicar conexao QR disponivel quando o token E a janela estiverem validos.
-- O lojista ve apenas prazos, nunca o segredo ou os hashes da sessao.
begin;

create or replace function public.chat_qr_disponivel(p_loja uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_token timestamptz; v_janela timestamptz;
begin
  if auth.uid() is null or not private.chat_vinculo(p_loja, auth.uid()) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select s.expira_em, s.limite_ate into v_token, v_janela
    from public.pair_sessoes s
   where s.loja_id = p_loja
     and s.revogado_em is null
     and s.limite_ate > now()
     and 'chat:responder' = any(s.escopos)
   order by s.expira_em desc, s.limite_ate desc
   limit 1;
  return jsonb_build_object(
    'disponivel', coalesce(v_token > now() and v_janela > now(), false),
    'ate', case when v_token > now() and v_janela > now() then least(v_token, v_janela) else null end,
    'token_ate', v_token,
    'janela_ate', v_janela
  );
end $$;

revoke all on function public.chat_qr_disponivel(uuid) from public, anon, authenticated;
grant execute on function public.chat_qr_disponivel(uuid) to authenticated, service_role;

commit;
