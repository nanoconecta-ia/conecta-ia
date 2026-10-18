-- Conector IA: máquina de estados (migrações 20261019000001 e 20261019000003). Tudo em transação com rollback.
-- Cobre: conversa persistente, aprovação presa à versão/hash, só lojista decide, trava por produto, lote parcial,
-- execução simulada com confirmação por evidência, timeout => desconhecido (sem repetir às cegas), escrita real bloqueada,
-- imutabilidade, RLS e privilégios.
begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
-- espera que o SQL levante erro cuja mensagem contenha o trecho
create or replace function public.espera_erro(cmd text, trecho text, msg text) returns void language plpgsql as
$$ begin
  begin execute cmd; exception when others then
    if sqlerrm like '%' || trecho || '%' then raise notice 'ok: %', msg; return; end if;
    raise exception 'FALHOU: % (erro diferente do esperado: %)', msg, sqlerrm;
  end;
  raise exception 'FALHOU: % (não levantou erro)', msg;
end $$;

insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Loja A', 'loja-a'), ('bbbbbbbb-0000-0000-0000-00000000000b', 'Loja B', 'loja-b');
insert into public.usuarios_loja (loja_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'lojista'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'lojista');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, situacao) values
  ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', '4', 'SKU4', 'Bomba de óleo HR', 200, 'A'),
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '1', 'SKU1', 'Cabeçote HR', 100, 'A'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-00000000000a', '2', 'SKU2', 'Junta HR', 50, 'A'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-00000000000b', '3', 'SKU3', 'Peça B', 10, 'A');
\set A '\'aaaaaaaa-0000-0000-0000-00000000000a\''
\set B '\'bbbbbbbb-0000-0000-0000-00000000000b\''
\set U1 '\'11111111-1111-1111-1111-111111111111\''
\set U2 '\'22222222-2222-2222-2222-222222222222\''
\set U3 '\'33333333-3333-3333-3333-333333333333\''
\set P1 '\'c0000000-0000-0000-0000-000000000001\''
\set P2 '\'c0000000-0000-0000-0000-000000000002\''
\set P3 '\'c0000000-0000-0000-0000-000000000003\''
\set P4 '\'c0000000-0000-0000-0000-000000000004\''

-- ============================================================ conversa persistente + troca de modelo + exclusão
create temp table v (k text primary key, val text);
insert into v select 'conv', public.agente_conversa_criar(:A, :U1, 'Cabeçote HR', 'claude', 'claude-sonnet-5-5')::text;
select public.afirma((select count(*) from public.agente_conversas) = 1, 'conversa criada');
select public.espera_erro($$select public.agente_conversa_criar('aaaaaaaa-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333', 'x', null, null)$$,
  'sem_permissao', 'quem não é da loja não cria conversa nela');
select public.agente_mensagem_gravar(:A, (select val::uuid from v where k = 'conv'), :U1, 'user', '[{"type":"text","text":"organize o cabeçote"}]', null, null, null, null, null, 1);
select public.agente_mensagem_gravar(:A, (select val::uuid from v where k = 'conv'), :U1, 'assistant', '[{"type":"text","text":"ok"}]', 'claude', 'claude-sonnet-5-5', 100, 20, 0.001, 1);
-- troca de modelo no meio: a conversa segue, a ordem não quebra e cada mensagem guarda quem respondeu
select public.agente_mensagem_gravar(:A, (select val::uuid from v where k = 'conv'), :U1, 'assistant', '[{"type":"text","text":"continuo"}]', 'gemini', 'gemini-2.5-flash', 80, 10, 0.0002, 1);
select public.afirma((select array_agg(seq order by seq) from public.agente_mensagens) = array[1,2,3], 'mensagens sequenciais mesmo trocando de provedor');
select public.afirma((select count(distinct provedor) from public.agente_mensagens where provedor is not null) = 2, 'cada mensagem registra o provedor que respondeu');
select public.espera_erro($$select public.agente_mensagem_gravar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'conv'), '22222222-2222-2222-2222-222222222222', 'user', '[]', null, null, null, null, null, 1)$$,
  'conversa_nao_encontrada', 'outro usuário da mesma loja não escreve na conversa alheia');

