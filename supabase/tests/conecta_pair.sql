-- Testa 20261019000001_conecta_pair.sql: pareamento, sessões e Central de Aprovações. Duas lojas fictícias; desfaz tudo.
-- Concorrência real (várias conexões): supabase/tests/conecta_pair_concorrencia.sh
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create function public.h(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;
-- Executa um comando COM O PAPEL ATUAL e exige o SQLSTATE informado.
create function public.espera_erro(cmd text, estado text) returns void language plpgsql as $$
begin
  begin execute cmd; exception when others then
    if sqlstate = estado then raise notice 'ok: erro % esperado', estado; return; end if;
    raise exception 'FALHOU: esperava % mas veio % (%) em: %', estado, sqlstate, sqlerrm, left(cmd, 90);
  end;
  raise exception 'FALHOU: não deu erro (esperava %) em: %', estado, left(cmd, 90);
end $$;
-- Troca de identidade (JWT simulado). amr com timestamp = autenticação recente.
create function public.como(uid text, recente boolean default true) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', case when uid is null then '{}' else
    jsonb_build_object('sub', uid, 'amr', jsonb_build_array(jsonb_build_object('method', 'password',
      'timestamp', extract(epoch from now())::bigint - case when recente then 0 else 7200 end)))::text end, true);
  set local role authenticated;
end $$;
create function public.servidor() returns void language plpgsql as $$ begin reset role; set local role service_role; end $$;
create function public.admin() returns void language plpgsql as $$ begin reset role; end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'lojista'),   -- U1 lojista A
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),    -- U2 editor A
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'lojista'),   -- U3 lojista B
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'lojista');   -- U4 segundo lojista A
insert into public.produtos (id, loja_id, bling_id, sku, nome) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1', 'SKU-A', 'Peça A'),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'b2', 'SKU-B', 'Peça B');

-- helper: cria um desafio (como o servidor faria) e devolve o id
create function public.novo_desafio(cod text, tipo text default 'navegador', escopos text[] default array['produtos:ler', 'banners:propor'],
  caps text[] default '{}', dur int default 60) returns jsonb language sql as $$
  select public.pair_iniciar(public.h(cod), public.h('SEG-' || cod), public.h('VER-' || cod), public.h('TOK-' || cod),
    'Notebook da loja', tipo, escopos, caps, dur, 120) $$;

-- ===================================================================================================================
-- A) Permissões de superfície
select public.servidor();
select public.afirma(public.novo_desafio('C1') ->> 'id' is not null, 'servidor cria desafio (expira em ~2 min)');
select public.afirma((select expira_em - criado_em from public.pair_desafios where codigo_hash = public.h('C1')) <= interval '120 seconds', 'TTL do desafio nunca passa de 2 min');
select public.espera_erro($$select public.pair_iniciar(public.h('X1'), public.h('s'), public.h('v'), public.h('t'), 'n', 'navegador', array['aprovacoes:aprovar'], '{}', 60)$$, '22023');
select public.espera_erro($$select public.pair_iniciar(public.h('X2'), public.h('s'), public.h('v'), public.h('t2'), 'n', 'navegador', array['produtos:ler','admin:tudo'], '{}', 60)$$, '22023');
select public.espera_erro($$select public.pair_iniciar(public.h('X3'), public.h('s'), public.h('v'), public.h('t3'), 'n', 'navegador', array['produtos:ler'], array['teclado.digitar'], 60)$$, '22023');
select public.espera_erro($$select public.pair_iniciar('curto', public.h('s'), public.h('v'), public.h('t4'), 'n', 'navegador', array['produtos:ler'], '{}', 60)$$, '23514');
select public.espera_erro($$select public.pair_iniciar(public.h('X5'), public.h('s'), public.h('v'), public.h('t5'), 'n', 'navegador', array['produtos:ler'], '{}', 9999)$$, '23514');
select public.afirma(not exists (select 1 from unnest(private.pair_escopos_validos()) e where e ~ '(aprovar|executar|admin)'), 'nenhum escopo permite aprovar, executar ou administrar');

