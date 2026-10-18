-- Identidades sintéticas em banco descartável; sem credenciais, usuários ou projetos reais.
begin;
create function public.oa(ok boolean,msg text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FALHOU: %',msg; end if; raise notice 'ok: %',msg; end $$;
create function public.oh(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t,'UTF8')),'hex') $$;
create function public.ou(uid text,recente boolean default true) returns void language plpgsql as $$ begin
 reset role;perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint-case when recente then 0 else 7200 end)))::text,true);set local role authenticated;
end $$;
create function public.os() returns void language plpgsql as $$ begin reset role;set local role service_role;end $$;
create function public.oe(cmd text,estado text) returns void language plpgsql as $$ begin
 begin execute cmd;exception when others then if sqlstate=estado then raise notice 'ok: erro % esperado',estado;return;end if;raise;end;
 raise exception 'FALHOU: esperava %',estado;
end $$;
insert into public.lojas(id,nome,slug) values ('aaaaaaaa-1111-1111-1111-111111111111','OAuth A','oauth-a'),('bbbbbbbb-1111-1111-1111-111111111111','OAuth B','oauth-b');
insert into public.usuarios_loja(loja_id,user_id,papel) values
 ('aaaaaaaa-1111-1111-1111-111111111111','11111111-aaaa-aaaa-aaaa-111111111111','lojista'),
 ('aaaaaaaa-1111-1111-1111-111111111111','22222222-aaaa-aaaa-aaaa-111111111111','editor'),
 ('bbbbbbbb-1111-1111-1111-111111111111','33333333-aaaa-aaaa-aaaa-111111111111','lojista');
create function public.onovo(c text,offl boolean default true) returns jsonb language sql as $$
 select public.oauth_pair_iniciar(public.oh(c),public.oh('cliente-A'),'https://cliente.example/cb',repeat('c',43),'state-seguro-sintetico','Cliente SIMULADO',array['bling:consultar'],offl)
$$;
create function public.otrocar(c text) returns jsonb language sql as $$
 select public.oauth_pair_trocar(public.oh(c),public.oh('cliente-A'),'https://cliente.example/cb',repeat('c',43),public.oh('token-'||c),public.oh('sal-'||c),public.oh('refresh-'||c))
$$;
create function public.oaprovar(c text,offl boolean default true) returns jsonb language sql as $$
 select public.oauth_pair_aprovar(c,'aaaaaaaa-1111-1111-1111-111111111111',array['bling:consultar'],15,offl)
$$;

select public.os();
select public.oa((public.onovo('C1')->>'ok')::boolean,'servidor cria pedido OAuth sem nova tabela');
select public.oa(public.otrocar('C1') is null,'pedido sem consentimento não gera sessão');
select public.oa((select count(*) from public.pair_sessoes)=0,'nenhuma sessão criada antes da autorização');
select public.ou('22222222-aaaa-aaaa-aaaa-111111111111');
select public.oa(jsonb_array_length(public.oauth_pair_detalhe('C1')->'lojas')=0,'editor não vê empresas administráveis');
select public.oe($$select public.oaprovar('C1')$$,'42501');
select public.oe($$select public.onovo('forjado')$$,'42501');
select public.oe($$select public.otrocar('C1')$$,'42501');
select public.oe($$select public.oauth_pair_renovar(public.oh('x'),public.oh('cliente-A'),public.oh('n'),public.oh('s'),public.oh('r'))$$,'42501');
select public.ou('33333333-aaaa-aaaa-aaaa-111111111111');
select public.oe($$select public.oaprovar('C1')$$,'42501');
select public.ou('11111111-aaaa-aaaa-aaaa-111111111111',false);
select public.oa(public.oaprovar('C1')->>'motivo'='reconfirmacao_necessaria','consentimento exige autenticação recente');
select public.ou('11111111-aaaa-aaaa-aaaa-111111111111');
select public.oa(jsonb_array_length(public.oauth_pair_detalhe('C1')->'lojas')=1,'lojista vê somente sua empresa');
select public.oa(public.oauth_pair_detalhe('C1')->>'redirect_uri'='https://cliente.example/cb','consentimento exibe retorno registrado');
select public.oa((public.oauth_pair_aprovar('C1','aaaaaaaa-1111-1111-1111-111111111111',array['produtos:ler'],15,true)->>'ok')::boolean=false,'não amplia escopos');
select public.oa((public.oauth_pair_aprovar('C1','aaaaaaaa-1111-1111-1111-111111111111',array['bling:consultar'],61,true)->>'ok')::boolean=false,'não amplia duração');
select public.oa((public.oauth_pair_aprovar('C1','aaaaaaaa-1111-1111-1111-111111111111',array['bling:consultar'],null,true)->>'ok')::boolean=false,'duração nula recusada');
select public.oa((public.oaprovar('C1',false)->>'ok')::boolean,'lojista pode aprovar sem renovação');
select public.oa(public.oauth_pair_detalhe('C1') is null,'pedido aprovado não pode ser reaprovado');
select public.os();
select public.oa((select expira_em-now()<=interval '60 seconds' from public.pair_desafios where codigo_hash=public.oh('C1')),'código concedido expira em até 60 segundos');
select public.oa(public.oauth_pair_trocar(public.oh('C1'),public.oh('cliente-B'),'https://cliente.example/cb',repeat('c',43),public.oh('x'),public.oh('s'),public.oh('r')) is null,'cliente errado não resgata');
select public.oa(public.oauth_pair_trocar(public.oh('C1'),public.oh('cliente-A'),'https://outro.example/cb',repeat('c',43),public.oh('x'),public.oh('s'),public.oh('r')) is null,'redirect diferente não resgata');
select public.oa(public.oauth_pair_trocar(public.oh('C1'),public.oh('cliente-A'),'https://cliente.example/cb',repeat('z',43),public.oh('x'),public.oh('s'),public.oh('r')) is null,'PKCE errado não resgata');
select public.oa((public.otrocar('C1')->>'offline')::boolean=false,'decisão de não renovar é preservada no token');
select public.oa(public.pair_validar(public.oh('token-C1'),public.oh('sal-C1'))->>'loja_id'='aaaaaaaa-1111-1111-1111-111111111111','token ligado à empresa autorizada');
select public.oa((select oauth_refresh_hash is null from public.pair_sessoes where token_hash=public.oh('token-C1')),'sem consentimento offline não guarda refresh');
select public.oa((public.pair_renovar(public.oh('token-C1'),public.oh('sal-C1'),public.oh('novo'))->>'ok')::boolean=false,'access token não renova pelo Pair antigo');
select public.oa(public.otrocar('C1') is null,'código é de uso único');
select public.oa(public.pair_validar(public.oh('token-C1'),public.oh('sal-C1')) is null,'replay válido do código revoga a sessão emitida');