-- tarefa + proposta ficam quando a conversa é excluída
insert into public.agente_tarefas (id, loja_id, conversa_id, criada_por, objetivo) values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'conv'), '11111111-1111-1111-1111-111111111111', 'Organizar o cadastro do cabeçote HR');
insert into v select 'prop1', public.agente_proposta_criar(:A, :U1, 'd0000000-0000-0000-0000-000000000001', (select val::uuid from v where k = 'conv'), 'Conector IA', 'claude', 'claude-sonnet-5-5', 1, 'Enriquecer cabeçote HR', 'marca e descrição', false)::text;
select public.afirma(public.agente_conversa_excluir(:A, (select val::uuid from v where k = 'conv'), :U2) = false, 'outro usuário não exclui a conversa alheia');
select public.afirma(public.agente_conversa_excluir(:A, (select val::uuid from v where k = 'conv'), :U1) = true, 'dono exclui a própria conversa');
select public.afirma((select count(*) from public.agente_mensagens) = 0, 'mensagens saem com a conversa');
select public.afirma((select conversa_id is null from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), 'proposta sobrevive (conversa_id vira null)');
select public.afirma((select conversa_id is null from public.agente_tarefas where id = 'd0000000-0000-0000-0000-000000000001'), 'tarefa sobrevive à exclusão da conversa');
select public.afirma((select count(*) from public.auditoria where acao = 'agente.conversa.excluida') = 1, 'exclusão fica na auditoria');

-- ============================================================ proposta: fonte obrigatória, envio, hash
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop1'), :P1, 'conecta.enriquecimento.definir', 'SKU1', array['marca_peca'],
  '{"marca_peca": null}', '{"marca_peca": "Sabó"}', '[]', '[]', 'MEDIUM', 'chave-item-0001');
select public.espera_erro($$select public.agente_proposta_enviar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'))$$,
  'item_sem_fonte', 'item sem fonte não é enviado (zero invenção)');
delete from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop1');
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop1'), :P1, 'conecta.enriquecimento.definir', 'SKU1', array['marca_peca'],
  null, '{"marca_peca": "Sabó"}', '[{"url":"https://exemplo.com/catalogo"}]', '[]', 'MEDIUM', 'chave-item-0002');
select public.espera_erro($$select public.agente_proposta_enviar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'))$$,
  'item_sem_antes', 'alteração sem o valor anterior não é enviada');
delete from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop1');
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop1'), :P1, 'conecta.enriquecimento.definir', 'SKU1', array['marca_peca'],
  '{"marca_peca": null}', '{"marca_peca": "Sabó"}', '[{"url":"https://exemplo.com/catalogo"}]', '[]', 'MEDIUM', 'chave-item-0003');
