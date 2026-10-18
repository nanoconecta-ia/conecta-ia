-- Testa a migração de integrações de IA (chave BYOK e plugins). Duas lojas fictícias; desfaz tudo.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Loja B', 'loja-b');

-- chave: salvar, ler, limite, mês, desativar
select public.ia_salvar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude', 'v2.k1.cifrado', '1234', 'claude-sonnet-5-5', 100000, null);
select public.afirma((select cifrada from public.ia_ler_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude')) = 'v2.k1.cifrado', 'chave ativa é lida');
select public.afirma((select count(*) from public.ia_ler_chave('bbbbbbbb-0000-0000-0000-000000000002', 'claude')) = 0, 'outra loja não enxerga a chave');
select public.ia_registrar_uso('aaaaaaaa-0000-0000-0000-000000000001', 'claude', 500);
select public.ia_registrar_uso('aaaaaaaa-0000-0000-0000-000000000001', 'claude', -90);
select public.afirma((select tokens_mes from public.ia_ler_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude')) = 500, 'uso soma e ignora negativo');
update public.loja_chaves_ia set mes_ref = date '2020-01-01' where loja_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.afirma((select tokens_mes from public.ia_ler_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude')) = 0, 'consumo zera na virada do mês');
do $$ begin
  begin perform public.ia_salvar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'inventado', 'x', '1', null, null, null); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'provedor desconhecido é recusado');
select public.ia_desativar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude');
select public.afirma((select count(*) from public.ia_ler_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude')) = 0, 'chave desativada não é devolvida');
select public.afirma((select chave_cifrada from private.chaves_ia_segredos limit 1) = '', 'segredo apagado ao desativar');

-- plugins
select public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'Fornecedor X', 'api', 'https://exemplo.com.br/hook', 'v2.k1.cred', array['enriquecer'], 'LOW');
select public.afirma((select ativo from public.loja_plugins where nome = 'Fornecedor X') = false, 'plugin novo nasce desligado');
select public.afirma((select public.plugin_definir_ativo('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.loja_plugins where nome = 'Fornecedor X'), true)), 'ativar plugin da própria loja');
select public.afirma(not (select public.plugin_definir_ativo('bbbbbbbb-0000-0000-0000-000000000002', (select id from public.loja_plugins where nome = 'Fornecedor X'), true)), 'outra loja não ativa o plugin');
select public.afirma((select public.plugin_credencial('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.loja_plugins where nome = 'Fornecedor X'))) = 'v2.k1.cred', 'credencial lida pela loja dona');
select public.afirma((select public.plugin_credencial('bbbbbbbb-0000-0000-0000-000000000002', (select id from public.loja_plugins where nome = 'Fornecedor X'))) is null, 'credencial inacessível a outra loja');
select public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'fornecedor x', 'api', 'https://exemplo.com.br/v2', null, array['enriquecer', 'imagem'], 'LOW');
select public.afirma((select count(*) from public.loja_plugins where loja_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'mesmo nome (sem diferenciar maiúscula) atualiza');
select public.afirma((select ativo from public.loja_plugins where nome ilike 'fornecedor x') = false, 'editar plugin o desliga');
select public.afirma((select public.plugin_credencial('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.loja_plugins limit 1))) = 'v2.k1.cred', 'credencial preservada quando não é reenviada');
do $$ begin
  begin perform public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'Local', 'api', 'http://exemplo.com', null, '{}', 'LOW'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'URL http (sem TLS) é recusada');
do $$ begin
  begin perform public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'Com chave', 'api', 'https://exemplo.com/x?token=abc', null, '{}', 'LOW'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'URL com query (token) é recusada');
do $$ begin
  begin perform public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'Cap', 'api', 'https://exemplo.com/x', null, array['apagar_tudo'], 'LOW'); raise exception 'aceitou';
  exception when check_violation then null; end;
end $$;
select public.afirma(true, 'capacidade fora da lista é recusada');
select public.plugin_remover('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.loja_plugins limit 1));
select public.afirma((select public.plugin_credencial('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.loja_plugins limit 1))) is null, 'plugin removido não entrega credencial');
select public.plugin_salvar('aaaaaaaa-0000-0000-0000-000000000001', 'Fornecedor X', 'api', 'https://exemplo.com.br/hook', 'v2.k1.nova', '{}', 'LOW');
select public.afirma((select count(*) from public.loja_plugins where loja_id = 'aaaaaaaa-0000-0000-0000-000000000001' and removido_em is null) = 1, 'nome pode ser reutilizado após remover');

-- RLS: lojista da A vê os plugins da A e não os da B
insert into public.usuarios_loja (loja_id, user_id, papel) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'lojista');
select public.plugin_salvar('bbbbbbbb-0000-0000-0000-000000000002', 'Da B', 'api', 'https://b.exemplo.com', null, '{}', 'LOW');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.loja_plugins) = 1, 'RLS: só os plugins da própria loja');
do $$ begin
  begin perform public.ia_salvar_chave('aaaaaaaa-0000-0000-0000-000000000001', 'claude', 'x', '1', null, null, null); raise exception 'aceitou';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'usuário logado não executa as funções de segredo');
do $$ begin
  begin perform 1 from private.plugin_segredos; raise exception 'aceitou';
  exception when insufficient_privilege then null; end;
end $$;
select public.afirma(true, 'usuário logado não lê private.plugin_segredos');
rollback;
