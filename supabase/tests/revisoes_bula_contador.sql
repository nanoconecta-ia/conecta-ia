begin;
create or replace function public.afirma(ok boolean, msg text) returns void language plpgsql as
$$ begin if not ok then raise exception 'FALHOU: %', msg; end if; raise notice 'ok: %', msg; end $$;
insert into public.lojas (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000001','Loja A','loja-a'),('bbbbbbbb-0000-0000-0000-000000000002','Loja B','loja-b');
insert into public.usuarios_loja (loja_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
insert into public.produtos (id, loja_id, bling_id, sku, nome, preco, publicado) values
  ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','1','A-1','Biela',100,true),
  ('bbbbbbbb-1111-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','1','B-1','Outro',10,true);
insert into public.marcas (id, loja_id, nome, tipo, status) values ('aaaaaaaa-2222-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Hyundai','veiculo','aprovado');

-- Aplicação aprovada exige OEM + montadora
do $$ begin begin insert into public.produto_aplicacoes (loja_id, produto_id, modelo, status, fonte, coletado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','HR','aprovado','cat',now()); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'aplicação aprovada sem código OEM e montadora de origem é recusada');
insert into public.produto_aplicacoes (loja_id, produto_id, montadora_origem_id, codigo_oem, modelo, restricao, contraindicacao, status, fonte, coletado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','OEM-1','HR','só motor série >= 100','não usar em versão revisada','aprovado','cat',now());

-- Revisões e supersessões
do $$ begin begin insert into public.produto_revisoes (loja_id, produto_id, codigo, o_que_mudou, status) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','OEM-1','furo maior','aprovado'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'revisão aprovada sem fonte e data é recusada');
insert into public.produto_revisoes (loja_id, produto_id, codigo, o_que_mudou, medidas, status, fonte, coletado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','OEM-1','furo 2 mm maior','{"furo_mm":22}','aprovado','cat',now());
do $$ begin begin insert into public.produto_revisoes (loja_id, produto_id, codigo, o_que_mudou) values ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-1111-0000-0000-000000000002','X','y'); raise exception 'passou';
  exception when foreign_key_violation then null; end; end $$;
select public.afirma(true, 'revisão de produto de outra loja é recusada');
do $$ begin begin insert into public.codigo_supersessoes (loja_id, codigo_antigo, codigo_novo) values ('aaaaaaaa-0000-0000-0000-000000000001','A','A'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'supersessão para o mesmo código é recusada');
insert into public.codigo_supersessoes (loja_id, montadora_id, codigo_antigo, codigo_novo, status, fonte, coletado_em)
  values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-2222-0000-0000-000000000001','OLD-1','OEM-1','aprovado','cat',now());
select public.afirma((select mudou_formato from public.codigo_supersessoes) is null, 'mudança de formato fica desconhecida (null) até haver fonte');

-- Bula
do $$ begin begin insert into public.produto_bula (produto_id, loja_id, status, aprovada_em) values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','aprovada',now()); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'bula aprovada sem medidas da peça é recusada');
insert into public.produto_bula (produto_id, loja_id, medidas_peca, contraindicacoes, alertas_codigo, status, aprovada_em, aprovada_por)
  values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','{"comprimento_mm":150}','{"não usar em série < 100"}','{"código OEM-1 tem duas revisões"}','aprovada',now(),'Lojista');
select public.afirma((select campos_obrigatorios @> array['bula_tecnica'] from public.perfis_ramo where codigo='autopecas'), 'bula técnica é obrigatória no perfil autopeças');

-- Contador / notificações / validação
do $$ begin begin insert into public.loja_contador (loja_id, nome, whatsapp) values ('aaaaaaaa-0000-0000-0000-000000000001','Contador','62991111111'); raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'WhatsApp sem código do país (55) é recusado');
insert into public.loja_contador (loja_id, nome, whatsapp) values ('aaaaaaaa-0000-0000-0000-000000000001','Contador Teste','5562991111111');
insert into public.notificacoes (loja_id, chave, tipo, severidade, titulo, fonte_url) values ('aaaaaaaa-0000-0000-0000-000000000001','falta-cest','tabela_faltando','atencao','Falta a tabela CEST','https://exemplo.test');
do $$ begin begin insert into public.notificacoes (loja_id, chave, tipo, titulo) values ('aaaaaaaa-0000-0000-0000-000000000001','falta-cest','tabela_faltando','dup'); raise exception 'passou';
  exception when unique_violation then null; end; end $$;
select public.afirma(true, 'aviso repetido não duplica (idempotente)');
insert into public.validacoes_contador (loja_id, produto_id, tipo, resumo, mensagem) values ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-1111-0000-0000-000000000001','ncm','NCM proposto','Confirme o NCM 84099190');
select public.afirma((select status from public.validacoes_contador) = 'em_espera', 'validação do contador nasce em espera');
do $$ begin begin update public.validacoes_contador set status='confirmada'; raise exception 'passou';
  exception when check_violation then null; end; end $$;
select public.afirma(true, 'confirmar exige data da resposta');
insert into public.documentos_referencia (loja_id, tabela, nome_arquivo, storage_path) values ('aaaaaaaa-0000-0000-0000-000000000001','cest','cv142.pdf','loja/a/cv142.pdf');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',true);
select public.afirma((select count(*) from public.loja_contador) = 1, 'lojista vê o contador da própria loja');
update public.notificacoes set lida_em = now();
select public.afirma((select lida_em is not null from public.notificacoes), 'lojista marca aviso como lido');
do $$ begin begin update public.notificacoes set titulo = 'x'; raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'lojista só altera lida/resolvida, não o conteúdo do aviso');
do $$ begin begin insert into public.documentos_referencia (loja_id, tabela, nome_arquivo, storage_path) values ('aaaaaaaa-0000-0000-0000-000000000001','cest','x','y'); raise exception 'passou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'anexo de documento passa pelo servidor (valida e guarda hash)');

reset role; set local role anon;
select public.afirma((select count(*) from public.produto_bula) = 1, 'público vê só bula aprovada de produto publicado');
select public.afirma((select count(*) from public.produto_revisoes) = 1 and (select count(*) from public.codigo_supersessoes) = 1, 'público vê revisões e supersessões aprovadas');
do $$ begin begin perform aprovada_por from public.produto_bula; raise exception 'vazou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'público não vê quem aprovou a bula');
do $$ begin begin perform 1 from public.loja_contador; raise exception 'vazou';
  exception when insufficient_privilege then null; end; end $$;
select public.afirma(true, 'contato do contador nunca é público');
rollback;
