-- Testa a máquina de estados do pipeline com dados FICTÍCIOS; desfaz tudo no fim.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if ok is distinct from true then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.recusa(cmd text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; raise exception 'FALHOU: aceitou -> %', msg;
  exception when insufficient_privilege or check_violation or unique_violation or invalid_parameter_value or no_data_found or serialization_failure or raise_exception then
    if sqlerrm like 'FALHOU:%' then raise; end if; raise notice 'ok: %', msg; end;
end $$;

insert into public.lojas (id, nome, slug) values ('d1000000-0000-0000-0000-0000000000a1', 'PL A', 'pl-a'), ('d1000000-0000-0000-0000-0000000000b2', 'PL B', 'pl-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('d1000000-0000-0000-0000-0000000000a1', 'd2000000-0000-0000-0000-000000000001', 'lojista'),
  ('d1000000-0000-0000-0000-0000000000a1', 'd2000000-0000-0000-0000-000000000002', 'editor'),
  ('d1000000-0000-0000-0000-0000000000b2', 'd2000000-0000-0000-0000-000000000003', 'lojista');
create temp table ctx as select public.pipeline_criar('d1000000-0000-0000-0000-0000000000a1', 'SKU-T1', null, '{"nome":"x"}', 'idem-pipeline-01') as id;

select public.afirma((select public.pipeline_criar('d1000000-0000-0000-0000-0000000000a1', 'SKU-T1', null, '{}', 'idem-pipeline-01')) = (select id from ctx), 'criar é idempotente pela chave');
select public.afirma((select public.pipeline_criar('d1000000-0000-0000-0000-0000000000a1', 'SKU-T1', null, '{}', 'idem-pipeline-99')) = (select id from ctx), 'mesmo SKU ativo não cria segundo item (sem duplicidade)');
select public.afirma((select count(*) from public.pipeline_itens) = 1, 'um único item ativo para o SKU');
select public.afirma((select public.pipeline_criar('d1000000-0000-0000-0000-0000000000b2', 'SKU-T1', null, '{}', 'idem-pipeline-01')) <> (select id from ctx), 'a mesma chave em OUTRA loja é um item separado (isolamento)');

-- transições
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aprovado', 1, 'agente')$$, 'pular direto de entrada para aprovado é recusado');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000b2', (select id from ctx), 'normalizado', 1, 'agente')$$, 'avançar item de outra loja é recusado');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'normalizado', 7, 'agente')$$, 'versão desatualizada é recusada (concorrência)');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'normalizado', 1, 'agente');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'identificado', 2, 'agente');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'pesquisado', 3, 'agente');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'comparado', 4, 'agente');

-- conflito bloqueia a validação até o lojista resolver
create temp table cf as select public.pipeline_registrar_conflito('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aplicacao', 'motor',
  '{"valor":"D4CB","fonte":"A"}', '{"valor":"D4BH","fonte":"B"}') as id;
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'validado', 5, 'agente')$$, 'conflito aberto impede validar');
select public.recusa($$select public.pipeline_resolver_conflito('d1000000-0000-0000-0000-0000000000a1', (select id from cf), 'd2000000-0000-0000-0000-000000000002', 'fonte A vale')$$, 'editor não resolve conflito');
select public.recusa($$select public.pipeline_resolver_conflito('d1000000-0000-0000-0000-0000000000b2', (select id from cf), 'd2000000-0000-0000-0000-000000000003', 'fonte A vale')$$, 'lojista de outra loja não resolve conflito alheio');
select public.pipeline_resolver_conflito('d1000000-0000-0000-0000-0000000000a1', (select id from cf), 'd2000000-0000-0000-0000-000000000001', 'fonte A vale: catálogo da montadora');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'validado', 5, 'agente');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'enriquecido', 6, 'agente', null, 'x', '[]')$$, 'enriquecer sem evidência é recusado');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'enriquecido', 6, 'agente', null, 'ok', '[{"fonte":"https://exemplo.invalid/a","consultado_em":"2026-10-19"}]');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aguardando_aprovacao', 7, 'agente');