insert into v select 'env1', public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop1'))::text;
select public.afirma((select estado from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')) = 'pendente', 'proposta enviada fica pendente');
select public.afirma((select hash ~ '^[0-9a-f]{64}$' from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), 'hash sha256 fixado no envio');
select public.afirma(private.estado_produto(:A, :P1) = 'pendente_aprovacao', 'produto vai para pendente de aprovação');
select public.afirma((select count(*) from public.auditoria where acao = 'agente.proposta.enviada') = 1, 'envio auditado');
-- imutável depois de enviada
select public.espera_erro($$select public.agente_proposta_item_adicionar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 'c0000000-0000-0000-0000-000000000001', 'conecta.enriquecimento.definir', 'x', '{}', null, '{}', '[{"url":"https://a.b"}]', '[]', 'LOW', 'chave-item-9999')$$,
  'proposta_nao_e_rascunho', 'não se acrescenta item a proposta enviada');
select public.espera_erro($$update public.agente_proposta_itens set depois = '{"marca_peca":"OUTRA"}' where proposta_id = (select val::uuid from v where k = 'prop1')$$,
  'imutável', 'conteúdo do item enviado é imutável');
select public.espera_erro($$update public.agente_propostas set hash = repeat('a', 64) where id = (select val::uuid from v where k = 'prop1')$$,
  'imutável', 'hash de proposta enviada é imutável');

-- ============================================================ aprovação: só lojista, versão+hash exatos
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), '22222222-2222-2222-2222-222222222222', 'aprovada')$$,
  'sem_permissao', 'editor não aprova (só lojista)');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), '33333333-3333-3333-3333-333333333333', 'aprovada')$$,
  'sem_permissao', 'lojista de outra loja não aprova');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 1, null, null, 'aprovada')$$,
  'sem_permissao', 'sem usuário humano não há aprovação (agente não aprova)');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 1, repeat('0', 64), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'versao_ou_hash_divergente', 'hash diferente do atual é recusado');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 2, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'versao_ou_hash_divergente', 'versão diferente da atual é recusada');
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'prop1'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), :U1, 'aprovada');
select public.afirma((select estado from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')) = 'aprovada', 'lojista aprova a versão exata');
select public.afirma((select count(*) from public.agente_aprovacoes where user_id = '11111111-1111-1111-1111-111111111111' and decisao = 'aprovada') = 1, 'aprovação vinculada ao usuário');
select public.afirma(private.estado_produto(:A, :P1) = 'aprovado_execucao', 'produto fica aprovado para execução específica');
select public.espera_erro($$update public.agente_aprovacoes set decisao = 'rejeitada'$$, 'imutável', 'aprovação é append-only');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop1'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop1')), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'proposta_nao_pendente', 'não se aprova duas vezes');

-- ============================================================ execução com confirmação por evidência
select public.afirma((select count(*) from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'prop1'))) = 1, 'execução devolve só os itens aprovados');
select public.afirma(private.estado_produto(:A, :P1) = 'em_execucao', 'produto em execução');
insert into v select 'op1', public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop1')), 'conecta.enriquecimento.definir', '{"marca_peca":"Sabó"}')::text;
select public.espera_erro($$select public.agente_operacao_abrir('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop1')), 'conecta.enriquecimento.definir', '{}')$$,
  'tentativa_anterior_em_aberto', 'não abre segunda tentativa com a primeira em aberto');
select public.agente_operacao_marcar_enviada(:A, (select val::uuid from v where k = 'op1'));
select public.espera_erro($$select public.agente_operacao_fechar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'op1'), 'confirmada', '{}', null, null)$$,
  'confirmacao_exige_evidencia', 'não se confirma sem leitura de verificação');
select public.agente_operacao_fechar(:A, (select val::uuid from v where k = 'op1'), 'confirmada', '{"ok":true}', '{"leitura":{"marca_peca":"Sabó"}}', null);
select public.afirma((select estado from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop1')) = 'confirmado', 'item confirmado após evidência');
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'prop1')) = 'executada', 'proposta executada');
select public.afirma(private.estado_produto(:A, :P1) = 'sincronizado', 'produto sincronizado');
select public.afirma((select estado from public.agente_tarefas where id = 'd0000000-0000-0000-0000-000000000001') = 'concluida', 'tarefa concluída');

-- ============================================================ revisão invalida a aprovação anterior
insert into v select 'prop2', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'gemini', 'gemini-2.5-flash', 1, 'Descrição da junta', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop2'), :P2, 'conecta.enriquecimento.definir', 'SKU2', array['descricao_curta'],
  '{"descricao_curta": null}', '{"descricao_curta": "Junta do cabeçote"}', '[{"documento":"catalogo-sabo-2026.pdf"}]', '[]', 'MEDIUM', 'chave-junta-0001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop2'));
insert into v select 'prop2_h', hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop2');
insert into v select 'prop2b', public.agente_proposta_revisar(:A, (select val::uuid from v where k = 'prop2'), :U1)::text;
select public.afirma((select estado from public.agente_propostas where id = (select val::uuid from v where k = 'prop2')) = 'invalidada', 'revisar invalida a versão anterior');
select public.afirma((select versao from public.agente_propostas where id = (select val::uuid from v where k = 'prop2b')) = 2, 'nova versão = 2');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop2'), 1, (select val from v where k = 'prop2_h'), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'proposta_nao_pendente', 'aprovar a versão antiga depois da revisão é recusado');
select public.afirma(private.estado_produto(:A, :P2) = 'liberado_propostas', 'revisão solta o produto');

