-- Testa 20261029000001_exec_local_fila.sql: fila persistente do executor local. Duas lojas fictícias; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create function public.h(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;
create function public.espera_erro(cmd text, estado text) returns void language plpgsql as $$
begin
  begin execute cmd; exception when others then
    if sqlstate = estado then raise notice 'ok: erro % esperado', estado; return; end if;
    raise exception 'FALHOU: esperava % mas veio % (%) em: %', estado, sqlstate, sqlerrm, left(cmd, 90);
  end;
  raise exception 'FALHOU: não deu erro (esperava %) em: %', estado, left(cmd, 90);
end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'lojista'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000002', 'lojista');
insert into public.pair_dispositivos (id, loja_id, usuario_id, nome, tipo, capacidades) values
  ('d0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'PC A', 'agente_desktop', '{windows.sistema.inventario,windows.ambiente.versoes}'),
  ('d0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000002', 'PC B', 'agente_desktop', '{windows.sistema.inventario}'),
  ('d0000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'Navegador A', 'navegador', '{}');
insert into public.pair_sessoes (loja_id, usuario_id, dispositivo_id, token_hash, sal_hash, escopos, expira_em, limite_ate) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', public.h('tA'), public.h('sA'), '{produtos:ler}', now() + interval '1 hour', now() + interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b2b2b2b2-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b', public.h('tB'), public.h('sB'), '{produtos:ler}', now() + interval '1 hour', now() + interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000c', public.h('tN'), public.h('sN'), '{produtos:ler}', now() + interval '1 hour', now() + interval '1 day');

create function public.argv(cmd text) returns text[] language sql immutable as
$$ select array['powershell.exe','-NoProfile','-NonInteractive','-NoLogo','-Command', cmd] $$;
set local role service_role;

-- enfileirar
create temp table r (nome text primary key, v text);
grant all on r to service_role;
insert into r select 't1', public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', 'windows.sistema.inventario', public.argv('Get-CimInstance Win32_OperatingSystem'), 5000, 'chave-idem-1', 'gemini')::text;
select public.afirma((select v from r where nome = 't1') is not null, 'enfileira tarefa de dispositivo da loja com capacidade permitida');
select public.afirma(public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', 'windows.sistema.inventario', public.argv('x'), 5000, 'chave-idem-1')::text = (select v from r where nome = 't1'), 'idempotency_key devolve a mesma tarefa, sem duplicar');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.servico.reiniciar',public.argv('Restart-Service x'),5000)$$, '42501');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000b','windows.sistema.inventario',public.argv('x'),5000)$$, '42501');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000c','windows.sistema.inventario',public.argv('x'),5000)$$, '42501');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.sistema.inventario',array['cmd.exe','/c','dir','a','b','c'],5000)$$, '23514');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.sistema.inventario',public.argv(E'a\nwhoami'),5000)$$, '23514');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.sistema.inventario',public.argv('x'),600000)$$, '23514');