select public.como('11111111-1111-1111-1111-111111111111');
select public.espera_erro($$select * from public.pair_desafios$$, '42501');                    -- sem grant
select public.espera_erro($$select token_hash from public.pair_sessoes$$, '42501');              -- hash nunca vai ao navegador
select public.espera_erro($$select public.pair_validar(public.h('x'))$$, '42501');               -- só servidor
select public.espera_erro($$select public.pair_consultar(public.h('x'), public.h('y'))$$, '42501');
select public.espera_erro($$select public.aprovacao_consumir(gen_random_uuid(), 'x')$$, '42501');
select public.como(null);
select public.espera_erro($$select public.pair_detalhe('C1')$$, '28000');                        -- sem login
select public.espera_erro($$select public.aprovacao_decidir(gen_random_uuid(), 'x', 'aprovar')$$, '28000');
reset role; set local role anon;
select public.espera_erro($$select public.pair_detalhe('C1')$$, '42501');
select public.espera_erro($$select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', '1', array['produtos:ler'], 10)$$, '42501');

-- ===================================================================================================================
-- B) Fluxo feliz, detalhes mostrados ao aprovador e QR/usuário não autorizado
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.pair_detalhe('C1') ->> 'nome') = 'Notebook da loja', 'aprovador vê o nome do dispositivo');
select public.afirma(jsonb_array_length(public.pair_detalhe('C1') -> 'lojas') = 1 and (public.pair_detalhe('C1') -> 'lojas' -> 0 ->> 'nome') = 'Loja A', 'aprovador vê só as lojas que administra');
select public.afirma(public.pair_detalhe('C1')::text !~ 'VER-C1|123456|verificacao', 'detalhe NÃO revela o código de verificação');
select public.afirma(public.pair_detalhe('INEXISTENTE') is null, 'código desconhecido não revela nada');