select public.onovo('C2');
select public.ou('11111111-aaaa-aaaa-aaaa-111111111111');
select public.oaprovar('C2');
select public.os();
select public.oa((public.otrocar('C2')->>'offline')::boolean,'consentimento de renovação expresso preservado');
select public.oa(public.oauth_pair_renovar(public.oh('refresh-C2'),public.oh('cliente-B'),public.oh('t2'),public.oh('s2'),public.oh('r2')) is null,'refresh de outro cliente recusado');
select public.oa(public.pair_validar(public.oh('token-C2'),public.oh('sal-C2')) is not null,'cliente errado não revoga sessão legítima');
select public.oa(public.oauth_pair_renovar(public.oh('refresh-C2'),public.oh('cliente-A'),public.oh('t2'),public.oh('s2'),public.oh('r2')) is not null,'refresh válido gira access e refresh');
select public.oa(public.pair_validar(public.oh('token-C2'),public.oh('sal-C2')) is null,'access anterior deixa de autenticar');
select public.oa(public.pair_validar(public.oh('t2'),public.oh('s2')) is not null,'novo access autentica');
select public.oa((select expira_em<=limite_ate from public.pair_sessoes where token_hash=public.oh('t2')),'renovação respeita teto absoluto aprovado');
select public.oa(public.oauth_pair_renovar(public.oh('refresh-C2'),public.oh('cliente-A'),public.oh('t3'),public.oh('s3'),public.oh('r3')) is null,'refresh anterior não pode ser reutilizado');
select public.oa(public.pair_validar(public.oh('t2'),public.oh('s2')) is null,'replay do refresh revoga a sessão');

select public.onovo('C3',false);
select public.ou('11111111-aaaa-aaaa-aaaa-111111111111');
select public.oa((public.oaprovar('C3',true)->>'ok')::boolean=false,'lojista não concede offline que cliente não solicitou');
select public.oaprovar('C3',false);
select public.os();select public.otrocar('C3');
select public.oauth_pair_revogar(public.oh('token-C3'),public.oh('cliente-A'),public.oh('sal-errado'));
select public.oa(public.pair_validar(public.oh('token-C3'),public.oh('sal-C3')) is not null,'revogação de access exige as duas metades');
select public.oauth_pair_revogar(public.oh('token-C3'),public.oh('cliente-A'),public.oh('sal-C3'));
select public.oa(public.pair_validar(public.oh('token-C3'),public.oh('sal-C3')) is null,'cliente revoga access completo');
select public.onovo('C4');
reset role;update public.pair_desafios set expira_em=now()-interval '1 second' where codigo_hash=public.oh('C4');
select public.ou('11111111-aaaa-aaaa-aaaa-111111111111');
select public.oa((public.oaprovar('C4')->>'ok')::boolean=false,'pedido expirado não concede acesso');
reset role;
select public.oa(not exists(select 1 from public.auditoria where acao like 'oauth.%' and depois::text ~ 'state-seguro|refresh-C|token-C|sal-C'),'auditoria sem códigos, tokens, state ou segredos');
select public.oa(not has_column_privilege('authenticated','public.pair_sessoes','oauth_refresh_hash','SELECT'),'hash de refresh invisível ao navegador');
select public.oa(not has_table_privilege('authenticated','public.pair_desafios','SELECT'),'pedido OAuth não exposto diretamente');
rollback;