-- puxar: isolamento por loja e dispositivo, sem dupla retirada
select public.afirma(public.exec_local_puxar(public.h('tA'), public.h('errado')) is null, 'sal errado: sessão inválida (null)');
select public.afirma(public.exec_local_puxar(public.h('tN'), public.h('sN')) is null, 'sessão de dispositivo que não é agente_desktop não puxa tarefa');
select public.afirma(public.exec_local_puxar(public.h('tB'), public.h('sB')) = '{}'::jsonb, 'agente da loja B não enxerga a tarefa da loja A');
insert into r select 'p', public.exec_local_puxar(public.h('tA'), public.h('sA'))::text;
select public.afirma(((select v from r where nome = 'p')::jsonb ->> 'job_id') = (select v from r where nome = 't1'), 'agente A recebe a própria tarefa');
select public.afirma(((select v from r where nome = 'p')::jsonb -> 'argv' ->> 4) = '-Command', 'argv chega íntegro');
select public.afirma(public.exec_local_puxar(public.h('tA'), public.h('sA')) = '{}'::jsonb, 'segunda puxada não devolve a mesma tarefa');
select public.afirma((public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', (select v::uuid from r where nome = 't1')) ->> 'estado') = 'EM_EXECUCAO', 'estado EM_EXECUCAO');
select public.afirma(public.exec_local_estado('bbbbbbbb-0000-0000-0000-000000000002', (select v::uuid from r where nome = 't1')) is null, 'loja B não lê tarefa da loja A');

-- resultado
select public.afirma(public.exec_local_resultado(public.h('tB'), public.h('sB'), (select v::uuid from r where nome = 't1'), true, 'x', null) = 'ignorado', 'resultado de outro dispositivo é ignorado');
select public.afirma(public.exec_local_resultado(public.h('tA'), public.h('sA'), (select v::uuid from r where nome = 't1'), true, repeat('x', 70000), null) = 'CONCLUIDA', 'resultado do dono conclui');
select public.afirma(length(public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', (select v::uuid from r where nome = 't1')) ->> 'saida') = 65536, 'saída truncada em 64 KB');
select public.afirma(length(public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', (select v::uuid from r where nome = 't1')) ->> 'sha256') = 64, 'hash da saída gravado pelo banco');
select public.afirma(public.exec_local_resultado(public.h('tA'), public.h('sA'), (select v::uuid from r where nome = 't1'), true, 'outro', null) = 'ignorado', 'segundo resultado é ignorado (não sobrescreve)');

-- revogação, lease e limites
insert into r select 't2', public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000a', 'windows.ambiente.versoes', public.argv('y'), 5000)::text;
reset role;
update public.pair_dispositivos set revogado_em = now() where id = 'd0000000-0000-0000-0000-00000000000a';
set local role service_role;
select public.afirma(public.exec_local_puxar(public.h('tA'), public.h('sA')) is null, 'dispositivo revogado: agente não puxa mais (null)');
select public.afirma((public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', (select v::uuid from r where nome = 't2')) ->> 'estado') = 'CANCELADA', 'tarefa na fila de dispositivo revogado vira CANCELADA');
select public.espera_erro($$select public.exec_local_enfileirar('aaaaaaaa-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a','windows.sistema.inventario',public.argv('x'),5000)$$, '42501');
reset role;
insert into public.exec_local_tarefas (id, loja_id, dispositivo_id, capacidade, argv, timeout_ms, estado, iniciado_em, lease_ate) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b', 'windows.sistema.inventario', public.argv('z'), 5000, 'EM_EXECUCAO', now() - interval '1 minute', now() - interval '10 seconds');
set local role service_role;
select public.afirma((public.exec_local_estado('bbbbbbbb-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001') ->> 'estado') = 'DESCONHECIDO', 'lease vencida: DESCONHECIDO (não volta para a fila)');
select public.afirma(public.exec_local_resultado(public.h('tB'), public.h('sB'), 'eeeeeeee-0000-0000-0000-000000000001', true, 'tarde', null) = 'ignorado', 'resultado depois da lease é ignorado');
do $$ begin for i in 1..20 loop perform public.exec_local_enfileirar('bbbbbbbb-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-00000000000b', 'windows.sistema.inventario', public.argv('f' || i), 5000); end loop; end $$;
select public.espera_erro($$select public.exec_local_enfileirar('bbbbbbbb-0000-0000-0000-000000000002','d0000000-0000-0000-0000-00000000000b','windows.sistema.inventario',public.argv('21'),5000)$$, '54000');
select public.afirma(public.exec_local_cancelar('bbbbbbbb-0000-0000-0000-000000000002', (select id from public.exec_local_tarefas where loja_id = 'bbbbbbbb-0000-0000-0000-000000000002' and estado = 'NA_FILA' limit 1)), 'gateway cancela tarefa ainda na fila');

-- privilégios: só service_role
set local role authenticated;
select public.espera_erro($$select public.exec_local_estado('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid())$$, '42501');
select public.espera_erro($$select public.exec_local_puxar('x','y')$$, '42501');
select public.espera_erro($$select * from public.exec_local_tarefas$$, '42501');
set local role anon;
select public.espera_erro($$select public.exec_local_enfileirar(gen_random_uuid(), gen_random_uuid(), 'windows.a.b', array['x'], 5000)$$, '42501');
reset role;
select public.afirma((select count(*) from public.auditoria where acao = 'exec_local.enfileirada') >= 2 and (select count(*) from public.auditoria where acao = 'exec_local.concluida') = 1, 'auditoria registra enfileirada e concluída');
rollback;