select public.como('22222222-2222-2222-2222-222222222222');  -- EDITOR
select public.espera_erro($$select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler'], 10)$$, '42501');
select public.como('33333333-3333-3333-3333-333333333333');  -- lojista de OUTRA loja tentando parear na loja A
select public.espera_erro($$select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler'], 10)$$, '42501');
select public.como('44444444-4444-4444-4444-444444444444');
select public.espera_erro($$select public.pair_aprovar('C1', 'bbbbbbbb-0000-0000-0000-000000000002', 'VER-C1', array['produtos:ler'], 10)$$, '42501'); -- troca de loja
select public.admin();
select public.afirma((select estado from public.pair_desafios where codigo_hash = public.h('C1')) = 'pendente', 'tentativas não autorizadas não mudam o desafio');

select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'errado', array['produtos:ler'], 10) ->> 'motivo') = 'verificacao_incorreta', 'verificação incorreta é recusada');
select public.afirma((select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler', 'tarefas:ler'], 10) ->> 'motivo') = 'escopo_alem_do_solicitado', 'aprovar escopo além do solicitado é recusado');
select public.afirma((select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler'], 600) ->> 'motivo') = 'duracao_invalida', 'duração maior que a solicitada é recusada');
select public.afirma((select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler'], 30) ->> 'ok')::boolean, 'lojista aprova com escopo e duração MENORES');
-- QR reutilizado
select public.afirma((select public.pair_aprovar('C1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C1', array['produtos:ler'], 30) ->> 'motivo') = 'desafio_ja_usado', 'QR já aprovado não pode ser aprovado de novo');
select public.afirma(public.pair_detalhe('C1') is null, 'QR aprovado deixa de aparecer');

-- resgate atômico
select public.servidor();
select public.afirma((select public.pair_consultar(public.h('C1'), public.h('ERRADO')) ->> 'estado') = 'invalido', 'segredo errado: não resgata nem revela estado');
create temp table r1 as select public.pair_consultar(public.h('C1'), public.h('SEG-C1')) j;
grant select on r1 to public;
select public.afirma((select j ->> 'estado' from r1) = 'resgatado', 'solicitante resgata após a aprovação');
select public.afirma((select j::text from r1) !~ 'TOK-C1|token', 'resposta do resgate NÃO contém token nem segredo');
select public.afirma((select count(*) from public.pair_sessoes) = 1 and (select count(*) from public.pair_dispositivos) = 1, 'uma sessão e um dispositivo criados');
select public.afirma((select limite_ate - criado_em from public.pair_sessoes) between interval '29 minutes' and interval '31 minutes', 'sessão limitada à duração aprovada (30 min)');
select public.afirma((select expira_em - criado_em from public.pair_sessoes) <= interval '15 minutes', 'token de acesso dura no máximo 15 min');
-- perda de conexão: repetir devolve o MESMO resultado, sem nova sessão
select public.afirma((select public.pair_consultar(public.h('C1'), public.h('SEG-C1')) ->> 'dispositivo_id') = (select j ->> 'dispositivo_id' from r1), 'repetir o resgate (resposta perdida) devolve o mesmo dispositivo');
select public.afirma((select count(*) from public.pair_sessoes) = 1, 'repetir o resgate NÃO cria nova sessão');
-- vínculo sessão/usuário/loja/dispositivo
select public.afirma((select loja_id = 'aaaaaaaa-0000-0000-0000-000000000001' and usuario_id = '11111111-1111-1111-1111-111111111111' and escopos = array['produtos:ler'] from public.pair_sessoes), 'sessão ligada à loja, ao usuário aprovador e aos escopos aprovados');
select public.admin();
select public.afirma((select count(*) from public.auditoria where acao = 'pair.aprovado' and user_id = '11111111-1111-1111-1111-111111111111' and loja_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'auditoria do pareamento com usuário e loja');
select public.afirma((select (depois ->> 'dispositivo_id') is not null from public.auditoria where acao = 'pair.sessao_criada'), 'auditoria da sessão com dispositivo');

-- ===================================================================================================================
-- C) Validação do token a cada chamada, rotação, replay e revogação
select public.servidor();
select public.afirma((select public.pair_validar(public.h('TOK-C1')) ->> 'loja_id') = 'aaaaaaaa-0000-0000-0000-000000000001', 'token válido resolve a loja da sessão (não a que o cliente disser)');
select public.afirma(public.pair_validar(public.h('qualquer')) is null, 'token desconhecido é recusado');
select public.afirma(public.pair_validar('nao-e-hash') is null, 'formato inválido é recusado');
select public.afirma((select public.pair_renovar(public.h('TOK-C1'), public.h('TOK-C1')) ->> 'motivo') = 'token_novo_invalido', 'renovar com o mesmo token é recusado');
select public.afirma((select public.pair_renovar(public.h('TOK-C1'), public.h('TOK-C1-v2')) ->> 'ok')::boolean, 'renovação rotaciona o token');
select public.afirma((select public.pair_validar(public.h('TOK-C1-v2')) ->> 'atual')::boolean, 'novo token vale');
select public.afirma(public.pair_validar(public.h('TOK-C1')) is not null, 'token anterior tolera 60 s (resposta perdida)');
select public.afirma((select public.pair_renovar(public.h('TOK-C1'), public.h('TOK-C1-v3')) ->> 'ok')::boolean is not true, 'token anterior não renova');
select public.admin();
update public.pair_sessoes set rotacionado_em = now() - interval '5 minutes';
select public.servidor();
select public.afirma(public.pair_validar(public.h('TOK-C1')) is null, 'REPLAY do token anterior após a tolerância é recusado');
select public.afirma(public.pair_validar(public.h('TOK-C1-v2')) is null, '...e a sessão inteira é revogada (ladrão e dono perdem acesso)');
select public.admin();
select public.afirma((select motivo_revogacao from public.pair_sessoes) = 'replay_token_anterior', 'motivo registrado');
select public.afirma((select count(*) from public.auditoria where acao = 'pair.replay_detectado') = 1, 'replay auditado');

-- nova sessão para testar expiração, papel perdido e revogação
select public.servidor(); select public.novo_desafio('C2');
select public.como('11111111-1111-1111-1111-111111111111');
select public.pair_aprovar('C2', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C2', array['produtos:ler', 'banners:propor'], 60);
select public.servidor(); select public.pair_consultar(public.h('C2'), public.h('SEG-C2'));
select public.afirma(public.pair_validar(public.h('TOK-C2')) is not null, 'sessão C2 ativa');
select public.admin();
update public.pair_sessoes set expira_em = now() - interval '1 second' where token_hash = public.h('TOK-C2');
select public.servidor();
select public.afirma(public.pair_validar(public.h('TOK-C2')) is null, 'token de acesso expirado é recusado');
select public.admin();
update public.pair_sessoes set expira_em = now() + interval '10 minutes' where token_hash = public.h('TOK-C2');
update public.usuarios_loja set papel = 'editor' where user_id = '11111111-1111-1111-1111-111111111111';
select public.servidor();
select public.afirma(public.pair_validar(public.h('TOK-C2')) is null, 'se o aprovador perde o papel de lojista, a sessão deixa de valer (sem elevação por herança)');
select public.admin();
update public.usuarios_loja set papel = 'lojista' where user_id = '11111111-1111-1111-1111-111111111111';
select public.servidor();
select public.afirma(public.pair_validar(public.h('TOK-C2')) is not null, 'papel restaurado: sessão volta a valer');

-- revogação: quem pode e quem não pode
select public.admin();
select set_config('t.disp', (select dispositivo_id::text from public.pair_sessoes where token_hash = public.h('TOK-C2')), true),
       set_config('t.sess', (select id::text from public.pair_sessoes where token_hash = public.h('TOK-C2')), true);
select public.como('22222222-2222-2222-2222-222222222222');  -- editor
select public.espera_erro(format($$select public.pair_revogar_dispositivo(%L)$$, current_setting('t.disp')), '42501');
select public.como('33333333-3333-3333-3333-333333333333');  -- lojista de outra loja
select public.espera_erro(format($$select public.pair_revogar_sessao(%L)$$, current_setting('t.sess')), '42501');
select public.espera_erro($$select public.pair_revogar_todos('aaaaaaaa-0000-0000-0000-000000000001')$$, '42501');
select public.como('44444444-4444-4444-4444-444444444444');  -- outro lojista da MESMA loja pode encerrar
select public.afirma((select public.pair_revogar_dispositivo(current_setting('t.disp')::uuid, 'teste') ->> 'sessoes_encerradas')::int = 1, 'lojista encerra o dispositivo remotamente');
select public.servidor();
select public.afirma(public.pair_validar(public.h('TOK-C2')) is null, 'sessão revogada é recusada na PRÓXIMA chamada');
select public.afirma((select public.pair_consultar(public.h('C2'), public.h('SEG-C2')) ->> 'revogada')::boolean, 'o solicitante descobre que foi revogado');
select public.afirma((select public.pair_renovar(public.h('TOK-C2'), public.h('TOK-C2-novo')) ->> 'ok')::boolean is not true, 'sessão revogada não renova');

-- ===================================================================================================================
-- D) Expirado, recusado, tentativas e concorrência sequencial
select public.servidor(); select public.novo_desafio('C3');
select public.admin();
update public.pair_desafios set expira_em = now() - interval '1 second' where codigo_hash = public.h('C3');
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma(public.pair_detalhe('C3') is null, 'QR expirado não é mostrado ao aprovador');
select public.afirma((select public.pair_aprovar('C3', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C3', array['produtos:ler'], 10) ->> 'motivo') = 'expirado', 'QR expirado não pode ser aprovado');
select public.servidor();
select public.afirma((select public.pair_consultar(public.h('C3'), public.h('SEG-C3')) ->> 'estado') = 'expirado', 'solicitante vê expirado');

select public.novo_desafio('C4');
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.pair_recusar('C4') ->> 'ok')::boolean, 'lojista recusa o pareamento');
select public.afirma((select public.pair_aprovar('C4', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C4', array['produtos:ler'], 10) ->> 'motivo') = 'desafio_ja_usado', 'recusado não pode ser aprovado depois');
select public.servidor();
select public.afirma((select public.pair_consultar(public.h('C4'), public.h('SEG-C4')) ->> 'estado') = 'recusado', 'solicitante vê recusado e não recebe sessão');

select public.novo_desafio('C5');
select public.como('11111111-1111-1111-1111-111111111111');
select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'x1', array['produtos:ler'], 10);
select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'x2', array['produtos:ler'], 10);
select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'x3', array['produtos:ler'], 10);
select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'x4', array['produtos:ler'], 10);
select public.afirma((select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'x5', array['produtos:ler'], 10) ->> 'motivo') = 'verificacao_incorreta', '5ª tentativa errada ainda é só "incorreta"');
select public.afirma((select public.pair_aprovar('C5', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C5', array['produtos:ler'], 10) ->> 'motivo') = 'desafio_ja_usado', 'após 5 erros o desafio é bloqueado (mesmo com o código certo)');

-- aprovado mas não resgatado a tempo
select public.servidor(); select public.novo_desafio('C6');
select public.como('11111111-1111-1111-1111-111111111111');
select public.pair_aprovar('C6', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-C6', array['produtos:ler'], 10);
select public.admin();
update public.pair_desafios set expira_em = now() - interval '1 second' where codigo_hash = public.h('C6');
select public.servidor();
select public.afirma((select public.pair_consultar(public.h('C6'), public.h('SEG-C6')) ->> 'estado') = 'expirado', 'aprovado mas não resgatado dentro do prazo expira');
select public.afirma((select count(*) from public.pair_sessoes where token_hash = public.h('TOK-C6')) = 0, '...e nenhuma sessão nasce');

-- agente desktop: sem capacidades por padrão; exige login recente; capacidades só um subconjunto
select public.novo_desafio('D1', 'agente_desktop', array['produtos:ler'], array['janela.listar', 'bling.abrir_tela'], 60);
select public.como('11111111-1111-1111-1111-111111111111', false);
select public.afirma((select public.pair_aprovar('D1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-D1', array['produtos:ler'], 30, array['janela.listar']) ->> 'motivo') = 'reconfirmacao_necessaria', 'agente desktop exige autenticação recente');
select public.como('11111111-1111-1111-1111-111111111111', true);
select public.afirma((select public.pair_aprovar('D1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-D1', array['produtos:ler'], 30, array['teclado.digitar']) ->> 'motivo') = 'capacidade_alem_da_solicitada', 'capacidade não solicitada é recusada');
select public.afirma((select public.pair_aprovar('D1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-D1', array['produtos:ler'], 30, array['janela.listar']) ->> 'ok')::boolean, 'aprova SÓ a capacidade janela.listar');
select public.servidor(); select public.pair_consultar(public.h('D1'), public.h('SEG-D1'));
select public.afirma((select public.pair_validar(public.h('TOK-D1')) -> 'capacidades') = '["janela.listar"]'::jsonb, 'dispositivo desktop carrega só as capacidades aprovadas');
select public.servidor(); select public.novo_desafio('D2', 'agente_desktop');
select public.afirma((select public.pair_validar(public.h('TOK-D2'))) is null, 'sem aprovação não há sessão');
select public.admin();
select public.afirma((select capacidades_solicitadas from public.pair_desafios where codigo_hash = public.h('D2')) = '{}', 'agente desktop nasce SEM nenhuma capacidade');

-- sessão NÃO renovável (agente que guarda um token estático): vale até o fim da duração aprovada, não gira, e o dispositivo pode se encerrar
select public.servidor();
select public.pair_iniciar(public.h('N1'), public.h('SEG-N1'), public.h('VER-N1'), public.h('TOK-N1'), 'Agente token estático', 'agente_externo', array['produtos:ler'], '{}', 45, 120, false);
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.pair_detalhe('N1') ->> 'renovavel') = 'false', 'aprovador vê que a sessão NÃO é renovável');
select public.pair_aprovar('N1', 'aaaaaaaa-0000-0000-0000-000000000001', 'VER-N1', array['produtos:ler'], 45);
select public.servidor(); select public.pair_consultar(public.h('N1'), public.h('SEG-N1'));
select public.admin();
select public.afirma((select limite_ate - expira_em from public.pair_sessoes where token_hash = public.h('TOK-N1')) < interval '1 second', 'não renovável: o token vale até o fim da duração aprovada');
select public.servidor();
select public.afirma((select public.pair_renovar(public.h('TOK-N1'), public.h('TOK-N1b')) ->> 'motivo') = 'sessao_nao_renovavel', 'sessão não renovável recusa rotação');
select public.afirma(public.pair_validar(public.h('TOK-N1')) is not null, 'o token estático segue válido até o prazo');
select public.afirma((select public.pair_encerrar(public.h('TOK-N1')) ->> 'ok')::boolean, 'o próprio dispositivo encerra a sessão (botão de interrupção local)');
select public.afirma(public.pair_validar(public.h('TOK-N1')) is null, '...e ela deixa de valer na hora');
select public.afirma((select public.pair_encerrar(public.h('TOK-N1')) ->> 'ok')::boolean is not true, 'encerrar de novo não faz nada');
select public.afirma((select public.pair_encerrar(public.h('qualquer')) ->> 'ok')::boolean is not true, 'encerrar com token desconhecido não revela nada');
select public.admin();
select public.afirma((select count(*) from public.auditoria where acao = 'pair.sessao_encerrada_pelo_dispositivo') = 1, 'encerramento pelo dispositivo auditado');

-- ===================================================================================================================
-- E) Central de Aprovações
select public.servidor();
create temp table ap as select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'conecta.propose_banner', 'Agente X',
  null, null, '11111111-1111-1111-1111-111111111111', '[{"tabela":"banners"}]', null, '{"titulo":"Promo"}', array['aparece no site'], 'LOW', 'idem-0001') j;
grant select on ap to public;
select public.afirma((select j ->> 'risco' from ap) = 'MEDIUM', 'agente não consegue rebaixar o risco (banner = MEDIUM no mínimo)');
select public.afirma((select (j ->> 'versao')::int from ap) = 1 and (select j ->> 'hash_proposta' from ap) ~ '^[0-9a-f]{64}$', 'versão 1 com hash SHA-256');
select public.afirma((select count(*) from public.notificacoes where tipo = 'aprovacao' and loja_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'notificação criada na Central');
-- duplicada
select public.afirma((select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'conecta.propose_banner', 'Agente X',
  null, null, '11111111-1111-1111-1111-111111111111', '[{"tabela":"banners"}]', null, '{"titulo":"Promo"}', array['aparece no site'], 'LOW', 'idem-0001') ->> 'duplicado')::boolean, 'solicitação duplicada (mesma chave e conteúdo) devolve a existente');
select public.afirma((select count(*) from public.aprovacoes) = 1, '...sem criar outra linha');
select public.espera_erro($$select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'conecta.propose_banner', 'Agente X',
  null, null, null, '[{"tabela":"banners"}]', null, '{"titulo":"OUTRO"}', '{}', 'LOW', 'idem-0001')$$, '23505');
select public.espera_erro($$select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'f.x', 'A', null, null, null,
  '[{"tabela":"produtos","id":"b1b1b1b1-0000-0000-0000-000000000002"}]', null, '{}', '{}', 'LOW', 'idem-0002')$$, '42501');   -- produto da loja B
select public.espera_erro($$select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'tipo_inexistente', 'f.x', 'A', null, null, null, '[]', null, '{}', '{}', 'LOW', 'idem-0003')$$, '23514');
select public.espera_erro($$select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'f.x', 'A', null, null, null, '[{"tabela":"usuarios"}]', null, '{}', '{}', 'LOW', 'idem-0004')$$, '22023');

-- isolamento entre lojas e papéis na leitura/decisão
select public.como('33333333-3333-3333-3333-333333333333');
select public.afirma((select count(*) from public.aprovacoes) = 0, 'lojista da loja B NÃO enxerga aprovações da loja A (RLS)');
select public.espera_erro(format($$select public.aprovacao_decidir(%L, 'qualquer', 'aprovar')$$, (select j ->> 'id' from ap)), '42501');
select public.como('22222222-2222-2222-2222-222222222222');
select public.afirma((select count(*) from public.aprovacoes) = 1, 'editor da loja A enxerga a Central');
select public.espera_erro(format($$select public.aprovacao_decidir(%L, 'qualquer', 'aprovar')$$, (select j ->> 'id' from ap)), '42501');   -- mas não decide
select public.como('11111111-1111-1111-1111-111111111111');
-- adulteração
select public.admin();
select public.espera_erro($$update public.aprovacoes set depois = '{"titulo":"ADULTERADO"}'$$, '42501');
select public.espera_erro($$update public.aprovacoes set hash_proposta = repeat('0', 64)$$, '42501');
select public.espera_erro($$update public.aprovacoes set risco = 'LOW'$$, '42501');
select public.espera_erro($$update public.aprovacoes set estado = 'executada'$$, '42501');                      -- pula etapas
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap), repeat('a', 64), 'aprovar') ->> 'motivo') = 'proposta_alterada', 'decidir com hash diferente do da proposta é recusado');
select public.admin();
select public.afirma((select estado from public.aprovacoes) = 'pendente', '...e a proposta segue pendente');
select public.afirma((select count(*) from public.auditoria where acao = 'aprovacao.hash_divergente') = 1, 'tentativa divergente auditada');

