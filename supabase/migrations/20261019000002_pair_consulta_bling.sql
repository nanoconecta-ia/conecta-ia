-- Acrescenta consentimento de leitura da API Bling ao Pair. Não altera sessões existentes.
-- Nenhuma tabela ou permissão de gravação no ERP é criada.
create or replace function private.pair_escopos_validos() returns text[]
language sql immutable set search_path = '' as $$
  select array['produtos:ler', 'bling:consultar', 'enriquecimento:propor', 'banners:propor', 'categorias:propor', 'paginas:propor',
               'catalogo:propor', 'campanhas:propor', 'aprovacoes:ler', 'tarefas:ler'];
$$;
-- CREATE OR REPLACE preserva as ACLs restritas da função original.
