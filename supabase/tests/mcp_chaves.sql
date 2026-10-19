-- Chaves do gateway MCP: só lojista cria/revoga, expiração obrigatória, escopo sem aprovar/executar, hash nunca vai ao navegador.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function public.espera_erro(cmd text, trecho text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; exception when others then
    if sqlerrm like '%' || trecho || '%' then raise notice 'ok: %', msg; return; end if;
    raise exception 'FALHOU: % (erro diferente do esperado: %)', msg, sqlerrm;
  end;
  raise exception 'FALHOU: % (não levantou erro)', msg;
end $$;
insert into public.lojas (id, nome, slug) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'editor');
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set U1 '\'11111111-1111-1111-1111-111111111111\''
\set U2 '\'22222222-2222-2222-2222-222222222222\''
create temp table v (k text primary key, val text);
insert into v select 'k1', public.mcp_chave_criar(:A, :U1, 'ChatGPT', 'GPT', repeat('a', 64), 'cia_mcp_abcdef', array['leitura','propor'], now() + interval '30 days')::text;
select public.afirma((select count(*) from public.loja_mcp_chaves) = 1, 'chave criada');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'x', 'x', repeat('b', 64), 'p', array['leitura'], now() + interval '1 day')$$, 'sem_permissao', 'editor não cria chave');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'x', 'x', repeat('b', 64), 'p', array['leitura','aprovar'], now() + interval '1 day')$$, 'loja_mcp_chaves_escopos_validos', 'escopo "aprovar" não existe');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'x', 'x', repeat('b', 64), 'p', array['executar'], now() + interval '1 day')$$, 'loja_mcp_chaves_escopos_validos', 'escopo "executar" não existe');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'x', 'x', repeat('b', 64), 'p', array['leitura'], null)$$, 'expiracao_invalida', 'expiração é obrigatória');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'x', 'x', repeat('b', 64), 'p', array['leitura'], now() + interval '400 days')$$, 'expiracao_invalida', 'expiração máxima de 365 dias');
select public.espera_erro($$select public.mcp_chave_criar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'x', 'x', 'curto', 'p', array['leitura'], now() + interval '1 day')$$, 'hash_invalido', 'só hash sha256 é aceito (nunca o token)');
select public.afirma((select count(*) from public.mcp_chave_validar(repeat('a', 64))) = 1, 'validar encontra a chave pelo hash');
select public.afirma((select loja_id from public.mcp_chave_validar(repeat('a', 64))) = 'aaaaaaaa-0000-0000-0000-00000000000a', 'a chave só alcança a própria loja');
select public.afirma((select ultimo_uso_em is not null from public.loja_mcp_chaves limit 1), 'último uso registrado');
select public.afirma((select count(*) from public.mcp_chave_validar(repeat('c', 64))) = 0, 'hash desconhecido não valida');
update public.lojas set ativa = false where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.afirma((select count(*) from public.mcp_chave_validar(repeat('a', 64))) = 0, 'loja inativa não valida');
update public.lojas set ativa = true where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select public.espera_erro($$select public.mcp_chave_revogar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'k1'), '22222222-2222-2222-2222-222222222222')$$, 'sem_permissao', 'editor não revoga');
select public.afirma(public.mcp_chave_revogar(:A, (select val::uuid from v where k = 'k1'), :U1) = true, 'lojista revoga');
select public.afirma((select count(*) from public.mcp_chave_validar(repeat('a', 64))) = 0, 'chave revogada deixa de valer');
insert into v select 'k2', public.mcp_chave_criar(:A, :U1, 'curta', 'Gemini', repeat('d', 64), 'cia_mcp_ghijkl', array['leitura'], now() + interval '1 minute')::text;
update public.loja_mcp_chaves set expira_em = now() - interval '1 second' where hash_chave = repeat('d', 64);
select public.afirma((select count(*) from public.mcp_chave_validar(repeat('d', 64))) = 0, 'chave expirada deixa de valer');
select public.afirma((select count(*) from public.auditoria where acao in ('mcp.chave.criada', 'mcp.chave.revogada')) = 3, 'criação e revogação auditadas');
-- hash nunca sai para o navegador
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.espera_erro($$select hash_chave from public.loja_mcp_chaves$$, 'permission denied', 'hash_chave não é legível pelo painel');
select public.afirma((select count(*) from (select id, nome, escopos, prefixo, expira_em from public.loja_mcp_chaves) t) = 2, 'metadados da chave são legíveis, sem o hash');
select public.espera_erro($$select public.mcp_chave_validar(repeat('a', 64))$$, 'permission denied', 'usuário logado não valida chaves');
reset role;
rollback;