-- aprovação é humana
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aprovado', 8, 'agente')$$, 'o agente não aprova');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aprovado', 8, 'editor', 'd2000000-0000-0000-0000-000000000002')$$, 'editor não aprova');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aprovado', 8, 'lojista-b', 'd2000000-0000-0000-0000-000000000003')$$, 'lojista de outra loja não aprova');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'aprovado', 8, 'lojista', 'd2000000-0000-0000-0000-000000000001', 'conferido');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'sincronizando', 9, 'agente')$$, 'sincronizar sem proposta é recusado');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'sincronizando', 9, 'executor', null, null, '[]', null, gen_random_uuid());
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'sincronizado', 10, 'executor', null, null, '[]')$$, 'concluir sem leitura de confirmação é recusado');
select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', (select id from ctx), 'sincronizado', 10, 'executor', null, 'leitura após escrita', '[{"leitura_confirmou":true}]');
select public.afirma((select estado from public.pipeline_itens where id = (select id from ctx)) = 'sincronizado', 'ciclo completo até sincronizado');
select public.afirma((select count(*) from public.pipeline_historico where item_id = (select id from ctx)) = 11, 'cada transição ficou no histórico (11 linhas)');
select public.afirma((select bool_or(por_humano) from public.pipeline_historico where item_id = (select id from ctx) and para = 'aprovado'), 'o histórico registra que a aprovação foi humana');
select public.recusa($$update public.pipeline_historico set motivo = 'adulterado'$$, 'histórico é imutável (update)');
select public.recusa($$delete from public.pipeline_historico$$, 'histórico é imutável (delete)');

-- após sincronizado o SKU pode ter novo ciclo
select public.afirma((select public.pipeline_criar('d1000000-0000-0000-0000-0000000000a1', 'SKU-T1', null, '{}', 'idem-pipeline-02')) <> (select id from ctx), 'depois de sincronizado, um novo ciclo do SKU é permitido');

-- fila: reserva, limite de simultâneos e recuo
insert into public.pipeline_itens (loja_id, sku, idempotency_key) select 'd1000000-0000-0000-0000-0000000000b2', 'Q' || g, 'idem-fila-' || lpad(g::text, 3, '0') from generate_series(1, 8) g;
select public.afirma((select count(*) from public.pipeline_reservar('d1000000-0000-0000-0000-0000000000b2', 10, 120, 5)) = 5, 'reserva respeita o limite de 5 simultâneos por loja');
select public.afirma((select count(*) from public.pipeline_reservar('d1000000-0000-0000-0000-0000000000b2', 10, 120, 5)) = 0, 'sem vagas: nenhuma reserva nova (limite de requisições)');
create temp table um as select id from public.pipeline_itens where loja_id = 'd1000000-0000-0000-0000-0000000000b2' and reservado_ate > now() limit 1;
select public.afirma((public.pipeline_falhar('d1000000-0000-0000-0000-0000000000b2', (select id from um), 'timeout')->>'tentativas')::int = 1, 'falha conta tentativa');
select public.afirma((select proxima_tentativa > now() + interval '5 seconds' from public.pipeline_itens where id = (select id from um)), 'falha agenda a próxima tentativa com recuo');
select public.pipeline_falhar('d1000000-0000-0000-0000-0000000000b2', (select id from um), 'timeout');
select public.pipeline_falhar('d1000000-0000-0000-0000-0000000000b2', (select id from um), 'timeout');
select public.pipeline_falhar('d1000000-0000-0000-0000-0000000000b2', (select id from um), 'timeout');
select public.afirma((public.pipeline_falhar('d1000000-0000-0000-0000-0000000000b2', (select id from um), 'timeout')->>'estado') = 'falhou', 'na 5ª falha o item vira "falhou" (sem laço infinito)');
select public.afirma(not exists (select 1 from public.pipeline_itens i where i.id in (select public.pipeline_reservar('d1000000-0000-0000-0000-0000000000a1')) and i.loja_id <> 'd1000000-0000-0000-0000-0000000000a1'), 'reservar na loja A só devolve itens da loja A');
select public.afirma((select count(*) from public.pipeline_itens where loja_id = 'd1000000-0000-0000-0000-0000000000a1' and reservado_ate > now()) = 1, 'a reserva da loja A pegou o item novo da própria loja');

-- usuários logados só leem a própria loja
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.afirma((select count(*) from public.pipeline_itens) >= 1 and (select count(*) from public.pipeline_itens where loja_id = 'd1000000-0000-0000-0000-0000000000b2') = 0, 'lojista A não vê itens da loja B');
select public.recusa($$select public.pipeline_avancar('d1000000-0000-0000-0000-0000000000a1', gen_random_uuid(), 'normalizado', 1, 'x')$$, 'usuário logado não executa as funções do pipeline');
reset role;
rollback;
