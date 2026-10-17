-- Segredos da plataforma no Vault (gerados pelo banco; ninguém os vê nem os digita).
-- ESTADO: assina o state do OAuth. CHAVE_CIFRA k1: AES-256 (base64 de 32 bytes) que cifra credenciais.
-- Rotação: criar plataforma_chave_cifra_k2 e recifrar (ver docs/BLING_RECUPERACAO_E_REVERSAO.md).
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'plataforma_estado_segredo', 'Assinatura do state OAuth do Bling')
where not exists (select 1 from vault.secrets where name = 'plataforma_estado_segredo');

select vault.create_secret(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
  'plataforma_chave_cifra_k1', 'Chave AES-256 (k1) das credenciais cifradas')
where not exists (select 1 from vault.secrets where name = 'plataforma_chave_cifra_k1');

create function public.plataforma_segredo(p_nome text) returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = p_nome and p_nome in ('plataforma_estado_segredo', 'plataforma_chave_cifra_k1');
$$;
revoke all on function public.plataforma_segredo(text) from public, anon, authenticated;
grant execute on function public.plataforma_segredo(text) to service_role;
