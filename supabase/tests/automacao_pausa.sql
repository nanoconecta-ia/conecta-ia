-- Pausa do cadastro automático, pendências de publicação e bula proposta/aprovada (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('c9000000-0000-0000-0000-0000000000d1', 'Loja AP', 'ap-a'), ('c9000000-0000-0000-0000-0000000000d2', 'Outra AP', 'ap-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('c9000000-0000-0000-0000-0000000000d1', '51111111-1111-1111-1111-111111111111', 'lojista'),
  ('c9000000-0000-0000-0000-0000000000d1', '52222222-2222-2222-2222-222222222222', 'editor'),
  ('c9000000-0000-0000-0000-0000000000d2', '53333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, estoque, publicado) values
  ('c8000000-0000-0000-0000-0000000000d1', 'c9000000-0000-0000-0000-0000000000d1', 'ap1', 'AP-1', 'Peça 1', 100, 5, false),
  ('c8000000-0000-0000-0000-0000000000d2', 'c9000000-0000-0000-0000-0000000000d1', 'ap2', 'AP-2', 'Peça 2', 100, 5, false),
  ('c8000000-0000-0000-0000-0000000000d3', 'c9000000-0000-0000-0000-0000000000d2', 'ap3', 'AP-3', 'Peça de outra loja', 100, 5, false);

-- pendências: lista o que falta, sem publicar
select public.afirma(public.produto_pendencias('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1')->'faltando' @> '"imagem_principal"'::jsonb, 'pendências apontam a imagem principal que falta');
select public.afirma(not (public.produto_pendencias('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1')->>'pronto_para_publicar')::boolean, 'produto incompleto não está pronto');
select public.afirma(public.produto_pendencias('c9000000-0000-0000-0000-0000000000d2', 'c8000000-0000-0000-0000-0000000000d1') ? 'erro', 'pendência de produto de outra loja é recusada');

-- bula proposta pelo agente: rascunho com fonte; medida sem número é recusada
select public.afirma(public.bula_propor('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1', '{"espessura": {"valor": 1.2, "unidade": "mm"}}', array['Não reutilizar parafusos'], 'catálogo do fabricante p.12') ->> 'status' = 'rascunho', 'bula entra em rascunho');
select public.afirma(public.bula_propor('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1', '{"espessura": {"valor": "abc", "unidade": "mm"}}', '{}', 'x') ? 'erro', 'medida sem valor numérico é recusada');
select public.afirma(public.bula_propor('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1', '{"espessura": {"valor": 1, "unidade": "mm"}}', '{}', '  ') ? 'erro', 'sem fonte é recusada');
select public.afirma(public.bula_propor('c9000000-0000-0000-0000-0000000000d2', 'c8000000-0000-0000-0000-0000000000d1', '{"espessura": {"valor": 1, "unidade": "mm"}}', '{}', 'x') ? 'erro', 'bula em produto de outra loja é recusada');

-- editor não aprova; lojista aprova; agente não altera bula aprovada
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin begin perform public.bula_aprovar('c8000000-0000-0000-0000-0000000000d1'); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'editor não aprova bula');
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.bula_aprovar('c8000000-0000-0000-0000-0000000000d1')->>'aprovada')::boolean, 'lojista aprova a bula (que tem fonte)');
reset role;
select public.afirma(not (public.produto_pendencias('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1')->'faltando' @> '"bula_tecnica"'::jsonb), 'com a bula aprovada, ela sai das pendências');
select public.afirma(public.bula_propor('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d1', '{"espessura": {"valor": 9, "unidade": "mm"}}', '{}', 'outra fonte') ? 'erro', 'agente não altera bula aprovada');

-- pausa: lote, isolamento, banco recusa proposta de agente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"52222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin begin perform public.automacao_pausar(array['c8000000-0000-0000-0000-0000000000d1']::uuid[], true); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'editor não pausa');
select set_config('request.jwt.claims', '{"sub":"53333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
do $$ begin begin perform public.automacao_pausar(array['c8000000-0000-0000-0000-0000000000d1']::uuid[], true); raise exception 'deveria recusar'; exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista de outra loja não pausa produto alheio');
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.automacao_pausar(array['c8000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d2']::uuid[], true, 'revisando lote')->>'produtos')::int = 2, 'lojista pausa um lote de 2 produtos');
reset role;
select public.afirma((public.produto_pendencias('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d2')->>'automacao_pausada')::boolean, 'a pendência mostra que está pausado');
do $$ begin
  begin insert into public.produto_codigos (loja_id, produto_id, tipo, valor, fonte) values ('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d2', 'oem', 'XYZ-123', 'teste'); raise exception 'deveria recusar'; exception when sqlstate '55000' then null; end;
end $$;
select public.afirma(true, 'proposta de código em produto pausado é recusada pelo banco');
do $$ begin begin perform public.bula_propor('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d2', '{"a": {"valor": 1, "unidade": "mm"}}', '{}', 'f'); raise exception 'deveria recusar'; exception when sqlstate '55000' then null; end; end $$;
select public.afirma(true, 'bula proposta em produto pausado é recusada pelo banco');
-- retomar libera
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((public.automacao_pausar(array['c8000000-0000-0000-0000-0000000000d2']::uuid[], false)->>'pausado')::boolean = false, 'retomar libera o produto');
reset role;
insert into public.produto_codigos (loja_id, produto_id, tipo, valor, fonte) values ('c9000000-0000-0000-0000-0000000000d1', 'c8000000-0000-0000-0000-0000000000d2', 'oem', 'XYZ-123', 'teste');
select public.afirma(true, 'depois de retomar a proposta entra');
select public.afirma(exists (select 1 from public.auditoria where acao = 'automacao.pausada' and loja_id = 'c9000000-0000-0000-0000-0000000000d1'), 'pausa fica na auditoria');
rollback;