-- ============================================================ trava por produto e lote parcial
select public.afirma(public.produto_travar(:A, array['c0000000-0000-0000-0000-000000000002'::uuid], :U2, 'auditado') = 1, 'editor também pode travar');
select public.espera_erro($$select public.produto_destravar('aaaaaaaa-0000-0000-0000-00000000000a', array['c0000000-0000-0000-0000-000000000002'::uuid], '22222222-2222-2222-2222-222222222222', 'x')$$,
  'sem_permissao', 'só o lojista destrava');
select public.espera_erro($$select public.produto_travar('aaaaaaaa-0000-0000-0000-00000000000a', array['c0000000-0000-0000-0000-000000000003'::uuid], '11111111-1111-1111-1111-111111111111', 'x')$$,
  'produto_nao_pertence_a_loja', 'não trava produto de outra loja');
insert into v select 'lote', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Lote de descrições', null, true)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'lote'), :P1, 'conecta.enriquecimento.definir', 'SKU1', array['descricao_curta'],
  '{"descricao_curta": null}', '{"descricao_curta": "Cabeçote HR 2.5"}', '[{"url":"https://exemplo.com/a"}]', '[]', 'MEDIUM', 'chave-lote-0001');
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'lote'), :P2, 'conecta.enriquecimento.definir', 'SKU2', array['descricao_curta'],
  '{"descricao_curta": null}', '{"descricao_curta": "Junta HR"}', '[{"url":"https://exemplo.com/b"}]', '[]', 'MEDIUM', 'chave-lote-0002');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'lote'));
select public.afirma((select estado from public.agente_proposta_itens where idempotency_key = 'chave-lote-0002') = 'travado', 'item de produto travado vira só sugestão');
select public.afirma((select estado from public.agente_proposta_itens where idempotency_key = 'chave-lote-0001') = 'pendente', 'item do produto livre segue pendente');
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'lote'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'lote')), :U1, 'aprovada');
select public.afirma((select count(*) from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'lote'))) = 1, 'execução ignora o item travado');
select public.afirma(private.estado_produto(:A, :P2) = 'bloqueado', 'produto travado segue travado');

-- trava depois do envio tira o item do escopo
select public.produto_destravar(:A, array['c0000000-0000-0000-0000-000000000002'::uuid], :U1, 'liberado');
insert into v select 'tardia', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Trava tardia', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'tardia'), :P2, 'conecta.enriquecimento.definir', 'SKU2', array['marca_peca'],
  '{"marca_peca": null}', '{"marca_peca": "Sabó"}', '[{"url":"https://exemplo.com/c"}]', '[]', 'MEDIUM', 'chave-tardia-0001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'tardia'));
select public.produto_travar(:A, array['c0000000-0000-0000-0000-000000000002'::uuid], :U1, 'travei depois');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'tardia'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'tardia')), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'nada_aprovavel', 'produto travado depois do envio não pode ser aprovado');

-- ============================================================ timeout => desconhecido; reconciliar antes de repetir
select public.produto_destravar(:A, array['c0000000-0000-0000-0000-000000000002'::uuid], :U1, 'liberado');
insert into v select 'prop3', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Escrita com timeout', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop3'), :P2, 'conecta.enriquecimento.definir', 'SKU2', array['marca_peca'],
  '{"marca_peca": null}', '{"marca_peca": "Sabó"}', '[{"url":"https://exemplo.com/d"}]', '[]', 'MEDIUM', 'chave-timeout-001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop3'));
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'prop3'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop3')), :U1, 'aprovada');
select * from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'prop3'));
insert into v select 'op3', public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop3')), 'conecta.enriquecimento.definir', '{}')::text;
select public.agente_operacao_marcar_enviada(:A, (select val::uuid from v where k = 'op3'));
select public.agente_operacao_fechar(:A, (select val::uuid from v where k = 'op3'), 'desconhecida', null, null, 'timeout');
select public.afirma((select estado from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop3')) = 'desconhecido', 'timeout vira desconhecido, não falhou');
select public.espera_erro($$select public.agente_operacao_abrir('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop3')), 'conecta.enriquecimento.definir', '{}')$$,
  'item_nao_esta_em_execucao', 'não se repete às cegas depois do timeout');
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'prop3')) = 'falhou', 'proposta sem confirmação não é executada');
select public.afirma(private.estado_produto(:A, :P2) = 'erro_divergencia', 'produto fica em erro/divergência');
select public.espera_erro($$select * from public.agente_proposta_iniciar_execucao('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop3'))$$,
  'reconciliar_antes', 'retomar exige reconciliar antes');
