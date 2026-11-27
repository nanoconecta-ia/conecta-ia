// E2E somente no CI efêmero; nenhum adaptador/credencial de produção.
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {conferirDecisaoCatalogoSql} from "../../supabase/functions/_shared/nano_lifecycle/porta_decisao_catalogo_sql.ts";
import {reconciliarDecisaoCatalogo} from "../../supabase/functions/_shared/nano_lifecycle/decisao_catalogo.ts";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const L="e1080000-0000-0000-0000-000000000001",P="e1081000-0000-0000-0000-000000000001",A="e1082000-0000-0000-0000-000000000001",U="e1083000-0000-0000-0000-000000000001",M="e1084000-0000-0000-0000-000000000001";
const sql=texto=>execFileSync("psql",["-XqAtw","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1"],{input:texto,encoding:"utf8",timeout:30000,env:{PATH:process.env.PATH,PGPASSWORD:"postgres",PGCONNECT_TIMEOUT:"5"},stdio:["pipe","pipe","pipe"]}).trim();
sql("begin; insert into public.lojas(id,nome,slug) values ('"+L+"','CI catálogo E2E','ci-catalogo-e2e-108'); insert into public.produtos(id,loja_id,bling_id,sku,nome,publicado) values ('"+P+"','"+L+"','108','CI-108','Peça sintética',true); insert into public.marcas(id,loja_id,nome,tipo,status) values ('"+M+"','"+L+"','Montadora sintética','veiculo','aprovado'); insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,marca_veiculo_id,montadora_origem_id,codigo_oem,status,fonte,coletado_em,pagina_indexavel,pagina_slug) values ('"+A+"','"+L+"','"+P+"','Modelo teste','"+M+"','"+M+"','OEM-CI-108','aprovado','fixture',now(),true,'ci-catalogo-108'); commit;");
const escopo={loja_id:L,produto_id:P,aplicacao_id:A};
const pw=randomBytes(24).toString("hex");
sql("create role nano_catalogo_e2e_auditor login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '"+pw+"'; grant nano_lifecycle_auditoria to nano_catalogo_e2e_auditor; insert into nano_lifecycle_interno.auditoria_escopos values('nano_catalogo_e2e_auditor','"+L+"',true);");
const auditor=texto=>execFileSync("psql",["-XqAtw","-h","127.0.0.1","-p","5432","-U","nano_catalogo_e2e_auditor","-d","conecta_teste","-v","ON_ERROR_STOP=1"],{input:"set role nano_lifecycle_auditoria;\n"+texto,encoding:"utf8",timeout:30000,env:{PATH:process.env.PATH,PGPASSWORD:pw,PGCONNECT_TIMEOUT:"5"},stdio:["pipe","pipe","pipe"]}).trim();
const restrito=(l=L,p=P,a=A)=>{
 // Somente UUIDs fixos de fixture; sem SQL vindo de cliente.
 assert.ok([l,p,a].every(x=>/^[0-9a-f-]{36}$/.test(x)));
 const raw=auditor("select nano_lifecycle_interno.nano_catalogo_ler_decisao('"+l+"','"+p+"','"+a+"');");
 return raw?JSON.parse(raw):null;
};

// Uma única instrução SELECT obtém snapshot MVCC consistente do estado e histórico.
// IDs bigint convertidos no banco antes da serialização. Sem limite/truncamento.
// Consulta privilegiada exclusivamente de teste, não autorização operacional.
function ler(){
 const r=JSON.parse(sql("select jsonb_build_object('atual',(select to_jsonb(a.*) from public.produto_aplicacoes a where a.loja_id='"+L+"' and a.produto_id='"+P+"' and a.id='"+A+"'),'eventos',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id::text,'quando',h.quando,'loja_id',h.loja_id,'user_id',h.user_id,'acao',h.acao,'tabela',h.tabela,'antes',h.antes,'depois',h.depois) order by h.id),'[]'::jsonb) from public.auditoria h where h.tabela='produto_aplicacoes' and (h.antes->>'id'='"+A+"' or h.depois->>'id'='"+A+"')),'agora',statement_timestamp());"));
 return r;
}
const decidir=d=>sql("set role service_role; select public.aplicacao_decidir('"+L+"','"+A+"','"+U+"','"+d+"');");
const verificar=(r,e=escopo)=>reconciliarDecisaoCatalogo(e,r.atual,r.eventos,r.agora);
let r=ler();assert.equal(verificar(r).estado,"retida");assert.equal(r.eventos.length,0);console.log("ok: CAT-108-01 flag sem histórico não confirma decisão");
decidir("rejeitar");
r=ler();assert.equal(r.eventos.length,1);assert.equal(r.atual.pagina_indexavel,false);assert.equal(verificar(r).estado,"rejeitada_legada");console.log("ok: CAT-108-02 rejeição SQL reconciliada pelo TypeScript");
decidir("aprovar");
r=ler();assert.equal(r.eventos.length,2);assert.equal(r.atual.pagina_indexavel,false);const v=verificar(r);assert.equal(v.estado,"aprovacao_legada_conferida");assert.equal(v.homologada,false);assert.equal(Object.hasOwn(v,"prova"),false);assert.equal(v.evento_id,r.eventos[1].id);assert.equal(v.aprovador,U);console.log("ok: CAT-108-03 reaprovação SQL rastreável sem prova ou republicação");
const rr=restrito();assert.deepEqual(rr.atual,r.atual);assert.deepEqual(rr.eventos,r.eventos);assert.equal(verificar(rr).estado,"aprovacao_legada_conferida");console.log("ok: CAT-109-01 auditor real lê snapshot e cadeia idênticos");
const sessao={consultar:async(q,params)=>{
 assert.equal(q,"select session_user::text as identidade, nano_lifecycle_interno.nano_catalogo_ler_decisao($1::uuid,$2::uuid,$3::uuid) as valor");
 assert.ok(params.every(x=>typeof x==="string"&&/^[0-9a-f-]{36}$/.test(x)));
 // psql 16: valores pelo protocolo estendido, não interpolados no SELECT.
 const raw=auditor("select row_to_json(q) from ("+q+") q\n\\bind "+params.map(x=>"'"+x+"'").join(" ")+"\n\\g\n");
 return [JSON.parse(raw)];
}};
const conferir=()=>conferirDecisaoCatalogoSql(escopo,sessao,"nano_catalogo_e2e_auditor");
assert.equal((await conferir()).estado,"aprovacao_legada_conferida");
assert.equal((await conferirDecisaoCatalogoSql(escopo,sessao,"outro")).estado,"retida");
console.log("ok: CAT-110-06 porta parametrizada com login real e identidade conferida");

