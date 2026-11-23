-- Reversão de 20261123000001_enriquecimento_decidir.sql
-- Remove os RPCs de decisão. Não mexe em dados já aprovados.
drop function if exists public.codigo_decidir(uuid, uuid, uuid, text);
drop function if exists public.aplicacao_decidir(uuid, uuid, uuid, text);