-- nova versão invalida a aprovação anterior
select public.como('11111111-1111-1111-1111-111111111111');
create temp table ap_a as select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap), (select j ->> 'hash_proposta' from ap), 'aprovar') j;
select public.afirma((select j ->> 'ok' from ap_a)::boolean, 'lojista aprova a versão 1 (hash visto confere)');
select public.servidor();
create temp table ap2 as select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'banner_publicacao', 'conecta.propose_banner', 'Agente X',
  null, null, null, '[{"tabela":"banners"}]', null, '{"titulo":"Promo v2"}', '{}', 'MEDIUM', 'idem-0005', 60, (select (j ->> 'grupo_id')::uuid from ap)) j;
grant select on ap2 to public;
select public.afirma((select (j ->> 'versao')::int from ap2) = 2, 'alteração gera a versão 2');
select public.admin();
select public.afirma((select estado from public.aprovacoes where versao = 1) = 'substituida', 'a aprovação da versão 1 é SUBSTITUÍDA (alteração exige nova aprovação)');
select public.servidor();
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap), (select j ->> 'hash_proposta' from ap)) ->> 'motivo') = 'estado_substituida', 'executor não consegue usar a versão 1');
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap), (select j ->> 'hash_proposta' from ap), 'aprovar') ->> 'motivo') = 'estado_substituida', 'decidir a versão 1 depois da v2 é recusado');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap2), (select j ->> 'hash_proposta' from ap), 'aprovar') ->> 'motivo') = 'proposta_alterada', 'aprovar a v2 com o hash da v1 é recusado');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap2), (select j ->> 'hash_proposta' from ap2), 'aprovar') ->> 'ok')::boolean, 'a v2 aprovada com o hash da v2');

