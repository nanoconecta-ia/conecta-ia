-- Testa a busca direta por código OEM com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into public.fontes (id, tipo, titulo, url) values ('f0000000-0000-0000-0000-0000000000e1', 'outra', 'Fonte fictícia', 'https://exemplo.invalid/e');
insert into public.montadoras (id, nome) values ('a0000000-0000-0000-0000-0000000000e1', 'MontadoraBusca');
insert into public.modelos (id, montadora_id, nome, categoria) values ('a1000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-0000000000e1', 'ModeloBusca', 'van');
insert into public.geracoes (id, modelo_id, ordem) values ('a2000000-0000-0000-0000-0000000000e1', 'a1000000-0000-0000-0000-0000000000e1', 1);
insert into public.versoes (id, geracao_id, mercado, nome_comercial) values ('a3000000-0000-0000-0000-0000000000e1', 'a2000000-0000-0000-0000-0000000000e1', 'BR', 'VersaoBusca');
insert into public.familias_motor (id, nome) values ('a4000000-0000-0000-0000-0000000000e1', 'MOTORBUSCA');
insert into public.motores (id, familia_id, codigo, cilindrada_cc) values ('a5000000-0000-0000-0000-0000000000e1', 'a4000000-0000-0000-0000-0000000000e1', 'MB1', 2500);
-- peça aprovada, uma aplicação aprovada e outra a confirmar
insert into public.pecas_ref (id, classe, montadora_id, codigo, descricao, fonte_id, verificado_em, status)
  values ('a6000000-0000-0000-0000-0000000000e1', 'genuina', 'a0000000-0000-0000-0000-0000000000e1', '12345-6A789', 'Peça fictícia', 'f0000000-0000-0000-0000-0000000000e1', now(), 'aprovado');
insert into public.pecas_ref (id, classe, montadora_id, codigo, status) values ('a6000000-0000-0000-0000-0000000000e2', 'genuina', 'a0000000-0000-0000-0000-0000000000e1', '99999-0Z000', 'a_confirmar');
insert into public.pecas_aplicacoes_tecnicas (peca_id, versao_id, motor_id, periodo_inicio, fonte_id, verificado_em, status)
  values ('a6000000-0000-0000-0000-0000000000e1', 'a3000000-0000-0000-0000-0000000000e1', 'a5000000-0000-0000-0000-0000000000e1', 2015, 'f0000000-0000-0000-0000-0000000000e1', now(), 'aprovado');
insert into public.pecas_aplicacoes_tecnicas (peca_id, motor_id) values ('a6000000-0000-0000-0000-0000000000e1', 'a5000000-0000-0000-0000-0000000000e1');   -- a confirmar

select public.afirma((public.dna_por_codigo_oem(gen_random_uuid(), '12345-6A789')->'pecas'->0->>'codigo') = '12345-6A789', 'acha pelo código exato');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '123456a789')->>'codigo_normalizado' = '123456A789', 'ignora hífen, espaço e caixa (123456a789)');
select public.afirma((public.dna_por_codigo_oem(gen_random_uuid(), '12345 6A789')->'pecas'->0->>'classe') = 'genuina', 'acha com espaço no meio');
select public.afirma(jsonb_array_length(public.dna_por_codigo_oem(gen_random_uuid(), '12345-6A789')->'pecas'->0->'aplicacoes') = 1, 'por padrão só a aplicação APROVADA aparece');
select public.afirma(jsonb_array_length(public.dna_por_codigo_oem(gen_random_uuid(), '12345-6A789', false)->'pecas'->0->'aplicacoes') = 2, 'pedindo, aparecem as a confirmar (rotuladas pelo status)');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '12345-6A789')->'pecas'->0->'aplicacoes'->0->'veiculo'->>'versao' = 'VersaoBusca', 'aplicação traz a VERSÃO do veículo');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '12345-6A789')->'pecas'->0->'aplicacoes'->0->'motor'->>'codigo' = 'MB1', 'traz o modelo do motor');
select public.afirma(jsonb_array_length(public.dna_por_codigo_oem(gen_random_uuid(), '99999-0Z000')->'pecas') = 0, 'peça a confirmar não aparece por padrão');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '99999-0Z000')->'avisos'->>1 like '1 registro(s)%', 'avisa que há registro a confirmar oculto');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '00000-0X000')->'avisos'->>0 like 'Código não encontrado%', 'código desconhecido: avisa e não deduz');
select public.afirma(public.dna_por_codigo_oem(gen_random_uuid(), '123') ? 'erro', 'código curto demais é recusado');
rollback;
