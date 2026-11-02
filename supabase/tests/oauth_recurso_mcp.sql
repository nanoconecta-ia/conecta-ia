-- OAuth com RECURSO (audiência): conector-mcp só aceita token emitido para ele; conecta-gateway só os seus. Dados sintéticos, banco descartável.
begin;
create function public.rr(ok boolean,msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
create function public.rh(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t,'UTF8')),'hex') $$;
create function public.ru(uid text) returns void language plpgsql as $$ begin
 reset role;perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);set local role authenticated;
end $$;
create function public.rs() returns void language plpgsql as $$ begin reset role;set local role service_role;end $$;
create function public.re(cmd text,estado text) returns void language plpgsql as $$ begin
 begin execute cmd;exception when others then if sqlstate=estado then raise notice 'ok: erro % esperado',estado;return;end if;raise;end;
 raise exception 'FALHOU: esperava %',estado;
end $$;
insert into public.lojas(id,nome,slug) values ('aaaaaaaa-2222-2222-2222-222222222222','Rec A','rec-a'),('bbbbbbbb-2222-2222-2222-222222222222','Rec B','rec-b');
insert into public.usuarios_loja(loja_id,user_id,papel) values
 ('aaaaaaaa-2222-2222-2222-222222222222','11111111-bbbb-bbbb-bbbb-222222222222','lojista'),
 ('bbbbbbbb-2222-2222-2222-222222222222','33333333-bbbb-bbbb-bbbb-222222222222','lojista');
