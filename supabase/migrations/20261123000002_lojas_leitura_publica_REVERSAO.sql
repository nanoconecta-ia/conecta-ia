-- Reversão de 20261123000002_lojas_leitura_publica.sql
drop policy if exists lojas_publicas on public.lojas;
revoke select on public.lojas from anon;
