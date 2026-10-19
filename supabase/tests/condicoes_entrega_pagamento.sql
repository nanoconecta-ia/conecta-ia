-- Condições comerciais cadastradas (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values ('c9000000-0000-0000-0000-0000000000e1', 'Loja CE', 'ce-a'), ('c9000000-0000-0000-0000-0000000000e2', 'Outra CE', 'ce-b');

-- sem cadastro: tudo vira lacuna, nada é inventado
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1', '01310100')->'lacunas') = 2, 'sem cadastro: pagamento e entrega viram lacunas');
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1')->'pagamento') = 0, 'sem forma aprovada, lista de pagamento vazia');

-- rascunho não vale; aprovada exige revisão
insert into public.loja_formas_pagamento (loja_id, forma) values ('c9000000-0000-0000-0000-0000000000e1', 'pix');
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1')->'pagamento') = 0, 'forma em rascunho não aparece');
do $$ begin
  begin insert into public.loja_formas_pagamento (loja_id, forma, status) values ('c9000000-0000-0000-0000-0000000000e1', 'boleto', 'aprovada'); raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'forma aprovada sem revisão é recusada');
do $$ begin
  begin insert into public.loja_formas_pagamento (loja_id, forma, parcelas_max) values ('c9000000-0000-0000-0000-0000000000e1', 'pix', 3); raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'parcelas só valem para cartão de crédito');
update public.loja_formas_pagamento set status = 'aprovada', revisado_em = now(), revisado_por = gen_random_uuid() where forma = 'pix';
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1')->'pagamento') = 0, 'aprovada mas oculta: nada vai para o site');
update public.loja_formas_pagamento set visivel_no_site = true where forma = 'pix';
insert into public.loja_formas_pagamento (loja_id, forma, parcelas_max, status, visivel_no_site, revisado_em, revisado_por) values ('c9000000-0000-0000-0000-0000000000e1', 'cartao_credito', 6, 'aprovada', true, now(), gen_random_uuid());
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1')->'pagamento') = 2, 'pix e cartão aprovados aparecem');
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e2')->'pagamento') = 0, 'outra loja não vê as formas da primeira (isolamento)');

-- entrega por faixa de CEP
do $$ begin
  begin insert into public.loja_entrega_regras (loja_id, tipo, cep_inicio, cep_fim, fonte, status, revisado_em, revisado_por) values ('c9000000-0000-0000-0000-0000000000e1', 'transportadora', '01000000', '01999999', 'teste', 'aprovada', now(), gen_random_uuid()); raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'regra aprovada sem prazo máximo é recusada (não se promete prazo)');
do $$ begin
  begin insert into public.loja_entrega_regras (loja_id, tipo, cep_inicio, cep_fim, fonte) values ('c9000000-0000-0000-0000-0000000000e1', 'transportadora', '02000000', '01000000', 'teste'); raise exception 'deveria recusar'; exception when check_violation then null; end;
end $$;
select public.afirma(true, 'faixa de CEP invertida é recusada');
insert into public.loja_entrega_regras (loja_id, tipo, cep_inicio, cep_fim, prazo_dias_min, prazo_dias_max, valor_frete, fonte, status, revisado_em, revisado_por)
  values ('c9000000-0000-0000-0000-0000000000e1', 'transportadora', '01000000', '01999999', 2, 4, null, 'tabela do lojista', 'aprovada', now(), gen_random_uuid());
select public.afirma(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1', '01310100')->'lacunas' @> '"regras de entrega (nenhuma aprovada e visível)"'::jsonb, 'regra aprovada mas oculta não vai para o site');
update public.loja_entrega_regras set visivel_no_site = true where loja_id = 'c9000000-0000-0000-0000-0000000000e1';
update public.loja_entrega_regras set status = 'rascunho' where loja_id = 'c9000000-0000-0000-0000-0000000000e1';
select public.afirma(not (select visivel_no_site from public.loja_entrega_regras where loja_id = 'c9000000-0000-0000-0000-0000000000e1'), 'voltar a rascunho oculta automaticamente');
update public.loja_entrega_regras set status = 'aprovada', revisado_em = now(), revisado_por = gen_random_uuid(), visivel_no_site = true where loja_id = 'c9000000-0000-0000-0000-0000000000e1';
insert into public.loja_formas_pagamento (loja_id, forma, visivel_no_site) values ('c9000000-0000-0000-0000-0000000000e1', 'boleto', true);
select public.afirma(not (select visivel_no_site from public.loja_formas_pagamento where forma = 'boleto'), 'item em rascunho nunca fica visível, mesmo se pedirem');
select public.afirma(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1')->'lacunas' @> '"CEP do cliente (necessário para prazo e frete)"'::jsonb, 'com regra mas sem CEP, pede o CEP');
select public.afirma((public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1', '01310-100')->'entrega'->0->>'prazo_dias_max')::int = 4, 'CEP dentro da faixa traz o prazo cadastrado');
select public.afirma((public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1', '01310100')->'entrega'->0->>'frete_a_calcular')::boolean, 'frete sem valor fica "a calcular", nunca grátis');
select public.afirma(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e1', '20000000')->'lacunas' @> '"este CEP não tem regra de entrega cadastrada: ofereça o atendente"'::jsonb, 'CEP fora da faixa: lacuna e atendente');
select public.afirma(jsonb_array_length(public.condicoes_comerciais('c9000000-0000-0000-0000-0000000000e2', '01310100')->'entrega') = 0, 'outra loja não usa a regra da primeira (isolamento)');

-- papéis: editor não aprova nem mostra; lojista aprova e o servidor carimba a revisão (não o navegador)
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('c9000000-0000-0000-0000-0000000000e2', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('c9000000-0000-0000-0000-0000000000e2', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.loja_formas_pagamento (id, loja_id, forma) values ('d1000000-0000-0000-0000-0000000000e2', 'c9000000-0000-0000-0000-0000000000e2', 'pix');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  begin update public.loja_formas_pagamento set status = 'aprovada' where id = 'd1000000-0000-0000-0000-0000000000e2'; raise exception 'deveria recusar'; exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'editor não aprova');
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
update public.loja_formas_pagamento set status = 'aprovada', revisado_por = '99999999-9999-9999-9999-999999999999' where id = 'd1000000-0000-0000-0000-0000000000e2';
select public.afirma((select revisado_por from public.loja_formas_pagamento where id = 'd1000000-0000-0000-0000-0000000000e2') = '33333333-3333-3333-3333-333333333333', 'lojista aprova e a revisão é carimbada pelo servidor com o id dele');
update public.loja_formas_pagamento set visivel_no_site = true where id = 'd1000000-0000-0000-0000-0000000000e2';
update public.loja_formas_pagamento set visivel_no_site = false where id = 'd1000000-0000-0000-0000-0000000000e2';
select public.afirma(not (select visivel_no_site from public.loja_formas_pagamento where id = 'd1000000-0000-0000-0000-0000000000e2'), 'botão ocultar funciona');
reset role;
rollback;