-- pedido (cód, recurso, escopos) -> aprova -> troca. Devolve a resposta da troca.
create function public.rfluxo(c text,rec text,esc text[],loja text default 'aaaaaaaa-2222-2222-2222-222222222222',uid text default '11111111-bbbb-bbbb-bbbb-222222222222') returns jsonb language plpgsql as $$
declare r jsonb;
begin
 perform public.rs();
 perform public.oauth_pair_iniciar(public.rh(c),public.rh('cli-'||c),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','Cliente SIMULADO',esc,true,rec);
 perform public.ru(uid);
 perform public.oauth_pair_aprovar(c,loja::uuid,esc,15,true);
 perform public.rs();
 r:=public.oauth_pair_trocar(public.rh(c),public.rh('cli-'||c),'https://cliente.example/cb',repeat('c',43),public.rh('tok-'||c),public.rh('sal-'||c),public.rh('ref-'||c));
 return r;
end $$;

select public.rs();
select public.re($$select public.oauth_pair_iniciar(public.rh('x1'),public.rh('c'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','C',array['mcp:leitura'],true,'conecta-gateway')$$,'22023');
select public.re($$select public.oauth_pair_iniciar(public.rh('x2'),public.rh('c'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','C',array['produtos:ler'],true,'conector-mcp')$$,'22023');
select public.re($$select public.oauth_pair_iniciar(public.rh('x3'),public.rh('c'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','C',array['mcp:leitura'],true,'outro')$$,'22023');
select public.re($$select public.oauth_pair_iniciar(public.rh('x4'),public.rh('c'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','C',array['mcp:leitura','produtos:ler'],true,'conector-mcp')$$,'22023');
select public.rr((public.oauth_pair_iniciar(public.rh('legado'),public.rh('c'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','C',array['produtos:ler'],true)->>'ok')::boolean,'chamada antiga (8 argumentos) continua valendo: recurso padrão conecta-gateway');

-- fluxo MCP completo
select public.rr(public.rfluxo('M1','conector-mcp',array['mcp:leitura','mcp:propor']) is not null,'troca de código para o recurso conector-mcp');
select public.rr((select recurso from public.pair_sessoes where token_hash=public.rh('tok-M1'))='conector-mcp','sessão nasce com recurso conector-mcp');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M1'),public.rh('sal-M1'),'conector-mcp')->>'loja_id'='aaaaaaaa-2222-2222-2222-222222222222','conector-mcp valida o token emitido para ele');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M1'),public.rh('sal-M1'),'conector-mcp')->'escopos' @> '["mcp:propor"]','escopos mcp:* chegam ao conector-mcp');
select public.rr(public.pair_validar(public.rh('tok-M1'),public.rh('sal-M1')) is null,'conecta-gateway RECUSA token emitido para o conector-mcp (sem reuso entre serviços)');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M1'),public.rh('sal-M1'),'conecta-gateway') is null,'validar como outro recurso é recusado');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M1'),public.rh('sal-errado'),'conector-mcp') is null,'sal errado não valida (duas metades)');

-- token do gateway não vale no mcp
select public.rr(public.rfluxo('G1','conecta-gateway',array['produtos:ler']) is not null,'troca de código para o recurso conecta-gateway');
select public.rr(public.pair_validar(public.rh('tok-G1'),public.rh('sal-G1')) is not null,'conecta-gateway valida o próprio token');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-G1'),public.rh('sal-G1'),'conector-mcp') is null,'conector-mcp RECUSA token emitido para o conecta-gateway');

-- isolamento por loja: outra loja, outro usuário
select public.rr(public.rfluxo('MB','conector-mcp',array['mcp:leitura'],'bbbbbbbb-2222-2222-2222-222222222222','33333333-bbbb-bbbb-bbbb-222222222222') is not null,'segunda loja autoriza o próprio cliente');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-MB'),public.rh('sal-MB'),'conector-mcp')->>'loja_id'='bbbbbbbb-2222-2222-2222-222222222222','token da loja B só devolve a loja B');

-- revogação e expiração
select public.oauth_pair_revogar(public.rh('tok-M1'),public.rh('cli-M1'),public.rh('sal-M1'));
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M1'),public.rh('sal-M1'),'conector-mcp') is null,'revogação vale na próxima chamada');
select public.rfluxo('M2','conector-mcp',array['mcp:leitura']);
update public.pair_sessoes set expira_em=now()-interval '1 second' where token_hash=public.rh('tok-M2');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M2'),public.rh('sal-M2'),'conector-mcp') is null,'token expirado é recusado');
select public.rfluxo('M3','conector-mcp',array['mcp:leitura']);
update public.pair_sessoes set limite_ate=now()-interval '1 second' where token_hash=public.rh('tok-M3');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M3'),public.rh('sal-M3'),'conector-mcp') is null,'duração aprovada vencida é recusada');
select public.rfluxo('M4','conector-mcp',array['mcp:leitura']);
update public.usuarios_loja set papel='editor' where user_id='11111111-bbbb-bbbb-bbbb-222222222222';
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M4'),public.rh('sal-M4'),'conector-mcp') is null,'usuário que aprovou perdeu o papel de lojista: token deixa de valer');

-- refresh mantém o recurso
select public.rfluxo('M5','conector-mcp',array['mcp:leitura'],'bbbbbbbb-2222-2222-2222-222222222222','33333333-bbbb-bbbb-bbbb-222222222222');
select public.oauth_pair_renovar(public.rh('ref-M5'),public.rh('cli-M5'),public.rh('t5b'),public.rh('s5b'),public.rh('r5b'));
select public.rr((select recurso from public.pair_sessoes where token_hash=public.rh('t5b'))='conector-mcp','renovação mantém o recurso da sessão');
select public.rr(public.oauth_validar_para_recurso(public.rh('t5b'),public.rh('s5b'),'conector-mcp') is not null,'token renovado vale no conector-mcp');
select public.rr(public.oauth_validar_para_recurso(public.rh('tok-M5'),public.rh('sal-M5'),'conector-mcp') is null,'token anterior à rotação deixa de valer');

-- permissões e auditoria por sessão
select public.ru('33333333-bbbb-bbbb-bbbb-222222222222');
select public.re($$select public.oauth_validar_para_recurso(public.rh('t5b'),public.rh('s5b'),'conector-mcp')$$,'42501');
select public.rs();
select public.agente_chamada_registrar('bbbbbbbb-2222-2222-2222-222222222222','gateway_mcp',null,null,'33333333-bbbb-bbbb-bbbb-222222222222',null,'conecta.catalogo.resumo','LOW','permitida','leitura','{}'::jsonb,'{}'::jsonb,5,(select id from public.pair_sessoes where token_hash=public.rh('t5b')));
select public.rr((select count(*) from public.agente_chamadas_ferramenta where pair_sessao_id is not null)=1,'chamada fica auditada por sessão OAuth');
select public.agente_chamada_registrar('bbbbbbbb-2222-2222-2222-222222222222','chat',null,null,'33333333-bbbb-bbbb-bbbb-222222222222',null,'conecta.catalogo.resumo','LOW','permitida','leitura','{}'::jsonb,'{}'::jsonb,5);
select public.rr((select count(*) from public.agente_chamadas_ferramenta where pair_sessao_id is null)>=1,'chamada antiga (13 argumentos) continua valendo');
rollback;
