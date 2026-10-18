-- Reversão da Fase 1 v2 (apaga as tabelas novas e os dados de conversa; a auditoria NÃO é tocada).
begin;
drop function if exists public.chat_ler_como_administrador(uuid, text);
drop function if exists public.chat_definir_retencao(uuid, int);
drop function if exists public.chat_expurgar();
drop function if exists public.chat_excluir(uuid);
drop function if exists public.chat_responder(uuid, text, text, text, text, int, int, jsonb, jsonb, text, boolean, text);
drop function if exists public.chat_iniciar(uuid, uuid, uuid, text, text, text);
drop function if exists private.recurso_ativo(uuid, text);
delete from public.loja_recursos where recurso in ('chat_persistente', 'chat_consulta_bling', 'chat_leitura_administrativa');
delete from public.recursos_plataforma where codigo in ('chat_persistente', 'chat_consulta_bling', 'chat_leitura_administrativa');
drop table if exists public.mensagens;
drop table if exists public.conversas;
drop function if exists private.mensagens_imutaveis();
alter table public.lojas drop column if exists chat_retencao_dias;
commit;