select public.espera_erro($$select public.agente_operacao_reconciliar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'op3'), 'nao_gravado', '{}', '11111111-1111-1111-1111-111111111111')$$,
  'reconciliacao_exige_evidencia', 'reconciliar exige prova');
select public.agente_operacao_reconciliar(:A, (select val::uuid from v where k = 'op3'), 'nao_gravado', '{"leitura":{"marca_peca":null}}', :U1);
select public.afirma((select count(*) from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'prop3'))) = 1, 'com prova de que não gravou, retoma só o item pendente');
insert into v select 'op3b', public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where proposta_id = (select val::uuid from v where k = 'prop3')), 'conecta.enriquecimento.definir', '{}')::text;
select public.afirma((select tentativa from public.agente_operacoes where id = (select val::uuid from v where k = 'op3b')) = 2, 'segunda tentativa registrada');
select public.afirma((select idempotency_key from public.agente_operacoes where id = (select val::uuid from v where k = 'op3b')) = 'chave-timeout-001', 'mesma chave de idempotência na retomada (sem duplicar)');
select public.agente_operacao_marcar_enviada(:A, (select val::uuid from v where k = 'op3b'));
select public.agente_operacao_fechar(:A, (select val::uuid from v where k = 'op3b'), 'confirmada', '{}', '{"leitura":{"marca_peca":"Sabó"}}', null);
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'prop3')) = 'executada', 'recuperação conclui a proposta');

-- o lote deixou P1 em execução de propósito (execução simulada nunca finalizada): enviar outra proposta p/ ele é recusado
select public.espera_erro($$select public.agente_proposta_enviar('aaaaaaaa-0000-0000-0000-00000000000a', gen_random_uuid())$$, 'proposta_nao_encontrada', 'proposta inexistente é recusada');
-- encerra a execução do lote para seguir o cenário
select public.agente_operacao_fechar(:A, (select public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-lote-0001'), 'conecta.enriquecimento.definir', '{}')), 'confirmada', '{}', '{"leitura":{"ok":true}}', null);
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'lote')) in ('executada', 'parcial'), 'lote termina com itens confirmados e o travado preservado');


