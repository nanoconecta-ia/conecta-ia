-- O vocabulário de busca nasce do cadastro (dados FICTÍCIOS); desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.montadoras (id, nome) values ('d0000000-0000-0000-0000-0000000000a1', 'MarcaVoc');
insert into public.modelos (id, montadora_id, nome, categoria) values ('d1000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000a1', 'ModeloVoc', 'utilitario');
insert into public.geracoes (id, modelo_id, ordem) values ('d2000000-0000-0000-0000-0000000000a1', 'd1000000-0000-0000-0000-0000000000a1', 1);
insert into public.versoes (geracao_id, mercado, nome_comercial) values ('d2000000-0000-0000-0000-0000000000a1', 'BR', 'Voc BR'), ('d2000000-0000-0000-0000-0000000000a1', 'EU', 'Voc EU');
select public.afirma((select x->>'modelo' from jsonb_array_elements(public.vocabulario_de_busca()->'modelos') x where x->>'montadora' = 'MarcaVoc') = 'ModeloVoc', 'o modelo cadastrado entra no vocabulário');
select public.afirma((select x->'versoes' from jsonb_array_elements(public.vocabulario_de_busca()->'modelos') x where x->>'montadora' = 'MarcaVoc') = '["Voc BR"]'::jsonb, 'só versões do mercado BR');
select public.afirma(jsonb_array_length(public.vocabulario_de_busca()->'pecas') > 40, 'famílias de peça vêm da taxonomia de autopeças');
rollback;
