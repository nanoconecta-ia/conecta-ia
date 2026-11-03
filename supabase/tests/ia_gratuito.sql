-- Provedor gratuito (OpenRouter): modos desligado/manual/automático, chave preservada ao desligar, nunca principal, só service_role.
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
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set B '\'bbbbbbbb-0000-0000-0000-00000000000b\''

-- Gemini principal + gratuito: o gratuito não toma o lugar de principal
select public.ia_salvar_chave(:A, 'gemini', 'cifrada-gemini', 'abcd', 'gemini-2.5-flash', null, null);
select public.ia_salvar_chave(:A, 'openrouter_free', 'cifrada-free', 'wxyz', 'openrouter/free', null, null);
select public.afirma((select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'gemini'), 'Gemini continua principal');
select public.afirma(not (select principal from public.loja_chaves_ia where loja_id = :A and provedor = 'openrouter_free'), 'o gratuito nunca é principal');
-- sozinho numa loja também não vira principal
select public.ia_salvar_chave(:B, 'openrouter_free', 'cifrada-free-b', 'wxyz', 'openrouter/free', null, null);
select public.afirma(not (select principal from public.loja_chaves_ia where loja_id = :B), 'gratuito sozinho também não vira principal');

-- modos
select public.afirma(not public.ia_free_automatico(:A), 'recém-salvo: manual, sem troca automática');
select public.afirma(public.ia_definir_modo_free(:A, 'automatico'), 'modo automático aceito');
select public.afirma(public.ia_free_automatico(:A), 'automático: o servidor enxerga');
select public.afirma(not public.ia_free_automatico(:B), 'automático da loja A não vale para a loja B');
select public.afirma(public.ia_definir_modo_free(:A, 'desligado'), 'modo desligado aceito');
select public.afirma(not public.ia_free_automatico(:A), 'desligado: sem troca automática');
select public.afirma(not exists (select 1 from public.ia_chave_ativa(:A, 'openrouter_free')), 'desligado: a chave não é entregue ao chat');
select public.afirma((select chave_cifrada from private.chaves_ia_segredos s join public.loja_chaves_ia k on k.id = s.chave_id where k.loja_id = :A and k.provedor = 'openrouter_free') = 'cifrada-free', 'desligar PRESERVA a chave cifrada');
select public.afirma(public.ia_definir_modo_free(:A, 'manual'), 'modo manual aceito');
select public.afirma(exists (select 1 from public.ia_chave_ativa(:A, 'openrouter_free')), 'manual: a chave volta a ser entregue');
select public.afirma(not public.ia_free_automatico(:A), 'manual: sem troca automática');
select public.afirma(not public.ia_definir_modo_free(:A, 'qualquer'), 'modo desconhecido recusado');
select public.afirma(not public.ia_definir_modo_free('cccccccc-0000-0000-0000-00000000000c', 'manual'), 'sem chave salva não há modo');

-- só o gratuito pode ter failover
select public.espera_erro($$update public.loja_chaves_ia set failover = true where loja_id = 'aaaaaaaa-0000-0000-0000-00000000000a' and provedor = 'gemini'$$, 'loja_chaves_ia_failover_so_free', 'failover só existe para o gratuito');
-- remover a chave desliga o automático
select public.ia_definir_modo_free(:A, 'automatico');
select public.ia_desativar_chave(:A, 'openrouter_free');
select public.afirma(not public.ia_free_automatico(:A), 'remover a chave encerra o automático');
select public.afirma(not (select failover from public.loja_chaves_ia where loja_id = :A and provedor = 'openrouter_free'), 'e zera o failover');
select public.afirma(not public.ia_definir_modo_free(:A, 'automatico'), 'sem chave não dá para ligar o automático');

-- permissões: navegador não chama
select public.afirma(not has_function_privilege('anon', 'public.ia_definir_modo_free(uuid,text)', 'execute') and not has_function_privilege('authenticated', 'public.ia_definir_modo_free(uuid,text)', 'execute'), 'navegador não define o modo');
select public.afirma(not has_function_privilege('authenticated', 'public.ia_free_automatico(uuid)', 'execute'), 'navegador não consulta o automático');
select public.afirma(has_function_privilege('service_role', 'public.ia_definir_modo_free(uuid,text)', 'execute') and has_function_privilege('service_role', 'public.ia_free_automatico(uuid)', 'execute'), 'service_role executa');

-- o chat persistente aceita o provedor gratuito (turno e contabilização de uso) e continua recusando provedor desconhecido
insert into public.usuarios_loja (loja_id, user_id, papel) values ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista');
insert into public.loja_recursos (loja_id, recurso, ativo) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'chat_persistente', true);
select public.ia_salvar_chave(:A, 'openrouter_free', 'cifrada-free-2', 'wxyz', 'openrouter/free', null, null);
select public.afirma((public.chat_iniciar(:A, '11111111-1111-1111-1111-111111111111', null, 'oi', 'idem-free-0001', 'openrouter_free')->>'estado') = 'novo', 'chat_iniciar aceita openrouter_free');
select public.espera_erro($$select public.chat_iniciar('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', null, 'oi', 'idem-free-0002', 'provedor_inventado')$$, 'turno inválido', 'provedor desconhecido continua recusado');
rollback;