-- execução: uma vez, versão exata, dentro do prazo
select public.servidor();
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap2), repeat('b', 64)) ->> 'motivo') = 'versao_diferente', 'executor com hash errado é recusado');
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap2), (select j ->> 'hash_proposta' from ap2)) ->> 'ok')::boolean, 'executor reivindica a aprovação (aprovada -> executando)');
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap2), (select j ->> 'hash_proposta' from ap2)) ->> 'motivo') = 'estado_executando', 'segunda execução da MESMA aprovação é recusada');
select public.afirma((select public.aprovacao_concluir((select (j ->> 'id')::uuid from ap2), true, '{"publicado":true}') ->> 'estado') = 'executada', 'execução concluída e registrada');
select public.afirma((select public.aprovacao_concluir((select (j ->> 'id')::uuid from ap2), false) ->> 'ok')::boolean is not true, 'não se conclui duas vezes');

-- recusa, prazo e reconfirmação
select public.servidor();
create temp table ap3 as select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'orcamento_alteracao', 'conecta.alter_budget', 'Agente Ads',
  null, null, null, '[{"tabela":"orcamentos"}]', '{"valor":100}', '{"valor":900}', array['gasto'], 'LOW', 'idem-0006', 60) j;
grant select on ap3 to public;
select public.afirma((select j ->> 'risco' from ap3) = 'HIGH', 'orçamento é HIGH mesmo que o agente declare LOW');
select public.como('11111111-1111-1111-1111-111111111111', false);
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap3), (select j ->> 'hash_proposta' from ap3), 'aprovar') ->> 'motivo') = 'reconfirmacao_necessaria', 'HIGH exige autenticação recente para APROVAR');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap3), (select j ->> 'hash_proposta' from ap3), 'recusar', 'caro demais') ->> 'estado') = 'recusada', 'recusar não exige reconfirmação e funciona');
select public.servidor();
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap3), (select j ->> 'hash_proposta' from ap3)) ->> 'motivo') = 'estado_recusada', 'operação RECUSADA não executa');
select public.afirma((select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'catalogo_publicacao', 'conecta.publish_catalog', 'Ag', null, null, null, '[{"tabela":"catalogo"}]', null, '{}', '{}', 'LOW', 'idem-0007', 60) ->> 'risco') = 'HIGH', 'publicar catálogo é HIGH');
create temp table ap4 as select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'catalogo_publicacao', 'conecta.publish_catalog', 'Ag', null, null, null, '[{"tabela":"catalogo"}]', null, '{"v":2}', '{}', 'LOW', 'idem-0008', 60) j;
grant select on ap4 to public;
select public.como('11111111-1111-1111-1111-111111111111', true);
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap4), (select j ->> 'hash_proposta' from ap4), 'aprovar') ->> 'ok')::boolean, 'com login recente, HIGH é aprovado');
select public.admin();
update public.aprovacoes set estado = 'aprovada' where false; -- no-op
-- prazo: aprovada mas vencida não executa (expira_em é imutável; simula o relógio com trigger desligado só no teste)
alter table public.aprovacoes disable trigger aprovacao_guarda_upd;
update public.aprovacoes set expira_em = now() - interval '1 second' where id = (select (j ->> 'id')::uuid from ap4);
alter table public.aprovacoes enable trigger aprovacao_guarda_upd;
select public.servidor();
select public.afirma((select public.aprovacao_consumir((select (j ->> 'id')::uuid from ap4), (select j ->> 'hash_proposta' from ap4)) ->> 'motivo') = 'expirada', 'aprovação vencida não executa');
create temp table ap5 as select public.aprovacao_propor('aaaaaaaa-0000-0000-0000-000000000001', 'pagina_alteracao', 'conecta.edit_page', 'Ag', null, null, null, '[{"tabela":"paginas"}]', null, '{}', '{}', 'LOW', 'idem-0009', 60) j;
grant select on ap5 to public;
select public.admin();
alter table public.aprovacoes disable trigger aprovacao_guarda_upd;
update public.aprovacoes set expira_em = now() - interval '1 second' where id = (select (j ->> 'id')::uuid from ap5);
alter table public.aprovacoes enable trigger aprovacao_guarda_upd;
select public.como('11111111-1111-1111-1111-111111111111');
select public.afirma((select public.aprovacao_decidir((select (j ->> 'id')::uuid from ap5), (select j ->> 'hash_proposta' from ap5), 'aprovar') ->> 'motivo') = 'expirada', 'proposta vencida não pode mais ser aprovada');

-- auditoria carrega usuário, loja, dispositivo/sessão e operação
select public.admin();
select public.afirma((select count(*) from public.auditoria where acao like 'aprovacao.%' and loja_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 6, 'ciclo de aprovações auditado');
select public.afirma((select count(*) from public.auditoria where acao = 'aprovacao.proposta' and depois ? 'ferramenta' and depois ? 'agente') >= 1, 'auditoria da proposta registra ferramenta e agente');
select public.espera_erro($$delete from public.auditoria$$, 'P0001');   -- continua imutável

rollback;