assert.equal(restrito(M,P,A),null);assert.equal(restrito(L,M,A),null);assert.equal(restrito(L,P,M),null);console.log("ok: CAT-109-02 loja, produto e aplicação divergentes negados");
for(const role of ["anon","authenticated","service_role","nano_lifecycle_produtor"])assert.equal(sql("select has_function_privilege('"+role+"','nano_lifecycle_interno.nano_catalogo_ler_decisao(uuid,uuid,uuid)','EXECUTE');"),"f");
assert.equal(sql("select has_table_privilege('nano_catalogo_decisao_leitor','public.auditoria','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
assert.throws(()=>auditor("select * from public.auditoria;"),e=>e.stderr?.includes("permission denied")===true);
console.log("ok: CAT-109-03 sem acesso direto à auditoria, produtor ou service_role");
sql("update nano_lifecycle_interno.auditoria_escopos set habilitado=false where login_db='nano_catalogo_e2e_auditor' and loja_id='"+L+"';");
assert.equal(restrito(),null);assert.equal((await conferir()).estado,"retida");console.log("ok: CAT-109-04 revogação do auditor impede nova leitura");
sql("update nano_lifecycle_interno.auditoria_escopos set habilitado=true where login_db='nano_catalogo_e2e_auditor' and loja_id='"+L+"';");
assert.equal(verificar(restrito()).estado,"aprovacao_legada_conferida");console.log("ok: CAT-109-05 autorização restabelecida não cria homologação");

assert.equal(verificar(r,{...escopo,loja_id:M}).estado,"retida");assert.equal(verificar({...r,eventos:r.eventos.slice(0,1)}).estado,"retida");console.log("ok: CAT-108-04 escopo trocado e histórico desatualizado retidos");
sql("update public.produto_aplicacoes set modelo='Modelo alterado' where loja_id='"+L+"' and id='"+A+"';");
r=ler();assert.equal(r.eventos.length,2);assert.equal(verificar(r).estado,"retida");console.log("ok: CAT-108-05 alteração posterior invalida decisão no readback real");

assert.equal(verificar(restrito()).estado,"retida");console.log("ok: CAT-109-06 leitura restrita detecta alteração posterior");

assert.equal((await conferir()).estado,"retida");console.log("ok: CAT-110-07 porta real retém revogação e edição posterior");


// Imutabilidade vale também no modo replica, sem bloquear novos eventos legítimos.
const filtro=" where loja_id='"+L+"' and tabela='produto_aplicacoes'";
const historico=()=>sql("select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]'::jsonb)::text from public.auditoria h"+filtro+";");
const preservado=historico();
for(const prefixo of ["","set local session_replication_role=replica; "]){
 for(const mutacao of ["update public.auditoria set quando=quando+interval '1 day'"+filtro,"delete from public.auditoria"+filtro,"truncate public.auditoria"]){
  assert.throws(()=>sql("begin; "+prefixo+mutacao+"; rollback;"),e=>e.stderr?.includes("auditoria é imutável")===true);
 }
 assert.equal(historico(),preservado);
}
console.log("ok: CAT-111-01 update e delete bloqueados em modo normal e replica");
console.log("ok: CAT-111-02 truncate bloqueado em modo normal e replica");
assert.equal(sql("select count(*) from pg_trigger where tgrelid='public.auditoria'::regclass and tgname in ('auditoria_sem_update','auditoria_sem_truncate') and tgenabled='A';"),"2");
assert.equal(historico(),preservado);console.log("ok: CAT-111-03 triggers ALWAYS e histórico integral preservado");
decidir("rejeitar");
assert.equal(ler().eventos.length,3);assert.equal(ler().atual.status,"rejeitado");
assert.equal((await conferir()).estado,"retida"); // edição anterior rompe cadeia; novo evento não apaga lacuna.
console.log("ok: CAT-111-04 nova decisão legítima registra evento sem mascarar quebra histórica");
// Exercita outro escritor legado: trigger da política comercial, apenas fixture do CI.
const outros=()=>Number(sql("select count(*) from public.auditoria where loja_id='"+L+"' and tabela='restricoes_loja';"));
const n=outros();
sql("insert into public.restricoes_loja(loja_id,somente_catalogo) values ('"+L+"',true) on conflict(loja_id) do update set somente_catalogo=true;");
assert.equal(outros(),n+1);assert.equal(ler().eventos.length,3);
console.log("ok: CAT-111-05 auditoria legada de restrições permanece operacional e isolada do catálogo");

// CAT-112: caracterização da autoridade efetiva legada, NÃO é aprovação humana.
// Inventário parcial: ACLs e funções do banco efêmero; não prova caminhos HTTP.
const rpc="public.aplicacao_decidir(uuid,uuid,uuid,text)";
for(const role of ["anon","authenticated","nano_lifecycle_produtor","nano_lifecycle_auditoria"]){
 assert.equal(sql("select has_function_privilege('"+role+"','"+rpc+"','EXECUTE');"),"f");
}
assert.equal(sql("select has_function_privilege('service_role','"+rpc+"','EXECUTE');"),"t");
console.log("ok: CAT-112-01 fronteira EXECUTE do RPC legado restrita; não autentica humano");
const A2="e1082000-0000-0000-0000-000000000002",U2="e1083000-0000-0000-0000-000000000002";
assert.equal(sql("select count(*) from auth.users where id='"+U2+"';"),"0");
sql("insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,marca_veiculo_id,montadora_origem_id,codigo_oem,status,fonte,coletado_em,pagina_indexavel,pagina_slug) values ('"+A2+"','"+L+"','"+P+"','Modelo CI autoridade','"+M+"','"+M+"','OEM-CI-112','a_confirmar','fixture',now(),false,'ci-catalogo-112');");
// Contraprova: o UUID passado pelo serviço não corresponde a usuário autenticado.
sql("set role service_role; select public.aplicacao_decidir('"+L+"','"+A2+"','"+U2+"','aprovar');");
const e2={loja_id:L,produto_id:P,aplicacao_id:A2},r2=restrito(L,P,A2),v2=verificar(r2,e2);
assert.equal(r2.eventos.length,1);assert.equal(r2.eventos[0].user_id,U2);
assert.equal(v2.estado,"aprovacao_legada_conferida");assert.equal(v2.homologada,false);assert.equal(Object.hasOwn(v2,"prova"),false);
console.log("ok: CAT-112-02 contraprova de autoria: UUID sem usuário ainda gera decisão legada, nunca prova");
assert.equal(sql("select has_table_privilege('service_role','public.produto_aplicacoes','UPDATE');"),"t");
sql("set role service_role; update public.produto_aplicacoes set modelo='Modelo CI autoridade alterado' where loja_id='"+L+"' and id='"+A2+"';");
const r3=restrito(L,P,A2);
assert.equal(r3.atual.modelo,"Modelo CI autoridade alterado");assert.deepEqual(r3.eventos,r2.eventos);
assert.equal(verificar(r3,e2).estado,"retida");
console.log("ok: CAT-112-03 contraprova de escritor direto: mudança sem evento é detectada");
const acl=JSON.parse(sql("select jsonb_agg(jsonb_build_object('papel',r,'auditoria_insert',has_table_privilege(r,'public.auditoria','INSERT'),'aplicacao_update',has_table_privilege(r,'public.produto_aplicacoes','UPDATE')) order by r)::text from unnest(array['anon','authenticated','service_role','nano_lifecycle_produtor','nano_lifecycle_auditoria','nano_catalogo_decisao_leitor']) r;"));
assert.equal(acl.length,6);
console.log("inventario CAT-112-04 ACL (não prova RLS ou autoria): "+JSON.stringify(acl));
const escritores=JSON.parse(sql("select coalesce(jsonb_agg(n.nspname||'.'||p.proname order by n.nspname,p.proname),'[]'::jsonb)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','nano_lifecycle_interno') and p.prosrc ilike '%auditoria%' and p.prosrc ilike '%insert%';"));
assert.ok(escritores.includes("public.aplicacao_decidir"));
console.log("ok: CAT-112-04 inventário textual parcial de funções: "+JSON.stringify(escritores));