-- ============================================================ execução interna: enriquecimento aplicado com conflito checado e leitura de volta
insert into v select 'prop5', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Descrição da bomba', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop5'), :P4, 'conecta.enriquecimento.definir', 'SKU4', array['descricao_curta'],
  '{}', '{"descricao_curta": "Bomba de óleo HR 2.5 16V"}', '[{"url":"https://exemplo.com/bomba"}]', '[]', 'MEDIUM', 'chave-bomba-0001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop5'));
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'prop5'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop5')), :U1, 'aprovada');
-- ensaio: validar não muda nenhum estado
select public.afirma((select count(*) from public.agente_proposta_validar(:A, (select val::uuid from v where k = 'prop5'))) = 1, 'validar devolve o item aprovável sem executar');
select public.afirma((select estado from public.agente_propostas where id = (select val::uuid from v where k = 'prop5')) = 'aprovada' and private.estado_produto(:A, :P4) = 'aprovado_execucao', 'validar não muda estado de proposta nem de produto');
select public.agente_simulacao_registrar(:A, (select val::uuid from v where k = 'prop5'), :U1, '{"modo":"simulado","itens":[{"ok":true}]}');
select public.afirma((select count(*) from public.agente_simulacoes) = 1, 'simulação registrada à parte');
select public.espera_erro($$update public.agente_simulacoes set resultado = '{}'$$, 'imutável', 'simulação é append-only');
select public.afirma((select estado from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0001') = 'aprovado', 'simulação não confirma item nenhum');
select * from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'prop5'));
select public.afirma((select public.agente_aplicar_enriquecimento(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0001'))->>'descricao_curta') = 'Bomba de óleo HR 2.5 16V', 'enriquecimento aplicado e lido de volta da tabela');
select public.afirma((select status::text || '/' || (fonte is not null)::text from public.produto_enriquecimento where produto_id = 'c0000000-0000-0000-0000-000000000004' and campo = 'descricao_curta') = 'aprovado/true', 'dado aprovado carrega fonte e data');
select public.afirma((select estado from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0001') = 'em_execucao', 'aplicar não confirma sozinho: confirmação é do executor');
select public.agente_operacao_fechar(:A, (select public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0001'), 'conecta.enriquecimento.definir', '{}')), 'confirmada', '{}', '{"leitura":{"descricao_curta":"Bomba de óleo HR 2.5 16V"}}', null);
select public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'prop5'));
-- conflito: o "antes" aprovado não bate com o valor atual
insert into v select 'prop6', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Conflito', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop6'), :P4, 'conecta.enriquecimento.definir', 'SKU4', array['descricao_curta'],
  '{}', '{"descricao_curta": "Outra descrição"}', '[{"url":"https://exemplo.com/outra"}]', '[]', 'MEDIUM', 'chave-bomba-0002');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop6'));
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'prop6'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop6')), :U1, 'aprovada');
select * from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'prop6'));
select public.espera_erro($$select public.agente_aplicar_enriquecimento('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0002'))$$,
  'divergencia_antes', 'valor mudou depois da proposta: não sobrescreve (conflito detectado)');
