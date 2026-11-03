-- Reversão da ponte ERP (remove a função; devolve a lista de escopos anterior). Sessões que já tenham o escopo contexto:registrar passam a ser invalidadas por quem validar escopos: revogue-as antes.
begin;
do $$ begin
  if exists (select 1 from public.pair_sessoes where 'contexto:registrar' = any(escopos) and revogado_em is null) then raise exception 'há sessões ativas com o escopo contexto:registrar: revogue-as (Dispositivos) antes de reverter'; end if;
end $$;
drop function if exists public.contexto_registrar_extensao(uuid, uuid, text, text);
create or replace function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'bling:consultar', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler', 'mcp:leitura', 'mcp:propor'];
$$;
delete from supabase_migrations.schema_migrations where version = '20261103000006';
commit;
