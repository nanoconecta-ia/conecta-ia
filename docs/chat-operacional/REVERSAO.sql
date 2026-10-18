-- SOMENTE revisão. Não executar sem autorização específica. Desligar primeiro as três flags e reverter painel/funções.
-- Caminho preferencial: manter tabelas e mensagens e desligar flags; preserva dados e permite retomar.
-- A remoção abaixo DESTRÓI conversas/mensagens: requer exportação segura e autorização adicional de exclusão.
begin;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule('chat-expurgo'); end if; end $$;
drop trigger chat_flags on public.loja_recursos;
drop trigger chat_retencao on public.lojas;
drop function public.chat_iniciar(uuid,uuid,uuid,text,text,text), public.chat_responder(uuid,uuid,uuid,uuid,text,jsonb),public.chat_excluir(uuid),public.chat_definir_retencao(uuid,int),public.chat_ler_como_administrador(uuid,uuid,text,timestamptz,uuid),public.chat_expurgar();
drop table public.mensagens;
drop table public.conversas;
drop function private.chat_imutavel(),private.chat_proteger_recurso(),private.chat_guardar_retencao(),private.chat_recurso(uuid,text),private.chat_vinculo(uuid,uuid),private.chat_visivel(uuid,timestamptz);
delete from public.loja_recursos where recurso in ('chat_persistente','chat_consulta_bling','chat_leitura_administrativa');
delete from public.recursos_plataforma where codigo in ('chat_persistente','chat_consulta_bling','chat_leitura_administrativa');
alter table public.lojas drop column chat_retencao_dias;
-- Auditoria permanece intacta e tem política própria.
commit;