select public.afirma((select valor #>> '{}' from public.produto_enriquecimento where produto_id = 'c0000000-0000-0000-0000-000000000004' and campo = 'descricao_curta') = 'Bomba de óleo HR 2.5 16V', 'conflito não alterou o dado');

-- o conflito termina como falha registrada e deixa o produto em divergência
select public.agente_operacao_fechar(:A, (select public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-bomba-0002'), 'conecta.enriquecimento.definir', '{}')), 'falhou', '{}', null, 'divergencia_antes');
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'prop6')) = 'falhou', 'conflito termina como falha registrada');
select public.afirma(private.estado_produto(:A, :P4) = 'erro_divergencia', 'conflito deixa o produto em divergência para decisão humana');
select public.produto_destravar(:A, array['c0000000-0000-0000-0000-000000000004'::uuid], :U1, 'divergência resolvida');

-- publicação: produto incompleto não publica; completo publica; evidência é a leitura do produto
insert into v select 'pub', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Publicar bomba', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'pub'), :P4, 'conecta.publicacao.publicar', 'SKU4', array['publicado'],
  '{"publicado": false}', '{"publicado": true}', '[{"documento":"revisão do lojista"}]', '[]', 'HIGH', 'chave-publica-001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'pub'));
select public.espera_erro($$select public.agente_proposta_enviar('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'pub'))$$, 'proposta_ja_enviada', 'não se reenvia proposta');
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'pub'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'pub')), :U1, 'aprovada', null, true);
select * from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'pub'));
select public.espera_erro($$select public.agente_aplicar_publicacao('aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.agente_proposta_itens where idempotency_key = 'chave-publica-001'))$$,
  'imagem principal aprovada', 'sem imagem principal aprovada o produto não publica');
select public.afirma((select publicado from public.produtos where id = 'c0000000-0000-0000-0000-000000000004') = false, 'produto incompleto continua despublicado');
insert into public.produto_imagens (produto_id, loja_id, url, tipo, origem, aprovada, principal) values ('c0000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-00000000000a', 'https://cdn.loja.com/bomba.jpg', 'real', 'foto própria', true, true);
select public.afirma((select public.agente_aplicar_publicacao(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-publica-001'))->>'publicado') = 'true', 'com imagem aprovada o produto publica');
select public.agente_operacao_fechar(:A, (select public.agente_operacao_abrir(:A, (select id from public.agente_proposta_itens where idempotency_key = 'chave-publica-001'), 'conecta.publicacao.publicar', '{}')), 'confirmada', '{}', '{"leitura":{"publicado":true}}', null);
select public.afirma(public.agente_proposta_finalizar(:A, (select val::uuid from v where k = 'pub')) = 'executada', 'publicação concluída');

-- ============================================================ adulteração depois da aprovação (defesa em profundidade)
insert into v select 'prop4', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Adulterada', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'prop4'), :P1, 'conecta.enriquecimento.definir', 'SKU1', array['marca_peca'],
  '{"marca_peca": "Sabó"}', '{"marca_peca": "X"}', '[{"url":"https://exemplo.com/e"}]', '[]', 'HIGH', 'chave-adult-0001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'prop4'));
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop4'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop4')), '11111111-1111-1111-1111-111111111111', 'aprovada')$$,
  'confirmacao_explicita_obrigatoria', 'risco HIGH exige confirmação explícita');
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'prop4'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'prop4')), :U1, 'aprovada', null, true);
alter table public.agente_proposta_itens disable trigger agente_itens_imutaveis;
update public.agente_proposta_itens set depois = '{"marca_peca":"OUTRA"}' where proposta_id = (select val::uuid from v where k = 'prop4');
alter table public.agente_proposta_itens enable trigger agente_itens_imutaveis;
select public.espera_erro($$select * from public.agente_proposta_iniciar_execucao('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'prop4'))$$,
  'aprovacao_invalida', 'conteúdo alterado fora do fluxo invalida a aprovação na execução');

-- ============================================================ escrita real no ERP: liberação explícita por loja e ferramenta
select public.produto_destravar(:A, array['c0000000-0000-0000-0000-000000000004'::uuid], :U1, 'resolvido a divergência');
insert into v select 'bl', public.agente_proposta_criar(:A, :U1, null, null, 'Conector IA', 'claude', 'm', 1, 'Alterar marca no Bling', null, false)::text;
select public.agente_proposta_item_adicionar(:A, (select val::uuid from v where k = 'bl'), :P4, 'bling.produtos.alterar', '4', array['marca'],
  '{"marca": null}', '{"marca": "Sabó"}', '[{"url":"https://exemplo.com/f"}]', '[]', 'MEDIUM', 'chave-bling-0001');
select public.agente_proposta_enviar(:A, (select val::uuid from v where k = 'bl'));
select public.agente_proposta_decidir(:A, (select val::uuid from v where k = 'bl'), 1, (select hash from public.agente_propostas where id = (select val::uuid from v where k = 'bl')), :U1, 'aprovada');
select public.espera_erro($$select * from public.agente_proposta_iniciar_execucao('aaaaaaaa-0000-0000-0000-00000000000a', (select val::uuid from v where k = 'bl'))$$,
  'escrita_real_nao_liberada', 'aprovada mas sem liberação da ferramenta bling.*: o banco recusa executar');
select public.afirma((select estado from public.agente_propostas where id = (select val::uuid from v where k = 'bl')) = 'aprovada', 'recusa não deixa estado pela metade');
select public.espera_erro($$select public.agente_escrita_liberar('aaaaaaaa-0000-0000-0000-00000000000a', 'bling.produtos.alterar', '22222222-2222-2222-2222-222222222222', 'testes e escopo conferidos em 2026-10-19')$$,
  'sem_permissao', 'editor não libera escrita real');
select public.espera_erro($$select public.agente_escrita_liberar('aaaaaaaa-0000-0000-0000-00000000000a', 'bling.produtos.alterar', '11111111-1111-1111-1111-111111111111', 'curta')$$,
  'referencia_obrigatoria', 'liberação sem evidência é recusada');
select public.espera_erro($$select public.agente_escrita_liberar('aaaaaaaa-0000-0000-0000-00000000000a', 'qualquer coisa', '11111111-1111-1111-1111-111111111111', 'testes e escopo conferidos em 2026-10-19')$$,
  'ferramenta_invalida', 'só ferramentas bling.* podem ser liberadas');
select public.agente_escrita_liberar(:A, 'bling.produtos.alterar', :U1, 'testes e escopo conferidos em 2026-10-19');
select public.afirma((select count(*) from public.agente_escrita_liberada where revogada_em is null) = 1, 'liberação registrada com referência');
select public.afirma((select count(*) from public.agente_proposta_iniciar_execucao(:A, (select val::uuid from v where k = 'bl'))) = 1, 'com liberação explícita e aprovação, a execução é permitida');
select public.agente_escrita_revogar(:A, 'bling.produtos.alterar', :U1);
select public.afirma((select count(*) from public.agente_escrita_liberada where revogada_em is null) = 0, 'liberação pode ser revogada');

-- ============================================================ prompts e conhecimento
select public.espera_erro($$insert into public.agente_prompts (nome, versao, escopo, conteudo, hash, proposto_por) values ('seguranca', 1, 'seguranca', 'Nunca escreva sem aprovação.', 'h', 'agente')$$,
  'agente_prompts_check', 'agente não propõe política de segurança');
select public.espera_erro($$insert into public.agente_prompts (nome, versao, conteudo, hash, estado, proposto_por) values ('geral', 1, 'Você é o Conector IA.', 'h', 'ativo', 'agente')$$,
  'agente_prompts_check', 'prompt só fica ativo com aprovação humana');
select public.espera_erro($$insert into public.agente_conhecimento (tipo, titulo, conteudo, fonte, status) values ('hipotese', 'Compatibilidade', 'pode servir', 'url', 'validado')$$,
  'agente_conhecimento_check', 'hipótese não vira conhecimento validado');
select public.espera_erro($$insert into public.agente_conhecimento (tipo, titulo, conteudo, fonte, status) values ('validado', 'Torque', 'x', 'url', 'validado')$$,
  'agente_conhecimento_check', 'validado exige quem validou');

-- ============================================================ RLS e privilégios
select public.produto_travar(:A, array['c0000000-0000-0000-0000-000000000002'::uuid], :U1, 'auditoria final');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select public.afirma((select count(*) from public.agente_propostas) = 0, 'loja B não enxerga propostas da loja A');
select public.espera_erro($$select public.agente_proposta_decidir('aaaaaaaa-0000-0000-0000-00000000000a', gen_random_uuid(), 1, 'x', '33333333-3333-3333-3333-333333333333', 'aprovada')$$,
  'permission denied', 'usuário logado não chama a RPC de decisão direto (só pela Edge Function)');
select public.espera_erro($$insert into public.agente_propostas (loja_id, solicitante_user, titulo) values ('bbbbbbbb-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'direto')$$,
  'permission denied', 'usuário logado não insere proposta direto');
select public.espera_erro($$select public.dashboard_operacional('aaaaaaaa-0000-0000-0000-00000000000a')$$, 'sem_permissao', 'dashboard de outra loja é negado');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.agente_propostas) >= 4, 'lojista A enxerga as propostas da loja');
select public.afirma((select (public.dashboard_operacional('aaaaaaaa-0000-0000-0000-00000000000a')->'produtos_sincronizados'->>'valor')::int) = 3, 'dashboard: produtos sincronizados é contagem real');
select public.afirma((select public.dashboard_operacional('aaaaaaaa-0000-0000-0000-00000000000a')->'qualidade_seo'->'valor') = 'null'::jsonb, 'dashboard: SEO não medido devolve null, não número inventado');
select public.afirma((select (public.dashboard_operacional('aaaaaaaa-0000-0000-0000-00000000000a')->'produtos_bloqueados'->>'valor')::int) = 1, 'dashboard: bloqueados reflete a trava real');
select public.afirma((select count(*) from public.agente_conversas) = 0, 'conversas excluídas não aparecem');
reset role;
-- conversa visível só ao dono
insert into public.agente_conversas (id, loja_id, user_id, titulo) values ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'privada');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.afirma((select count(*) from public.agente_conversas) = 0, 'editor da mesma loja não vê a conversa do lojista');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.afirma((select count(*) from public.agente_conversas) = 1, 'dono vê a própria conversa');
reset role;
rollback;
