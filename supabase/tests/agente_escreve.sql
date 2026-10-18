-- Testa as propostas de escrita do agente (enriquecimento, código, aplicação, imagem) e a busca de imagem. Desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.produtos (id, loja_id, bling_id, sku, nome, situacao) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1', '80692', 'Jogo de juntas', 'A'),
  ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '2', 'B-1', 'Produto da loja B', 'A');
\set A '\'aaaaaaaa-0000-0000-0000-000000000001\''
\set B '\'bbbbbbbb-0000-0000-0000-000000000002\''
\set P1 '\'cccccccc-0000-0000-0000-000000000001\''
\set P2 '\'dddddddd-0000-0000-0000-000000000001\''

select public.enriquecimento_propor(:A, :P1, 'marca_peca', '"SABó"'::jsonb, 'https://fabricante.com', 0.8);
select public.afirma((select status from public.produto_enriquecimento where produto_id = :P1) = 'a_confirmar', 'enriquecimento entra a_confirmar');
do $$ begin begin perform public.enriquecimento_propor('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'marca_peca', '"x"'::jsonb, 'f', null); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'não propõe em produto de outra loja');
update public.produto_enriquecimento set status = 'aprovado' where produto_id = :P1;
select public.enriquecimento_propor(:A, :P1, 'marca_peca', '"Outra"'::jsonb, 'https://x.com', null);
select public.afirma((select valor from public.produto_enriquecimento where produto_id = :P1) = '"SABó"'::jsonb, 'proposta não sobrescreve valor já aprovado');

select public.codigo_propor(:A, :P1, 'oem', '20910-4AU07', 'catálogo Hyundai', 0.9);
select public.afirma((select count(*) from public.produto_codigos where produto_id = :P1) = 1, 'código proposto');
select public.codigo_propor(:A, :P1, 'oem', '20910-4AU07', 'catálogo Hyundai', 0.9);
select public.afirma((select count(*) from public.produto_codigos where produto_id = :P1) = 1, 'código repetido não duplica');

select public.aplicacao_propor(:A, :P1, 'HR', '2.5 16V', 2013, null, 'manual técnico', 0.7);
select public.afirma((select count(*) from public.produto_aplicacoes where produto_id = :P1 and status = 'a_confirmar') = 1, 'aplicação proposta');

select public.imagem_propor(:A, :P1, 'https://cdn.com/a.jpg', 'busca_web', '80692', 'https://loja.com/pagina-a');
select public.afirma((select aprovada from public.produto_imagens where produto_id = :P1) = false, 'imagem nasce não aprovada');
select public.imagem_propor(:A, :P1, 'https://cdn.com/b.jpg', 'busca_web', '80692', null);
select public.imagem_decidir(:A, (select id from public.produto_imagens where produto_id = :P1 and url = 'https://cdn.com/a.jpg'), 'aprovar');
select public.afirma((select aprovada and principal from public.produto_imagens where url = 'https://cdn.com/a.jpg'), 'primeira aprovada vira principal');
select public.imagem_decidir(:A, (select id from public.produto_imagens where produto_id = :P1 and url = 'https://cdn.com/b.jpg'), 'rejeitar');
select public.afirma((select count(*) from public.produto_imagens where url = 'https://cdn.com/b.jpg') = 0, 'rejeitada é removida');
do $$ begin begin perform public.imagem_decidir('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'aprovar'); raise exception 'aceitou'; exception when no_data_found then null; end; end $$;
select public.afirma(true, 'decidir imagem inexistente falha');

select public.busca_imagem_salvar(:A, 'v2.k1.cifrado', 'cx-123456');
select public.afirma((select api_key_cifrada from public.busca_imagem_ler(:A)) = 'v2.k1.cifrado', 'credencial de busca de imagem salva');
select public.afirma((select count(*) from public.busca_imagem_ler(:B)) = 0, 'outra loja não enxerga a credencial');
select public.busca_imagem_desativar(:A);
select public.afirma((select count(*) from public.busca_imagem_ler(:A)) = 0, 'desativar some da leitura');
do $$ begin begin perform public.busca_imagem_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'cx'); raise exception 'aceitou'; exception when check_violation then null; end; end $$;
select public.afirma(true, 'cx curto demais é recusado');

insert into public.usuarios_loja (loja_id, user_id, papel) values (:A, '11111111-1111-1111-1111-111111111111', 'lojista');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin begin perform public.enriquecimento_propor('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'marca_peca', '"x"'::jsonb, 'f', null); raise exception 'aceitou'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'usuário logado não propõe direto (só via função que usa service_role)');
rollback;
