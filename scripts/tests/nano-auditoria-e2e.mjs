// E2E com três logins reais, apenas PostgreSQL efêmero do CI.
import {execFileSync,spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {readFileSync} from "node:fs";
import {randomBytes,createHash} from "node:crypto";
import assert from "node:assert/strict";
import {extrair} from "../../supabase/functions/_shared/pipeline/extracao.ts";
import {conferirComAuditorSql,conferirEvidenciaAtualComAuditorSql,conferirPreGateSql,registrarConferenciaSql} from "../../supabase/functions/_shared/nano_lifecycle/porta_auditoria_sql.ts";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const L="fa000000-0000-0000-0000-000000000001",P="fa100000-0000-0000-0000-000000000001",X="fb200000-0000-0000-0000-000000000001";
const args=user=>["-XqAtw","-h","127.0.0.1","-p","5432","-U",user,"-d","conecta_teste","-v","ON_ERROR_STOP=1"];
const env=password=>({PATH:process.env.PATH,PGPASSWORD:password,PGCONNECT_TIMEOUT:"5"});
const admin=sql=>execFileSync("psql",args("postgres"),{input:sql,encoding:"utf8",timeout:30000,env:env("postgres"),stdio:["pipe","pipe","pipe"]}).trim();
const passwords=Object.fromEntries(["nano_e2e_prod","nano_e2e_parecer","nano_e2e_auditor"].map(n=>[n,randomBytes(24).toString("hex")]));
// Reusa a captura validada, com namespace isolado do teste concorrente.
const original=readFileSync("docs/conector-ia/nano-lifecycle-autoridade-consumo-TESTE.sql","utf8");
const cut=original.indexOf("select pg_temp.afirma(public.nano_lifecycle_encaminhar(");
assert.ok(cut>0);
const fixture=original.slice(0,cut).replaceAll("ed000000-","fa000000-").replaceAll("ed100000-","fa100000-").replaceAll("ed200000-","fa200000-").replaceAll("nano-eventos","nano-auditoria-e2e").replace('"nome":"Alterado"','"nome":"Peça sintética OEM 12345-67890"');
assert.ok(fixture.includes("Peça sintética OEM 12345-67890"));
admin(fixture+
"\nreset role;\n"+
"update public.nano_lifecycle_checkpoint set despacho_habilitado=true,consumo_habilitado=true where loja_id='"+L+"';\n"+
"update public.produto_automacao set pausado=false where produto_id='"+P+"';\n"+
"insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('"+L+"',date_trunc('month',now())::date,1);\n"+
Object.entries(passwords).map(([name,pw])=>"create role "+name+" login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '"+pw+"';").join("\n")+
"\ngrant nano_lifecycle_produtor to nano_e2e_prod;\ngrant nano_lifecycle_auditoria to nano_e2e_parecer,nano_e2e_auditor;\n"+
"insert into nano_lifecycle_interno.produtor_escopos values('nano_e2e_prod','"+L+"',true);\n"+
"insert into nano_lifecycle_interno.auditoria_escopos values('nano_e2e_parecer','"+L+"',true),('nano_e2e_auditor','"+L+"',true);\n"+
"set local role service_role;\nselect public.nano_lifecycle_encaminhar('"+L+"','sync_0002',(select dados->0->>'idempotency_key' from evento));\nreset role;\ncommit;\n");
const I=admin("select id from public.pipeline_itens where loja_id='"+L+"' and entrada->>'origem'='nano_lifecycle';");
assert.match(I,/^[0-9a-f-]{36}$/);
const conteudo="Documento sintético: OEM 12345-67890, Marca teste, Modelo teste, G1, M1, Euro 5, BR, ano modelo 2014 a 2016.";
const hash=createHash("sha256").update(conteudo).digest("hex");
admin("insert into nano_lifecycle_interno.fontes_documentais values('"+L+"','f','catalogo_fabricante','Emissor sintético',true);\n"+
"insert into nano_lifecycle_interno.documentos_tecnicos(loja_id,id,fonte_id,conteudo,consultado_em,referencia) values('"+L+"','d','f','"+conteudo+"',clock_timestamp()-interval '1 day','fixture p. 1');");
const sessions=[];
function connect(user,role){
 const child=spawn("psql",args(user),{env:env(passwords[user]),stdio:["pipe","pipe","pipe"]});
 const rl=createInterface({input:child.stdout});let pending=null;let closed=false;
 child.stderr.resume(); // Não imprime credenciais ou conteúdo de fixture.
 const fail=()=>{closed=true;if(pending){clearTimeout(pending.timer);pending.reject(Error("sessão SQL encerrada"));pending=null;}};
 child.on("error",fail);child.on("exit",fail);child.stdin.on("error",fail);
 rl.on("line",line=>{
  if(!pending)return;
  if(line==="__NANO_FIM__"){
   const p=pending;pending=null;clearTimeout(p.timer);
   try{p.resolve(p.rows.map(x=>JSON.parse(x)));}catch(e){p.reject(e);}
  }else if(line.trim())pending.rows.push(line);
 });
 child.stdin.write("set role "+role+";\n");
 const session={
  consultar(sql,params){
   assert.ok(!closed&&!pending&&/^select /i.test(sql)&&!sql.includes(";"));
   // psql 16+ \bind envia valores pelo protocolo estendido, não concatena no SQL.
   const literal=v=>"'"+String(v).replaceAll("\\","\\\\").replaceAll("'","\\'").replaceAll("\n","\\n").replaceAll("\r","\\r")+"'";
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();fail();},15000);
    pending={resolve,reject,timer,rows:[]};
    child.stdin.write("select row_to_json(q) from ("+sql+") q\n\\bind "+params.map(literal).join(" ")+"\n\\g\n\\echo __NANO_FIM__\n");
   });
  },
  close(){child.stdin.end();child.kill();}
 };
 sessions.push(session);return session;
}
const rpc=async(s,fn,types,params)=>{
 const rows=await s.consultar("select nano_lifecycle_interno."+fn+"("+types.map((t,i)=>"$"+(i+1)+"::"+t).join(",")+") as valor",params);
 assert.equal(rows.length,1);return rows[0].valor;
};
const keyTypes=["uuid","uuid","uuid","bigint","integer"];
const k={loja:L,item:I,execucao:X,geracao:1,versao:1},v=[L,I,X,1,1];
const fato={oem:"12345-67890",montadora:"Marca teste",modelo:"Modelo teste",geracao:"G1",motor:"M1",emissao:"Euro 5",mercado:"BR",tipo_ano:"ano_modelo_crlv",ano_inicio:2014,ano_fim:2016};
try{
 const prod=connect("nano_e2e_prod","nano_lifecycle_produtor"),parecer=connect("nano_e2e_parecer","nano_lifecycle_auditoria"),audit=connect("nano_e2e_auditor","nano_lifecycle_auditoria");
 const lease=await rpc(prod,"nano_lifecycle_reservar_produtor",["uuid","uuid","uuid","integer"],[L,I,X,180]);assert.equal(lease.estado,"reservado");assert.equal(lease.geracao,1);
 const entrada=await rpc(prod,"nano_lifecycle_entrada_produtor",keyTypes,v);assert.equal(entrada.estado,"preparada");
 const p=entrada.produto,extracao=extrair(p.sku,p.nome,[p.descricao_curta,p.descricao_complementar].filter(Boolean).join(". "),p.marca??"",p.gtin??"");
 assert.ok(extracao.codigos_oem.some(o=>o.normalizado===fato.oem));
 const recibo=await rpc(prod,"nano_lifecycle_persistir_com_autoria",[...keyTypes,"jsonb","jsonb"],[...v,JSON.stringify(entrada),JSON.stringify(extracao)]);assert.equal(recibo.estado,"gravado");
 assert.equal(await rpc(prod,"nano_lifecycle_liberar_produtor",keyTypes,v),true);
 const r=await rpc(parecer,"nano_lifecycle_atestar_fato",[...keyTypes,"text","text","text","text","jsonb","text"],[...v,"d",hash,"p. 1",conteudo,JSON.stringify(fato),"confere"]);assert.equal(r.estado,"registrado");
 const candidato={escopo:{...k,produto:P,sku:p.sku,revisao:entrada.revisao,checkpoint:entrada.checkpoint,hashEntrada:recibo.hash_entrada,hashExtracao:recibo.hash_extracao,produtor:"nano_e2e_prod"},fato,fonteId:"f",documentoId:"d",localizador:"p. 1"};
 const conferir=c=>conferirComAuditorSql(c,k,audit,"nano_e2e_auditor",new Date().toISOString());
 assert.deepEqual(await conferir(candidato),{estado:"procedencia_conferida",leituraId:r.id,sha256:hash,homologada:false});
 assert.equal((await conferir({...candidato,escopo:{...candidato.escopo,geracao:2}})).estado,"retida");
 assert.equal((await conferir({...candidato,fato:{...fato,oem:"99999-99999"}})).estado,"retida");
 const atual=()=>conferirEvidenciaAtualComAuditorSql(candidato,k,audit,"nano_e2e_auditor",new Date().toISOString());
 assert.equal((await atual()).atualidade,"conferida_no_instante");
 const pre=()=>conferirPreGateSql(candidato,k,audit,"nano_e2e_auditor",new Date().toISOString());
 const sqlGate=(sess,c=candidato,id=r.id,h=hash)=>rpc(sess,"nano_lifecycle_pre_gate",[...keyTypes,"jsonb","uuid","text"],[...v,JSON.stringify(c),id,h]);
 assert.equal((await pre()).preGate,"conforme_no_snapshot");
 assert.equal(await sqlGate(parecer),false); // terceiro auditor, sem autoconsenso
 assert.equal(await sqlGate(audit,{...candidato,fato:{...fato,motor:"OUTRO"}}),false);
 assert.equal(await sqlGate(audit,candidato,"00000000-0000-0000-0000-000000000001"),false);
 assert.equal(await sqlGate(audit,candidato,r.id,"0".repeat(64)),false);
 admin("update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+L+"' and id='f';");
 assert.equal(await sqlGate(audit),false);
 admin("update nano_lifecycle_interno.fontes_documentais set autorizada=true where loja_id='"+L+"' and id='f';");
 admin("update nano_lifecycle_interno.auditoria_escopos set habilitado=false where loja_id='"+L+"' and login_db='nano_e2e_parecer';");
 assert.equal(await sqlGate(audit),false);
 admin("update nano_lifecycle_interno.auditoria_escopos set habilitado=true where loja_id='"+L+"' and login_db='nano_e2e_parecer';");
 assert.equal(await sqlGate(audit),true);
 const request="fb300000-0000-0000-0000-000000000001", deniedRequest="fb300000-0000-0000-0000-000000000002";
 const registro=()=>registrarConferenciaSql(candidato,k,audit,"nano_e2e_auditor",new Date().toISOString(),request);
 const registrar=(sess,c=candidato,id=request)=>rpc(sess,"nano_lifecycle_registrar_conferencia",[...keyTypes,"jsonb","uuid","text","uuid"],[...v,JSON.stringify(c),r.id,hash,id]);
 assert.deepEqual(await registro(),{estado:"registrada",solicitacao:request,homologada:false});
 assert.deepEqual(await registro(),{estado:"ja_registrada",solicitacao:request,homologada:false});
 assert.equal((await registrar(parecer,candidato,deniedRequest)).estado,"retida");
 assert.equal((await registrar(audit,{...candidato,fato:{...fato,motor:"OUTRO"}},deniedRequest)).estado,"retida");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"';"),"1");
 assert.throws(()=>admin("update nano_lifecycle_interno.conferencias_gate set homologada=true where loja_id='"+L+"';"),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
 assert.equal(admin("select has_table_privilege('nano_lifecycle_auditoria','nano_lifecycle_interno.conferencias_gate','insert');"),"f");

 // CAT-122: contraprova de vínculo explícito no recibo real, não uma nova autoridade.
 // A aplicação e a decisão humana ainda não fazem parte da chave da conferência.
 // As duas aplicações e o usuário abaixo existem somente na transação descartada.
 const app122a="fb122000-0000-0000-0000-000000000001",app122b="fb122000-0000-0000-0000-000000000002";
 const marca122="fb122100-0000-0000-0000-000000000001",humano122="fb122200-0000-0000-0000-000000000001";
 const snapshot122=admin(`
 begin;
 insert into public.marcas(id,loja_id,nome,tipo,status) values ('${marca122}','${L}','Marca teste CAT-122','veiculo','aprovado');
 insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,motorizacao,ano_inicial,ano_final,marca_veiculo_id,montadora_origem_id,codigo_oem,status,fonte,coletado_em,pagina_indexavel,pagina_slug)
 values ('${app122a}','${L}','${P}','Modelo teste','M1',2014,2016,'${marca122}','${marca122}','12345-67890','a_confirmar','fixture CAT-122',now(),false,'ci-cat-122-a'),
 ('${app122b}','${L}','${P}','Modelo distinto','M2',2014,2016,'${marca122}','${marca122}','12345-67890','a_confirmar','fixture CAT-122',now(),false,'ci-cat-122-b');
 insert into public.usuarios_loja(loja_id,user_id,papel) values ('${L}','${humano122}','lojista');
 select jsonb_build_object('recibo',to_jsonb(c),'aplicacoes',(
  select jsonb_agg(a.id order by a.id) from public.produto_aplicacoes a
  where a.loja_id=c.loja_id and a.produto_id::text=c.candidato->'escopo'->>'produto'
   and a.codigo_oem=c.candidato->'fato'->>'oem' and a.id in ('${app122a}','${app122b}')
 )) from nano_lifecycle_interno.conferencias_gate c where c.loja_id='${L}' and c.solicitacao='${request}';
 set local role authenticated;
 set local request.jwt.claims='{"sub":"${humano122}"}';
 select jsonb_build_object('ator',auth.uid(),'autorizado',public.pode_administrar_loja('${L}'));
 reset role;
 update public.usuarios_loja set papel='editor' where loja_id='${L}' and user_id='${humano122}';
 set local role authenticated;
 select jsonb_build_object('ator',auth.uid(),'autorizado',public.pode_administrar_loja('${L}'));
 reset role;
 select jsonb_build_object('recibo',to_jsonb(c),'pendentes',(
  select count(*) from public.produto_aplicacoes a where a.loja_id='${L}' and a.id in ('${app122a}','${app122b}')
  and a.status='a_confirmar' and not a.pagina_indexavel
 )) from nano_lifecycle_interno.conferencias_gate c where c.loja_id='${L}' and c.solicitacao='${request}';
 rollback;
 `).split("\n").map(linha=>JSON.parse(linha));
 assert.equal(snapshot122.length,4);
 const [s122,aut122,rev122,final122]=snapshot122;
 assert.deepEqual(s122.aplicacoes,[app122a,app122b]);
 assert.equal(s122.recibo.homologada,false);
 assert.equal(s122.recibo.leitura_id,r.id);
 assert.equal(s122.recibo.sha256,hash);
 assert.equal(s122.recibo.aplicacao_id,null);
 assert.equal(s122.recibo.aplicacao_snapshot,null);
 assert.equal(s122.recibo.aplicacao_sha256,null);
 assert.equal(Object.hasOwn(s122.recibo.candidato.escopo,"aplicacao_id"),false);
 assert.equal(Object.hasOwn(s122.recibo.candidato.escopo,"aplicacao"),false);
 console.log("ok: CAT-122-01 recibo persistido real e OEM comum nao identificam aplicacao individual");
 assert.deepEqual(aut122,{ator:humano122,autorizado:true});
 assert.deepEqual(rev122,{ator:humano122,autorizado:false});
 assert.deepEqual(final122.recibo,s122.recibo);
 assert.equal(final122.pendentes,2);
 assert.equal(admin("select count(*) from public.produto_aplicacoes where id in ('"+app122a+"','"+app122b+"');"),"0");
 console.log("ok: CAT-122-02 autoridade humana revogada sem mudar recibo nem aprovar aplicacoes; rollback");

 // CAT-124: escritor técnico real, recibos novos somente em rollback.
 const app124="fb124000-0000-0000-0000-000000000001",app124b="fb124000-0000-0000-0000-000000000002",marca124="fb124100-0000-0000-0000-000000000001",req124="fb124200-0000-0000-0000-000000000001";
 admin("begin; insert into public.marcas(id,loja_id,nome,tipo,status) values ('"+marca124+"','"+L+"','Marca teste','veiculo','aprovado'); insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,motorizacao,ano_inicial,ano_final,marca_veiculo_id,montadora_origem_id,codigo_oem,status,fonte,coletado_em,pagina_indexavel,pagina_slug) values ('"+app124+"','"+L+"','"+P+"','Modelo teste','M1',2014,2016,'"+marca124+"','"+marca124+"','12345-67890','a_confirmar','fixture CAT-124',now(),false,'ci-cat-124-a'),('"+app124b+"','"+L+"','"+P+"','Modelo distinto','M2',2014,2016,'"+marca124+"','"+marca124+"','12345-67890','a_confirmar','fixture CAT-124',now(),false,'ci-cat-124-b'); commit;");
 // Fixture explícita: não copiar campos do candidato na rotina produtiva.
 admin("update public.produto_aplicacoes set nano_geracao_veicular='G1',nano_emissao='Euro 5',nano_mercado='BR',nano_tipo_ano='ano_modelo_crlv' where id in ('"+app124+"','"+app124b+"');");

 // Grafo global sintético do CI, com IDs explícitos.
 const g126=Object.fromEntries(["fonte","montadora","modelo","geracao","versao","familia","motor"].map((x,i)=>[x,"fb126000-0000-0000-0000-00000000000"+(i+1)]));
 admin("begin; insert into public.fontes(id,tipo,titulo,documento,mercado,nano_documento_sha256) values ('"+g126.fonte+"','catalogo_montadora','Fixture CAT-126','Documento sintético CI','BR','"+hash+"'); insert into public.montadoras(id,nome) values ('"+g126.montadora+"','Marca teste'); insert into public.modelos(id,montadora_id,nome,categoria) values ('"+g126.modelo+"','"+g126.montadora+"','Modelo teste','utilitario'); insert into public.geracoes(id,modelo_id,ordem,codigo_interno) values ('"+g126.geracao+"','"+g126.modelo+"',1,'G1'); insert into public.versoes(id,geracao_id,mercado,nome_comercial) values ('"+g126.versao+"','"+g126.geracao+"','BR','Versão CI 126'); insert into public.familias_motor(id,nome) values ('"+g126.familia+"','Família CI 126'); insert into public.motores(id,familia_id,codigo,sistema_emissoes,fonte_id,status) values ('"+g126.motor+"','"+g126.familia+"','M1','Euro 5','"+g126.fonte+"','aprovado'); insert into public.versao_motor(versao_id,motor_id,periodo_inicio,periodo_fim,fonte_id,status) values ('"+g126.versao+"','"+g126.motor+"',2014,2016,'"+g126.fonte+"','aprovado'); update public.produto_aplicacoes set nano_versao_id='"+g126.versao+"',nano_motor_id='"+g126.motor+"' where id in ('"+app124+"','"+app124b+"'); commit;");
 // Vínculo explícito produto -> peça genuína -> aresta técnica (fixture CI).
 const g130=Object.fromEntries(["peca","ponte","aresta","cruzada","motorSomente","arestaCurta","pecaErrada","ponteErrada","arestaErrada"].map((x,i)=>[x,"fb130000-0000-0000-0000-00000000000"+(i+1)]));
 const peca130=(id,codigo)=>"('"+id+"','genuina','"+g126.montadora+"','"+codigo+"','"+g126.fonte+"',now(),'aprovado')";
 const ponte130=(id,peca,relacao)=>"('"+id+"','"+L+"','"+P+"','"+peca+"','"+relacao+"','"+g126.fonte+"',now(),'aprovado')";
 const aresta130=(id,peca,versao)=>"('"+id+"','"+peca+"',"+(versao?"'"+versao+"'":"null")+",'"+g126.motor+"','BR',2014,2016,'"+g126.fonte+"',now(),'aprovado')";
 const insertAresta130="insert into public.pecas_aplicacoes_tecnicas(id,peca_id,versao_id,motor_id,mercado,periodo_inicio,periodo_fim,fonte_id,verificado_em,status) values ";
 admin("begin; insert into public.pecas_ref(id,classe,montadora_id,codigo,fonte_id,verificado_em,status) values "+[peca130(g130.peca,"12345-67890"),peca130(g130.pecaErrada,"OEM-DIVERGENTE")].join(",")+"; insert into public.produto_pecas_ref(id,loja_id,produto_id,peca_id,relacao,fonte_id,verificado_em,status) values "+[ponte130(g130.ponte,g130.peca,"e_esta_peca"),ponte130(g130.cruzada,g130.peca,"referencia_cruzada"),ponte130(g130.ponteErrada,g130.pecaErrada,"e_esta_peca")].join(",")+"; "+insertAresta130+[aresta130(g130.aresta,g130.peca,g126.versao),aresta130(g130.motorSomente,g130.peca,null),aresta130(g130.arestaErrada,g130.pecaErrada,g126.versao)].join(",")+"; update public.produto_aplicacoes set nano_produto_peca_ref_id='"+g130.ponte+"',nano_peca_aplicacao_id='"+g130.aresta+"' where id in ('"+app124+"','"+app124b+"'); commit;");
 const assinatura124="nano_lifecycle_interno.nano_lifecycle_registrar_conferencia(uuid,uuid,uuid,bigint,integer,jsonb,uuid,text,uuid,uuid)";
 for(const papel of ["anon","authenticated","service_role","nano_lifecycle_produtor"])assert.equal(admin("select has_function_privilege('"+papel+"','"+assinatura124+"','EXECUTE');"),"f");
 assert.equal(admin("select has_function_privilege('nano_lifecycle_auditoria','"+assinatura124+"','EXECUTE');"),"t");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_registrador','public.produto_aplicacoes','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 const quote124=x=>"'"+String(x).replaceAll("'","''")+"'";
 const chamada124=(app=app124,id=req124,h=hash,c=candidato)=>"select nano_lifecycle_interno.nano_lifecycle_registrar_conferencia("+[...v,JSON.stringify(c),r.id,h,id,app].map(quote124).join(",")+")::text;";
 const exec124=(user,linhas)=>execFileSync("psql",args(user),{input:"set role nano_lifecycle_auditoria;\nbegin;\n"+linhas.join("\n")+"\nrollback;",encoding:"utf8",timeout:15000,env:env(passwords[user]),stdio:["pipe","pipe","pipe"]}).trim().split("\n").map(JSON.parse);
 const res124=exec124("nano_e2e_auditor",[chamada124(),chamada124(),chamada124(app124b),chamada124(app124,request),chamada124(app124,req124,"0".repeat(64))]);
 assert.deepEqual(res124.map(x=>x.estado),["vinculo_registrado","vinculo_ja_registrado","retida","retida","retida"]);
 assert.ok(res124.every(x=>x.homologada===false));
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req124+"';"),"0");
 console.log("ok: CAT-124-01 registrador técnico real, vínculo individual, retry e colisão com recibo histórico; rollback");
 assert.equal(exec124("nano_e2e_parecer",[chamada124()])[0].estado,"retida");
 admin("update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+L+"' and id='f';");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 admin("update nano_lifecycle_interno.fontes_documentais set autorizada=true where loja_id='"+L+"' and id='f';");
 admin("update public.marcas set nome='Marca alterada' where id='"+marca124+"';");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 admin("update public.marcas set nome='Marca teste' where id='"+marca124+"';");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 assert.equal(admin("select count(*) from public.produto_aplicacoes where id in ('"+app124+"','"+app124b+"') and status='a_confirmar' and not pagina_indexavel;"),"2");
 console.log("ok: CAT-124-02 autoria segregada, revogação da fonte, divergência de marca e ausência de publicação");
 // CAT-125: ausência de qualquer dimensão ou divergência nunca vira prova.
 const filtro125=" where loja_id='"+L+"' and id='"+app124+"';";
 const completo125="nano_geracao_veicular='G1',nano_emissao='Euro 5',nano_mercado='BR',nano_tipo_ano='ano_modelo_crlv'";
 const vazio125="nano_geracao_veicular=null,nano_emissao=null,nano_mercado=null,nano_tipo_ano=null";
 const mudar125=campos=>admin("update public.produto_aplicacoes set "+campos+filtro125);
 mudar125(vazio125);
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 assert.throws(()=>mudar125("nano_geracao_veicular='G1'"),e=>e.stderr?.includes("nano_aplicacao_dimensoes")===true);
 mudar125(completo125);
 for(const delta of ["nano_geracao_veicular='G2'","nano_emissao='Euro 3'","nano_tipo_ano='fabricacao'"]){
  mudar125(delta);
  assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida",delta);
  mudar125(completo125);
 }
 assert.throws(()=>mudar125("nano_mercado='US'"),e=>e.stderr?.includes("nano_aplicacao_dimensoes")===true);
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req124+"';"),"0");
 assert.equal(admin("select count(*) from public.produto_aplicacoes where id='"+app124+"' and status='a_confirmar' and not pagina_indexavel;"),"1");
 console.log("ok: CAT-125-01 dimensões explícitas, ausência e divergências retidas, mercado e tipo de ano estritos; sem homologação");
 // CAT-126: ausência, divergência, revogação e isolamento do grafo.
 const vinculo126="nano_versao_id='"+g126.versao+"',nano_motor_id='"+g126.motor+"'";
 mudar125("nano_versao_id=null,nano_motor_id=null");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 assert.throws(()=>mudar125("nano_versao_id='"+g126.versao+"'"),e=>e.stderr?.includes("nano_aplicacao_grafo_par")===true);
 mudar125(vinculo126);
 for(const [tabela,id,alterado,original] of [
  ["geracoes",g126.geracao,"codigo_interno='G2'","codigo_interno='G1'"],
  ["motores",g126.motor,"sistema_emissoes='Euro 3'","sistema_emissoes='Euro 5'"],
  ["motores",g126.motor,"status='a_confirmar'","status='aprovado'"],
  ["versoes",g126.versao,"mercado='US'","mercado='BR'"],
  ["fontes",g126.fonte,"mercado='US'","mercado='BR'"]
 ]){
  admin("update public."+tabela+" set "+alterado+" where id='"+id+"';");
  assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida",tabela);
  admin("update public."+tabela+" set "+original+" where id='"+id+"';");
 }
 const filtroG126=" where versao_id='"+g126.versao+"' and motor_id='"+g126.motor+"';";
 // A proteção legada impede modificar a aresta aprovada; não usar o bypass de revisão humana.
 assert.throws(()=>admin("update public.versao_motor set periodo_fim=2015"+filtroG126),e=>e.stderr?.includes("registro aprovado não é alterado automaticamente")===true);
 assert.equal(admin("select periodo_fim from public.versao_motor"+filtroG126),"2016");
 // Aresta alternativa com período insuficiente, explicitamente criada em fixture CI.
 const versaoCurta129="fb129000-0000-0000-0000-000000000001";
 admin("begin; insert into public.versoes(id,geracao_id,mercado,nome_comercial) values ('"+versaoCurta129+"','"+g126.geracao+"','BR','Versão CI 129 período curto'); insert into public.versao_motor(versao_id,motor_id,periodo_inicio,periodo_fim,fonte_id,status) values ('"+versaoCurta129+"','"+g126.motor+"',2014,2015,'"+g126.fonte+"','aprovado'); commit;");
 admin(insertAresta130+aresta130(g130.arestaCurta,g130.peca,versaoCurta129)+";");
 mudar125("nano_versao_id='"+versaoCurta129+"',nano_motor_id='"+g126.motor+"',nano_peca_aplicacao_id='"+g130.arestaCurta+"'");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 mudar125(vinculo126+",nano_peca_aplicacao_id='"+g130.aresta+"'");
 console.log("ok: CAT-129-COR-01 proteção legada preservada; aresta alternativa com período insuficiente retida");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_registrador','public.motores','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgname='zz_nano_guard_grafo' and tgenabled='A';"),"9");
 console.log("ok: CAT-126-01 IDs explícitos do grafo, revogação, período e fonte; sem homologação");
 const writer126=spawn("psql",args("postgres"),{env:env("postgres"),stdio:["pipe","pipe","pipe"]});
 writer126.stderr.resume();
 const reader126=createInterface({input:writer126.stdout});
 try {
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("trava grafo CI não iniciou")),10000);
   writer126.once("error",e=>{clearTimeout(timer);reject(e);});
   writer126.once("exit",()=>{clearTimeout(timer);reject(Error("escritor grafo encerrou"));});
   reader126.on("line",line=>{if(line==="__CAT126__"){clearTimeout(timer);resolve();}});
   writer126.stdin.write("begin;\nupdate public.motores set status='a_confirmar' where id='"+g126.motor+"';\n\\echo __CAT126__\n");
  });
  assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"ocupada");
 }finally{
  if(writer126.exitCode===null&&writer126.signalCode===null){
   await new Promise(resolve=>{const timer=setTimeout(()=>writer126.kill(),5000);writer126.once("exit",()=>{clearTimeout(timer);resolve();});writer126.stdin.end("rollback;\n");});
  }
  reader126.close();
 }
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req124+"';"),"0");
 console.log("ok: CAT-126-02 disputa real de escritor do grafo, retenção concorrente e rollback");
 const ref130="nano_produto_peca_ref_id='"+g130.ponte+"',nano_peca_aplicacao_id='"+g130.aresta+"'";
 mudar125("nano_produto_peca_ref_id=null,nano_peca_aplicacao_id=null");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 assert.throws(()=>mudar125("nano_produto_peca_ref_id='"+g130.ponte+"'"),e=>e.stderr?.includes("nano_aplicacao_peca_par")===true);
 mudar125(ref130);
 for(const delta of ["nano_produto_peca_ref_id='"+g130.cruzada+"'","nano_peca_aplicacao_id='"+g130.motorSomente+"'","nano_peca_aplicacao_id='"+g130.arestaErrada+"'","nano_produto_peca_ref_id='"+g130.ponteErrada+"',nano_peca_aplicacao_id='"+g130.arestaErrada+"'"]){
  mudar125(delta);
  assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida",delta);
  mudar125(ref130);
 }
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 for(const tabela of ["produto_pecas_ref","pecas_ref","pecas_aplicacoes_tecnicas"])assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_registrador','public."+tabela+"','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 // CAT-131: hash de conteúdo igual ao documento privado e tipo de fonte permitido.
 const filtroFonte131=" where id='"+g126.fonte+"';";
 for(const valor of ["null","'"+"0".repeat(64)+"'"]){
  admin("update public.fontes set nano_documento_sha256="+valor+filtroFonte131);
  assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 }
 assert.throws(()=>admin("update public.fontes set nano_documento_sha256='inválido'"+filtroFonte131),e=>e.stderr?.includes("nano_fonte_documento_hash")===true);
 admin("update public.fontes set nano_documento_sha256='"+hash+"'"+filtroFonte131);
 admin("update public.fontes set tipo='catalogo_comercial'"+filtroFonte131);
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 admin("update public.fontes set tipo='catalogo_montadora'"+filtroFonte131);
 // Fonte distinta da ponte, mesmo mercado, mas sem conteúdo atestado.
 const fonte131="fb131000-0000-0000-0000-000000000001";
 admin("insert into public.fontes(id,tipo,titulo,documento,mercado,nano_documento_sha256) values ('"+fonte131+"','catalogo_montadora','Fixture CAT-131','Outro documento','BR','"+ "1".repeat(64)+"');");
 const filtroPonte131=" where id='"+g130.ponte+"';";
 admin("update public.produto_pecas_ref set fonte_id='"+fonte131+"'"+filtroPonte131);
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 admin("update public.produto_pecas_ref set fonte_id='"+g126.fonte+"'"+filtroPonte131);
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"vinculo_registrado");
 // Gravação real em transação de teste: o snapshot deve preservar todos os hashes.
 // O papel auditor não recebe SELECT direto sobre recibos; confirmar retorno
 // da RPC e ausência de registro após rollback.
 assert.equal(exec124("nano_e2e_auditor",[chamada124(),chamada124()])[1].estado,"vinculo_ja_registrado");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req124+"';"),"0");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_registrador','public.fontes','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 console.log("ok: CAT-131-01 hash documental ausente/divergente, tipo e fonte alternativa retidos; retry idempotente");
 // CAT-133: produz recibo pelo registrador real e consulta sob outro papel na
 // mesma transação descartável. SET SESSION AUTHORIZATION é apenas harness admin CI.
 const humano133="fb133000-0000-0000-0000-000000000001";
 const req133="fb133000-0000-0000-0000-000000000002";
 const call133=(app=app124,req=req133,loja=L,produto=P)=>"select private.nano_catalogo_conferir_vinculo('"+loja+"','"+produto+"','"+app+"','"+req+"')::text;";
 const auth133="set local role authenticated; set local request.jwt.claims='"+JSON.stringify({sub:humano133})+"';";
 const voltar133="reset role;";
 const teste133=admin([
  "begin;",
  "insert into public.usuarios_loja(loja_id,user_id,papel) values('"+L+"','"+humano133+"','lojista');",
  "set local session authorization nano_e2e_auditor; set local role nano_lifecycle_auditoria;",
  chamada124(app124,req133),
  "reset role; reset session authorization;",
  auth133,call133(),call133(app124b),call133(app124,request),call133(app124,req133,L,app124b),
  voltar133,"update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+L+"' and id='f';",
  auth133,call133(),
  voltar133,"update nano_lifecycle_interno.fontes_documentais set autorizada=true where loja_id='"+L+"' and id='f';",
  "update nano_lifecycle_interno.auditoria_escopos set habilitado=false where loja_id='"+L+"' and login_db='nano_e2e_parecer';",
  auth133,call133(),
  voltar133,"update nano_lifecycle_interno.auditoria_escopos set habilitado=true where loja_id='"+L+"' and login_db='nano_e2e_parecer';",
  "update public.fontes set titulo='Fonte alterada CAT-133'"+filtroFonte131,
  auth133,call133(),
  voltar133,"update public.fontes set titulo='Fixture CAT-126'"+filtroFonte131,
  auth133,call133(),
  voltar133,"update public.usuarios_loja set papel='editor' where loja_id='"+L+"' and user_id='"+humano133+"';",
  auth133,call133(),
  voltar133,
  "select jsonb_build_object('pendente',status='a_confirmar','indexavel',pagina_indexavel) from public.produto_aplicacoes where id='"+app124+"';",
  "rollback;"
 ].join("\n")).split("\n").map(JSON.parse);
 assert.equal(teste133[0].estado,"vinculo_registrado");
 const esperado133={estado:"vinculo_consultivo",ator:humano133,loja:L,produto:P,aplicacao:app124,recibo:req133,homologada:false};
 const retido133={estado:"retida",homologada:false};
 assert.deepEqual(teste133.slice(1),[esperado133,retido133,retido133,retido133,retido133,retido133,retido133,esperado133,retido133,{pendente:true,indexavel:false}]);
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req133+"';"),"0");
 for(const papel of ["anon","service_role","nano_lifecycle_produtor","nano_lifecycle_auditoria"])assert.equal(admin("select has_function_privilege('"+papel+"','private.nano_catalogo_conferir_vinculo(uuid,uuid,uuid,uuid)','EXECUTE');"),"f");
 for(const tabela of ["public.produto_aplicacoes","public.usuarios_loja","public.fontes","nano_lifecycle_interno.conferencias_gate","nano_lifecycle_interno.leituras_documentais","nano_lifecycle_interno.fontes_documentais","nano_lifecycle_interno.auditoria_escopos"])assert.equal(admin("select has_table_privilege('nano_catalogo_vinculo_humano_leitor','"+tabela+"','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 assert.equal(admin("select rolcanlogin or rolbypassrls or rolsuper from pg_roles where rolname='nano_catalogo_vinculo_humano_leitor';"),"f");
 console.log("ok: CAT-133-01 recibo vinculado, escopo, snapshot alterado, revogacoes e leitor sem escrita");
 // CAT-134: cada contraprova ocorre sob a mesma transação do recibo real.
 const teste134=admin([
  "begin;",
  "insert into public.usuarios_loja(loja_id,user_id,papel) values('"+L+"','"+humano133+"','lojista');",
  "set local session authorization nano_e2e_auditor; set local role nano_lifecycle_auditoria;",
  chamada124(app124,req133),
  "reset role; reset session authorization;",
  auth133,call133(),voltar133,
  "update public.nano_lifecycle_checkpoint set consumo_habilitado=false where loja_id='"+L+"';",
  auth133,call133(),voltar133,
  "update public.nano_lifecycle_checkpoint set consumo_habilitado=true where loja_id='"+L+"';",
  "update public.produto_automacao set pausado=true where produto_id='"+P+"';",
  auth133,call133(),voltar133,
  "update public.produto_automacao set pausado=false where produto_id='"+P+"';",
  "revoke nano_lifecycle_auditoria from nano_e2e_parecer;",
  auth133,call133(),voltar133,
  "grant nano_lifecycle_auditoria to nano_e2e_parecer;",
  "savepoint parecer_concorrente;",
  "insert into nano_lifecycle_interno.leituras_documentais(loja_id,item_id,geracao,escopo,documento_id,fonte_id,sha256,localizador,trecho,fato,verificador,resultado) select loja_id,item_id,geracao,escopo,documento_id,fonte_id,sha256,localizador,trecho,fato,'nano_e2e_auditor','diverge' from nano_lifecycle_interno.leituras_documentais where id='"+r.id+"';",
  auth133,call133(),voltar133,
  "rollback to parecer_concorrente;",
  auth133,call133(),voltar133,
  "select jsonb_build_object('pendente',status='a_confirmar','indexavel',pagina_indexavel) from public.produto_aplicacoes where id='"+app124+"';",
  "rollback;"
 ].join("\n")).split("\n").map(JSON.parse);
 assert.equal(teste134[0].estado,"vinculo_registrado");
 assert.deepEqual(teste134.slice(1),[esperado133,retido133,retido133,retido133,retido133,esperado133,{pendente:true,indexavel:false}]);
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req133+"';"),"0");
 for(const tabela of ["public.nano_lifecycle_checkpoint","public.nano_lifecycle_reserva","public.nano_lifecycle_snapshots","public.pipeline_itens","public.produto_automacao","public.produtos","nano_lifecycle_interno.documentos_tecnicos","nano_lifecycle_interno.resultados_engenharia","nano_lifecycle_interno.autorias_engenharia"])assert.equal(admin("select has_table_privilege('nano_catalogo_vinculo_humano_leitor','"+tabela+"','INSERT,UPDATE,DELETE,TRUNCATE');"),"f");
 console.log("ok: CAT-134-01 checkpoint, pausa, papel DB revogado e parecer concorrente retidos; readback consultivo e rollback");
 // Revogação permitida pelo guard legado, sem reaprovação artificial.
 admin("update public.pecas_aplicacoes_tecnicas set status='desatualizado' where id='"+g130.aresta+"';");
 assert.equal(exec124("nano_e2e_auditor",[chamada124()])[0].estado,"retida");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+req124+"';"),"0");
 assert.equal(admin("select count(*) from public.produto_aplicacoes where id='"+app124+"' and status='a_confirmar' and not pagina_indexavel;"),"1");
 console.log("ok: CAT-130-01 peça genuína, ponte direta do produto, aresta versão/motor, OEM divergente e revogação; sem homologação");



 // Disputa real de duas sessões com a mesma identidade: um registro, outro retry ou ocupado.
 const audit2=connect("nano_e2e_auditor","nano_lifecycle_auditoria");
 const concorrente="fb300000-0000-0000-0000-000000000003";
 const respostas=await Promise.all([registrar(audit,candidato,concorrente),registrar(audit2,candidato,concorrente)]);
 assert.equal(respostas.filter(x=>x.estado==="registrada").length,1);
 assert.ok(respostas.some(x=>["ja_registrada","ocupada"].includes(x.estado)));
 assert.equal((await registrar(audit,candidato,concorrente)).estado,"ja_registrada");
 // Escritor concorrente: trava ROW EXCLUSIVE é mantida até rollback.
 async function testarEscritor(tabela,mutacao,esperado='ocupada',login='postgres',resultadoEscrita=null){
  const writer=spawn("psql",args(login),{env:env(login==="postgres"?"postgres":passwords[login]),stdio:["pipe","pipe","pipe"]});
  writer.stderr.resume();
  const rl=createInterface({input:writer.stdout});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("escritor não iniciou")),10000);
    writer.once("exit",()=>{clearTimeout(timer);reject(Error("escritor encerrou"));});
    const linhas=[];
    rl.on("line",line=>{if(line==="__NANO_ESCRITOR__"){clearTimeout(timer);if(resultadoEscrita!==null&&!linhas.includes(resultadoEscrita))reject(Error("resultado inesperado do escritor"));else resolve();}else linhas.push(line);});
    const inicio=login==="postgres"?"lock table "+tabela+" in row exclusive mode;\n":"set local role nano_lifecycle_auditoria;\n";
    writer.stdin.write("begin;\n"+inicio+mutacao+"\n\\echo __NANO_ESCRITOR__\n");
   });
   if(esperado==="ocupada")assert.equal((await registrar(audit,candidato,deniedRequest)).estado,"ocupada");
   assert.equal((await registrar(audit,candidato,concorrente)).estado,esperado);
  }finally{
   const exited=new Promise(resolve=>writer.once("exit",resolve));
   writer.stdin.end("rollback;\n");
   if(writer.exitCode===null&&writer.signalCode===null)await exited;
   rl.close();
  }
 }
 await testarEscritor("nano_lifecycle_interno.auditoria_escopos","update nano_lifecycle_interno.auditoria_escopos set habilitado=false where loja_id='"+L+"' and login_db='nano_e2e_parecer';");
 await testarEscritor("nano_lifecycle_interno.fontes_documentais","update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+L+"' and id='f';");
 await testarEscritor("public.produto_automacao","update public.produto_automacao set pausado=true where produto_id='"+P+"';");
 // Alteração documental em loja distinta não impede o retry da loja L.
 const outra="fa000000-0000-0000-0000-000000000099";
 admin("insert into nano_lifecycle_interno.auditoria_escopos(login_db,loja_id,habilitado) values('nano_e2e_parecer','"+outra+"',true);");
 admin("insert into nano_lifecycle_interno.fontes_documentais(loja_id,id,tipo,emissor,autorizada) values('"+outra+"','f','manual_montadora','Fonte sintética distinta',true);");
 await testarEscritor("nano_lifecycle_interno.auditoria_escopos","update nano_lifecycle_interno.auditoria_escopos set habilitado=false where loja_id='"+outra+"' and login_db='nano_e2e_parecer';","ja_registrada");
 await testarEscritor("nano_lifecycle_interno.fontes_documentais","update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+outra+"' and id='f';","ja_registrada");
 // UPDATE, INSERT e DELETE compartilham a trava da mesma loja.
 await testarEscritor("nano_lifecycle_interno.fontes_documentais","insert into nano_lifecycle_interno.fontes_documentais(loja_id,id,tipo,emissor,autorizada) values('"+L+"','nova','manual_montadora','Sintética',true);");
 await testarEscritor("nano_lifecycle_interno.auditoria_escopos","delete from nano_lifecycle_interno.auditoria_escopos where loja_id='"+L+"' and login_db='nano_e2e_parecer';");
 assert.throws(()=>admin("update nano_lifecycle_interno.fontes_documentais set loja_id='"+outra+"' where loja_id='"+L+"' and id='f';"),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
 assert.throws(()=>admin("truncate nano_lifecycle_interno.auditoria_escopos;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
 // Documentos novos: disputa somente dentro da mesma loja, inclusive se o INSERT usar modo replica.
 const inserirDoc=loja=>"insert into nano_lifecycle_interno.documentos_tecnicos(loja_id,id,fonte_id,conteudo,consultado_em,referencia) values('"+loja+"','doc-concorrente','f','Documento sintético concorrente',clock_timestamp(),'fixture p. 2');";
 await testarEscritor("nano_lifecycle_interno.documentos_tecnicos",inserirDoc(L));
 await testarEscritor("nano_lifecycle_interno.documentos_tecnicos",inserirDoc(outra),"ja_registrada");
 await testarEscritor("nano_lifecycle_interno.documentos_tecnicos","set local session_replication_role=replica;\n"+inserirDoc(L));
 // Rollbacks concorrentes não criam documentos nem alteram a evidência histórica.
 assert.equal(admin("select count(*) from nano_lifecycle_interno.documentos_tecnicos where id='doc-concorrente';"),"0");
 assert.equal(admin("select sha256 from nano_lifecycle_interno.documentos_tecnicos where loja_id='"+L+"' and id='d';"),hash);
 const docHistorico=" where loja_id='"+L+"' and id='d';";
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update nano_lifecycle_interno.documentos_tecnicos set referencia='alterada'"+docHistorico),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  assert.throws(()=>admin(prefixo+"delete from nano_lifecycle_interno.documentos_tecnicos"+docHistorico),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
 }
 assert.throws(()=>admin("begin; set local session_replication_role=replica; insert into nano_lifecycle_interno.documentos_tecnicos(loja_id,id,fonte_id,conteudo,sha256,consultado_em,referencia) values('"+L+"','hash-incorreto','f','Documento sintético','"+ "0".repeat(64)+"',clock_timestamp(),'fixture');"),e=>e.stderr?.includes("hash documental divergente")===true);
 // Segunda loja com cadeia de evidência real e separada, sem desabilitar FKs.
 const P2="fc100000-0000-0000-0000-000000000001",X2="fc200000-0000-0000-0000-000000000003";
 const fixture2=fixture.replaceAll(L,outra).replaceAll(P,P2).replaceAll("fa200000-","fc200000-").replaceAll("nano-auditoria-e2e","nano-auditoria-e2e-outra").replaceAll("NANO-EV1","NANO-EV2");
 admin(fixture2+
 "\nreset role;\n"+
 "update public.nano_lifecycle_checkpoint set despacho_habilitado=true,consumo_habilitado=true where loja_id='"+outra+"';\n"+
 "update public.produto_automacao set pausado=false where produto_id='"+P2+"';\n"+
 "insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('"+outra+"',date_trunc('month',now())::date,1);\n"+
 "insert into nano_lifecycle_interno.produtor_escopos values('nano_e2e_prod','"+outra+"',true);\n"+
 "set local role service_role;\nselect public.nano_lifecycle_encaminhar('"+outra+"','sync_0002',(select dados->0->>'idempotency_key' from evento));\nreset role;\ncommit;");
 const I2=admin("select id from public.pipeline_itens where loja_id='"+outra+"' and entrada->>'origem'='nano_lifecycle';");
 assert.match(I2,/^[0-9a-f-]{36}$/);
 admin("insert into nano_lifecycle_interno.documentos_tecnicos(loja_id,id,fonte_id,conteudo,consultado_em,referencia) values('"+outra+"','d','f','"+conteudo+"',clock_timestamp()-interval '1 day','fixture p. 1');");
 const v2=[outra,I2,X2,1,1];
 const lease2=await rpc(prod,"nano_lifecycle_reservar_produtor",["uuid","uuid","uuid","integer"],[outra,I2,X2,180]);
 assert.equal(lease2.estado,"reservado");assert.equal(lease2.geracao,1);
 const entrada2=await rpc(prod,"nano_lifecycle_entrada_produtor",keyTypes,v2);assert.equal(entrada2.estado,"preparada");
 const p2=entrada2.produto,ex2=extrair(p2.sku,p2.nome,[p2.descricao_curta,p2.descricao_complementar].filter(Boolean).join(". "),p2.marca??"",p2.gtin??"");
 assert.equal((await rpc(prod,"nano_lifecycle_persistir_com_autoria",[...keyTypes,"jsonb","jsonb"],[...v2,JSON.stringify(entrada2),JSON.stringify(ex2)])).estado,"gravado");
 assert.equal(await rpc(prod,"nano_lifecycle_liberar_produtor",keyTypes,v2),true);
 const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
 const atestarConcorrente=chave=>"select nano_lifecycle_interno.nano_lifecycle_atestar_fato("+[...chave,"d",hash,"p. 2",conteudo,JSON.stringify(fato),"confere"].map(lit).join(",")+")->>'estado';";
 // Escrita efetiva pela RPC do parecerista, mantida aberta até rollback.
 await testarEscritor("nano_lifecycle_interno.leituras_documentais",atestarConcorrente(v),"ocupada","nano_e2e_parecer","registrado");
 await testarEscritor("nano_lifecycle_interno.leituras_documentais",atestarConcorrente(v2),"ja_registrada","nano_e2e_parecer","registrado");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.leituras_documentais where loja_id in ('"+L+"','"+outra+"');"),"1");
 const leituraHistorica=" where id='"+r.id+"';";
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update nano_lifecycle_interno.leituras_documentais set resultado='diverge'"+leituraHistorica),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  assert.throws(()=>admin(prefixo+"delete from nano_lifecycle_interno.leituras_documentais"+leituraHistorica),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  // RESTRICT rejeita primeiro a FK de conferencias_gate; não confundir com o trigger.
  assert.throws(()=>admin(prefixo+"truncate nano_lifecycle_interno.leituras_documentais;"),e=>e.stderr?.includes("cannot truncate a table referenced in a foreign key constraint")===true);
  // Inclui explicitamente a tabela dependente para exercitar o trigger histórico.
  // Transação descartável: mesmo se a proteção falhar, ROLLBACK preserva a fixture e a asserção falha.
  const inicio=prefixo||"begin; ";
  assert.throws(()=>admin(inicio+"truncate nano_lifecycle_interno.leituras_documentais,nano_lifecycle_interno.conferencias_gate; rollback;"),e=>e.stderr?.includes("documento técnico histórico imutável")===true||e.stderr?.includes("truncate documental bloqueado")===true);
 }
 assert.equal(admin("select count(*) from nano_lifecycle_interno.leituras_documentais where id='"+r.id+"' and resultado='confere' and sha256='"+hash+"';"),"1");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"';"),"2");
 // Fixture exclusivamente sintética de resultado sem autoria, em ambas as lojas.
 // Prepara o pai ANTES da disputa: a trava SHARE de resultados ainda existe.
 // Assim o teste mede a autoria isoladamente, não a RPC composta.
 const filtroAutoria=" where loja_id in ('"+L+"','"+outra+"') and geracao=1";
 admin("insert into nano_lifecycle_interno.resultados_engenharia(loja_id,item_id,execucao,geracao,versao,revisao,checkpoint,produto_id,entrada_snapshot,extracao_candidata,hash_entrada,hash_extracao,extrator) select loja_id,item_id,execucao,101,versao,revisao,checkpoint,produto_id,entrada_snapshot,extracao_candidata,hash_entrada,hash_extracao,extrator from nano_lifecycle_interno.resultados_engenharia"+filtroAutoria+";");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.resultados_engenharia where loja_id in ('"+L+"','"+outra+"') and geracao=101;"),"2");
 const inserirAutoria=loja=>"insert into nano_lifecycle_interno.autorias_engenharia(loja_id,item_id,geracao,execucao,versao,produtor,hash_entrada,hash_extracao) select loja_id,item_id,101,execucao,versao,produtor,hash_entrada,hash_extracao from nano_lifecycle_interno.autorias_engenharia where loja_id='"+loja+"' and geracao=1 returning geracao;";
 await testarEscritor("nano_lifecycle_interno.autorias_engenharia",inserirAutoria(L),"ocupada","postgres","101");
 await testarEscritor("nano_lifecycle_interno.autorias_engenharia",inserirAutoria(outra),"ja_registrada","postgres","101");
 await testarEscritor("nano_lifecycle_interno.autorias_engenharia","set local session_replication_role=replica;\n"+inserirAutoria(L),"ocupada","postgres","101");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.autorias_engenharia where loja_id in ('"+L+"','"+outra+"') and geracao=101;"),"0");
 const autoriaHistorica=" where loja_id='"+L+"' and item_id='"+I+"' and geracao=1;";
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update nano_lifecycle_interno.autorias_engenharia set produtor='outro'"+autoriaHistorica),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  assert.throws(()=>admin(prefixo+"delete from nano_lifecycle_interno.autorias_engenharia"+autoriaHistorica),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  assert.throws(()=>admin(prefixo+"truncate nano_lifecycle_interno.autorias_engenharia;"),e=>e.stderr?.includes("cannot truncate a table referenced in a foreign key constraint")===true);
  // Inclui os dependentes para chegar ao trigger da própria autoria; rollback mesmo em caso de defeito.
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate nano_lifecycle_interno.autorias_engenharia,nano_lifecycle_interno.leituras_documentais,nano_lifecycle_interno.conferencias_gate; rollback;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
 }
 assert.equal(admin("select produtor||':'||hash_entrada||':'||hash_extracao from nano_lifecycle_interno.autorias_engenharia"+autoriaHistorica),"nano_e2e_prod:"+recibo.hash_entrada+":"+recibo.hash_extracao);
 // Resultado isolado: a fixture é sintética; a RPC composta mantém as seis travas de origem.
 const inserirResultado=(loja,he="hash_entrada",hr="hash_extracao")=>"insert into nano_lifecycle_interno.resultados_engenharia(loja_id,item_id,execucao,geracao,versao,revisao,checkpoint,produto_id,entrada_snapshot,extracao_candidata,hash_entrada,hash_extracao,extrator) select loja_id,item_id,execucao,102,versao,revisao,checkpoint,produto_id,entrada_snapshot,extracao_candidata,"+he+","+hr+",extrator from nano_lifecycle_interno.resultados_engenharia where loja_id='"+loja+"' and geracao=1 returning geracao;";
 await testarEscritor("nano_lifecycle_interno.resultados_engenharia",inserirResultado(L),"ocupada","postgres","102");
 await testarEscritor("nano_lifecycle_interno.resultados_engenharia",inserirResultado(outra),"ja_registrada","postgres","102");
 await testarEscritor("nano_lifecycle_interno.resultados_engenharia","set local session_replication_role=replica;\n"+inserirResultado(L),"ocupada","postgres","102");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.resultados_engenharia where loja_id in ('"+L+"','"+outra+"') and geracao=102;"),"0");
 const resultadoHistorico=" where loja_id='"+L+"' and item_id='"+I+"' and geracao=1;";
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  for(const mutacao of ["update nano_lifecycle_interno.resultados_engenharia set extracao_candidata='{}'","update nano_lifecycle_interno.resultados_engenharia set hash_entrada='alterado'","update nano_lifecycle_interno.resultados_engenharia set homologada=true","delete from nano_lifecycle_interno.resultados_engenharia"]){
   assert.throws(()=>admin(prefixo+mutacao+resultadoHistorico),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  }
  assert.throws(()=>admin(prefixo+inserirResultado(L,"repeat('0',64)")),e=>e.stderr?.includes("hash de resultado de engenharia divergente")===true);
  assert.throws(()=>admin(prefixo+inserirResultado(L,"hash_entrada","repeat('0',64)")),e=>e.stderr?.includes("hash de resultado de engenharia divergente")===true);
  assert.throws(()=>admin(prefixo+"truncate nano_lifecycle_interno.resultados_engenharia;"),e=>e.stderr?.includes("cannot truncate a table referenced in a foreign key constraint")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate nano_lifecycle_interno.resultados_engenharia,nano_lifecycle_interno.autorias_engenharia,nano_lifecycle_interno.leituras_documentais,nano_lifecycle_interno.conferencias_gate; rollback;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
 }
 assert.equal(admin("select count(*) from nano_lifecycle_interno.resultados_engenharia"+resultadoHistorico.slice(0,-1)+" and not homologada and hash_entrada=encode(sha256(convert_to(entrada_snapshot::text,'UTF8')),'hex') and hash_extracao=encode(sha256(convert_to(extracao_candidata::text,'UTF8')),'hex');"),"1");
 assert.equal(admin("select hash_entrada||':'||hash_extracao from nano_lifecycle_interno.resultados_engenharia"+resultadoHistorico),recibo.hash_entrada+":"+recibo.hash_extracao);
 // Capturas pais sintéticas preexistentes: mede apenas a escrita do snapshot,
 // sem declarar que a finalização composta (checkpoint/reserva) foi isolada.
 admin("insert into public.nano_lifecycle_capturas(loja_id,revisao,estado,eventos,bloqueios) values('"+L+"','fixture_snap_70','baseline','[]','[]'),('"+outra+"','fixture_snap_70','baseline','[]','[]');");
 const inserirSnapshot=loja=>"insert into public.nano_lifecycle_snapshots(loja_id,revisao,execucao,geracao,digest,produtos) select loja_id,'fixture_snap_70',execucao,geracao,digest,produtos from public.nano_lifecycle_snapshots where loja_id='"+loja+"' and revisao='sync_0002' returning revisao;";
 await testarEscritor("public.nano_lifecycle_snapshots",inserirSnapshot(L),"ocupada","postgres","fixture_snap_70");
 await testarEscritor("public.nano_lifecycle_snapshots",inserirSnapshot(outra),"ja_registrada","postgres","fixture_snap_70");
 await testarEscritor("public.nano_lifecycle_snapshots","set local session_replication_role=replica;\n"+inserirSnapshot(L),"ocupada","postgres","fixture_snap_70");
 assert.equal(admin("select count(*) from public.nano_lifecycle_snapshots where loja_id in ('"+L+"','"+outra+"') and revisao='fixture_snap_70';"),"0");
 const snapshotHistorico=" where loja_id='"+L+"' and revisao='sync_0002';";
 const snapshotAntes=admin("select to_jsonb(s)::text from public.nano_lifecycle_snapshots s"+snapshotHistorico);
 const capturaAntes=admin("select to_jsonb(c)::text from public.nano_lifecycle_capturas c"+snapshotHistorico);
 assert.ok(snapshotAntes&&capturaAntes);
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  for(const mutacao of ["update public.nano_lifecycle_snapshots set digest=repeat('0',64)","update public.nano_lifecycle_snapshots set produtos='[]'","delete from public.nano_lifecycle_snapshots","update public.nano_lifecycle_capturas set eventos='[]'","delete from public.nano_lifecycle_capturas"]){
   assert.throws(()=>admin(prefixo+mutacao+snapshotHistorico),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  }
  assert.throws(()=>admin(prefixo+"truncate public.nano_lifecycle_snapshots;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
  assert.throws(()=>admin(prefixo+"truncate public.nano_lifecycle_capturas;"),e=>e.stderr?.includes("cannot truncate a table referenced in a foreign key constraint")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.nano_lifecycle_capturas,public.nano_lifecycle_snapshots; rollback;"),e=>e.stderr?.includes("documento técnico histórico imutável")===true||e.stderr?.includes("truncate documental bloqueado")===true);
 }
 assert.equal(admin("select to_jsonb(s)::text from public.nano_lifecycle_snapshots s"+snapshotHistorico),snapshotAntes);
 assert.equal(admin("select to_jsonb(c)::text from public.nano_lifecycle_capturas c"+snapshotHistorico),capturaAntes);
 // Checkpoint mutável: alteração isolada sem desligar a reserva da outra loja.
 const atualizarCheckpoint=loja=>"update public.nano_lifecycle_checkpoint set consumo_habilitado=false where loja_id='"+loja+"' returning consumo_habilitado;";
 await testarEscritor("public.nano_lifecycle_checkpoint",atualizarCheckpoint(L),"ocupada","postgres","f");
 await testarEscritor("public.nano_lifecycle_checkpoint",atualizarCheckpoint(outra),"ja_registrada","postgres","f");
 await testarEscritor("public.nano_lifecycle_checkpoint","set local session_replication_role=replica;\n"+atualizarCheckpoint(L),"ocupada","postgres","f");
 // ON CONFLICT também executa o guard no INSERT; não confundir com UPDATE puro.
 const upsertCheckpoint=loja=>"insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values('"+loja+"',true) on conflict(loja_id) do update set consumo_habilitado=false returning consumo_habilitado;";
 await testarEscritor("public.nano_lifecycle_checkpoint",upsertCheckpoint(L),"ocupada","postgres","f");
 await testarEscritor("public.nano_lifecycle_checkpoint",upsertCheckpoint(outra),"ja_registrada","postgres","f");
 const cpFiltro=" where loja_id='"+L+"';";
 const cpAntes=admin("select to_jsonb(c)::text from public.nano_lifecycle_checkpoint c"+cpFiltro);
 const reservaAntes=admin("select to_jsonb(r)::text from public.nano_lifecycle_reserva r"+cpFiltro);
 assert.ok(cpAntes&&reservaAntes);
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update public.nano_lifecycle_checkpoint set loja_id='"+outra+"'"+cpFiltro),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
  assert.throws(()=>admin(prefixo+"delete from public.nano_lifecycle_checkpoint"+cpFiltro),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  assert.throws(()=>admin(prefixo+"truncate public.nano_lifecycle_checkpoint;"),e=>e.stderr?.includes("cannot truncate a table referenced in a foreign key constraint")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.nano_lifecycle_checkpoint cascade; rollback;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
  // A RPC legítima adquire a reserva; desligamento e religamento, inclusive
  // em replica, devem manter a revogação. Tudo reverte ao final do teste.
  const modo=prefixo?"set local session_replication_role=replica; ":"";
  const revogacao=admin("begin; set local role service_role; select public.nano_lifecycle_reservar('"+L+"','fa200000-0000-0000-0000-000000000071')->>'estado'; reset role; "+modo+"update public.nano_lifecycle_checkpoint set habilitado=false"+cpFiltro+" select encerrada from public.nano_lifecycle_reserva"+cpFiltro+" update public.nano_lifecycle_checkpoint set habilitado=true"+cpFiltro+" select encerrada from public.nano_lifecycle_reserva"+cpFiltro+" rollback;");
  assert.equal(revogacao,"reservado\nt\nt");
 }
 assert.equal(admin("select to_jsonb(c)::text from public.nano_lifecycle_checkpoint c"+cpFiltro),cpAntes);
 assert.equal(admin("select to_jsonb(r)::text from public.nano_lifecycle_reserva r"+cpFiltro),reservaAntes);
 assert.equal(admin("select count(*) from public.nano_lifecycle_checkpoint where loja_id in ('"+L+"','"+outra+"') and consumo_habilitado;"),"2");
 // A RPC real de reserva agora escreve apenas tabelas sem SHARE global:
 // disputa na mesma loja, enquanto a loja distinta não impede a conferência.
 const execReserva="fa200000-0000-0000-0000-000000000072";
 const reservarSql=loja=>"set local role service_role; select public.nano_lifecycle_reservar('"+loja+"','"+execReserva+"')->>'estado'; reset role;";
 const histExec=admin("select jsonb_agg(to_jsonb(e) order by geracao)::text from public.nano_lifecycle_execucoes e"+cpFiltro);
 assert.ok(histExec);
 await testarEscritor("public.nano_lifecycle_reserva",reservarSql(L),"ocupada","postgres","reservado");
 await testarEscritor("public.nano_lifecycle_reserva",reservarSql(outra),"ja_registrada","postgres","reservado");
 await testarEscritor("public.nano_lifecycle_reserva","set local session_replication_role=replica;\n"+reservarSql(L),"ocupada","postgres","reservado");
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  for(const mutacao of ["update public.nano_lifecycle_reserva set geracao=geracao-1","update public.nano_lifecycle_reserva set encerrada=false","update public.nano_lifecycle_reserva set execucao='"+execReserva+"'","update public.nano_lifecycle_reserva set expira_em=expira_em+interval '1 day'"]){
   assert.throws(()=>admin(prefixo+mutacao+cpFiltro),e=>e.stderr?.includes("transição de reserva inválida")===true);
  }
  assert.throws(()=>admin(prefixo+"update public.nano_lifecycle_reserva set loja_id='"+outra+"'"+cpFiltro),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
  for(const mutacao of ["delete from public.nano_lifecycle_reserva","delete from public.nano_lifecycle_execucoes","update public.nano_lifecycle_execucoes set geracao=geracao+10"]){
   assert.throws(()=>admin(prefixo+mutacao+cpFiltro),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  }
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.nano_lifecycle_reserva cascade; rollback;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.nano_lifecycle_execucoes cascade; rollback;"),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
 }
 // Retomar somente com UUID novo e geração seguinte; tudo em rollback.
 const execSeguinte="fa200000-0000-0000-0000-000000000073";
 const cicloReserva=admin("begin; set local role service_role; select public.nano_lifecycle_reservar('"+L+"','"+execReserva+"')->>'geracao'; select public.nano_lifecycle_encerrar_reserva('"+L+"','"+execReserva+"',3); select public.nano_lifecycle_reservar('"+L+"','"+execReserva+"')->>'estado'; select public.nano_lifecycle_reservar('"+L+"','"+execSeguinte+"')->>'geracao'; rollback;");
 assert.equal(cicloReserva,"3\nt\nexecucao_encerrada\n4");
 assert.equal(admin("select to_jsonb(r)::text from public.nano_lifecycle_reserva r"+cpFiltro),reservaAntes);
 assert.equal(admin("select jsonb_agg(to_jsonb(e) order by geracao)::text from public.nano_lifecycle_execucoes e"+cpFiltro),histExec);
 assert.equal(admin("select count(*) from public.nano_lifecycle_execucoes where execucao in ('"+execReserva+"','"+execSeguinte+"');"),"0");
 // Pausa da automação: DML legítimo do service_role, apenas em fixtures descartáveis.
 const filtroAuto=" where produto_id in ('"+P+"','"+P2+"')";
 const autoAntes=admin("select jsonb_agg(to_jsonb(a) order by produto_id)::text from public.produto_automacao a"+filtroAuto);
 assert.equal(admin("select count(*) from public.produto_automacao"+filtroAuto+" and not pausado;"),"2");
 const atualizarAuto=produto=>"set local role service_role; update public.produto_automacao set pausado=true where produto_id='"+produto+"' returning pausado; reset role;";
 const upsertAuto=(loja,produto)=>"set local role service_role; insert into public.produto_automacao(loja_id,produto_id,pausado) values('"+loja+"','"+produto+"',true) on conflict(produto_id) do update set pausado=excluded.pausado returning pausado; reset role;";
 const excluirAuto=produto=>"set local role service_role; delete from public.produto_automacao where produto_id='"+produto+"' returning produto_id; reset role;";
 await testarEscritor("public.produto_automacao",atualizarAuto(P),"ocupada","postgres","t");
 await testarEscritor("public.produto_automacao",atualizarAuto(P2),"ja_registrada","postgres","t");
 await testarEscritor("public.produto_automacao",upsertAuto(L,P),"ocupada","postgres","t");
 await testarEscritor("public.produto_automacao",upsertAuto(outra,P2),"ja_registrada","postgres","t");
 await testarEscritor("public.produto_automacao",excluirAuto(P),"ocupada","postgres",P);
 await testarEscritor("public.produto_automacao",excluirAuto(P2),"ja_registrada","postgres",P2);
 await testarEscritor("public.produto_automacao","set local session_replication_role=replica;\n"+atualizarAuto(P),"ocupada","postgres","t");
 await testarEscritor("public.produto_automacao","set local session_replication_role=replica;\n"+upsertAuto(outra,P2),"ja_registrada","postgres","t");
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update public.produto_automacao set loja_id='"+outra+"' where produto_id='"+P+"';"),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
  assert.throws(()=>admin(prefixo+"update public.produto_automacao set produto_id='fa100000-0000-0000-0000-000000000073' where produto_id='"+P+"';"),e=>e.stderr?.includes("identidade de automação protegida")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.produto_automacao; rollback;"),e=>e.stderr?.includes("truncate documental bloqueado")===true);
 }
 // FK composta continua ativa no fluxo normal, mesmo para service_role.
 assert.throws(()=>admin("begin; set local role service_role; delete from public.produto_automacao where produto_id='"+P+"'; insert into public.produto_automacao(loja_id,produto_id,pausado) values('"+outra+"','"+P+"',true); rollback;"),e=>e.stderr?.includes("violates foreign key constraint")===true);
 assert.equal(admin("select jsonb_agg(to_jsonb(a) order by produto_id)::text from public.produto_automacao a"+filtroAuto),autoAntes);
 // Fila legada: INSERT/UPDATE/DELETE sem chamar serviços ou alterar produtos.
 const filaId="fa740000-0000-0000-0000-000000000001",filaId2="fa740000-0000-0000-0000-000000000002";
 const insFila=(loja,id)=>"set local role service_role; insert into public.pipeline_itens(id,loja_id,sku,idempotency_key) values('"+id+"','"+loja+"','FIXTURE-74','fixture-74-"+id+"') returning id; reset role;";
 await testarEscritor("public.pipeline_itens",insFila(L,filaId),"ocupada","postgres",filaId);
 await testarEscritor("public.pipeline_itens",insFila(outra,filaId2),"ja_registrada","postgres",filaId2);
 await testarEscritor("public.pipeline_itens","set local session_replication_role=replica;\n"+insFila(L,filaId),"ocupada","postgres",filaId);
 assert.equal(admin("select count(*) from public.pipeline_itens where id in ('"+filaId+"','"+filaId2+"');"),"0");
 // Linhas legadas preexistentes nas duas lojas, sem vínculo ao produto Nano.
 admin("begin; "+insFila(L,filaId)+insFila(outra,filaId2)+" commit;");
 const filtroFila=" where id in ('"+I+"','"+I2+"','"+filaId+"','"+filaId2+"')";
 const filaAntes=admin("select jsonb_agg(to_jsonb(i) order by id)::text from public.pipeline_itens i"+filtroFila);
 const updFila=id=>"set local role service_role; update public.pipeline_itens set erro='fixture' where id='"+id+"' returning erro; reset role;";
 const delFila=id=>"set local role service_role; delete from public.pipeline_itens where id='"+id+"' returning id; reset role;";
 await testarEscritor("public.pipeline_itens",updFila(filaId),"ocupada","postgres","fixture");
 await testarEscritor("public.pipeline_itens",updFila(filaId2),"ja_registrada","postgres","fixture");
 await testarEscritor("public.pipeline_itens",delFila(filaId),"ocupada","postgres",filaId);
 await testarEscritor("public.pipeline_itens",delFila(filaId2),"ja_registrada","postgres",filaId2);
 // O serviço usa a autoridade existente de reserva; a geração é revertida no rollback.
 const reservarFila=(loja,id)=>"set local role service_role; select public.nano_lifecycle_reivindicar('"+loja+"','"+id+"','fa740000-0000-0000-0000-000000000003',120)->>'estado'; reset role;";
 await testarEscritor("public.pipeline_itens",reservarFila(L,I),"ocupada","postgres","reservado");
 await testarEscritor("public.pipeline_itens",reservarFila(outra,I2),"ja_registrada","postgres","reservado");
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update public.pipeline_itens set loja_id='"+outra+"' where id='"+filaId+"';"),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
  assert.throws(()=>admin(prefixo+"update public.pipeline_itens set estado='normalizado' where id='"+I+"';"),e=>e.stderr?.includes("transição Nano exige consumidor homologado")===true);
  assert.throws(()=>admin(prefixo+"update public.pipeline_itens set nano_geracao=99 where id='"+I+"';"),e=>e.stderr?.includes("lease Nano exige consumidor restrito")===true);
  assert.throws(()=>admin(prefixo+"update public.pipeline_itens set nano_produtor='postgres' where id='"+I+"';"),e=>e.stderr?.includes("autoria de lease protegida")===true);
  assert.throws(()=>admin(prefixo+"delete from public.pipeline_itens where id='"+I+"';"),e=>e.stderr?.includes("exclusão direta Nano bloqueada")===true);
  assert.throws(()=>admin(prefixo+"insert into public.pipeline_itens(loja_id,sku,entrada,idempotency_key) values('"+L+"','FORJADO-74','{\"origem\":\"nano_lifecycle\"}','nano-lifecycle:'||repeat('a',64));"),e=>e.stderr?.includes("criação Nano exige despachante")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.pipeline_itens cascade; rollback;"),e=>/fila Nano protegida|truncate documental bloqueado|TRUNCATE de conflitos bloqueado/i.test(e.stderr??""));
 }
 assert.equal(admin("select jsonb_agg(to_jsonb(i) order by id)::text from public.pipeline_itens i"+filtroFila),filaAntes);
 // Espelho físico: nenhuma trava global de tabela é exigida pelo gate.
 const filtroEspelho=" where id in ('"+P+"','"+P2+"')";
 const espelhoAntes=admin("select jsonb_agg(to_jsonb(p) order by id)::text from public.produtos p"+filtroEspelho);
 const cpAntes75=admin("select jsonb_agg(to_jsonb(c) order by loja_id)::text from public.nano_lifecycle_checkpoint c where loja_id in ('"+L+"','"+outra+"');");
 const reservaAntes75=admin("select jsonb_agg(to_jsonb(r) order by loja_id)::text from public.nano_lifecycle_reserva r where loja_id in ('"+L+"','"+outra+"');");
 const exec75="fa750000-0000-0000-0000-000000000001";
 const lote75=texto=>JSON.parse(texto.split("\n").find(x=>x.includes("public.nano_lifecycle_gravar_espelho(")).match(/'(\[\{.*\}\])'::jsonb/)[1]);
 const sincronizar75=(loja,origem)=>{
  const linhas=lote75(origem);
  assert.equal(linhas[0].loja_id,loja);
  linhas[0].nome="Alteração concorrente sintética 75";
  return "set local role service_role; select public.nano_lifecycle_reservar('"+loja+"','"+exec75+"')->>'geracao'; select public.nano_lifecycle_gravar_espelho('"+loja+"','"+exec75+"',3,'"+JSON.stringify(linhas).replaceAll("'","''")+"'::jsonb); reset role;";
 };
 await testarEscritor("public.produtos",sincronizar75(L,fixture),"ocupada","postgres","1");
 await testarEscritor("public.produtos",sincronizar75(outra,fixture2),"ja_registrada","postgres","1");
 // Um lock de tabela ROW EXCLUSIVE, sozinho, não é alteração de evidência.
 await testarEscritor("public.produtos","select 'sem_dml';","ja_registrada","postgres","sem_dml");
 // Até UPDATE que preserva os dados comerciais participa do protocolo.
 const toqueEspelho=id=>"update public.produtos set publicado=publicado where id='"+id+"' returning id;";
 await testarEscritor("public.produtos",toqueEspelho(P),"ocupada","postgres",P);
 await testarEscritor("public.produtos",toqueEspelho(P2),"ja_registrada","postgres",P2);
 await testarEscritor("public.produtos","set local session_replication_role=replica;\n"+toqueEspelho(P),"ocupada","postgres",P);
 await testarEscritor("public.produtos","set local session_replication_role=replica;\n"+sincronizar75(outra,fixture2),"ja_registrada","postgres","1");
 for(const prefixo of ["","begin; set local session_replication_role=replica; "]){
  assert.throws(()=>admin(prefixo+"update public.produtos set nome='direto' where id='"+P+"';"),e=>e.stderr?.includes("papel de escrita não autorizado")===true);
  assert.throws(()=>admin(prefixo+"update public.produtos set bling_id='98765' where id='"+P+"';"),e=>e.stderr?.includes("identidade protegida")===true);
  assert.throws(()=>admin(prefixo+"update public.produtos set loja_id='"+outra+"' where id='"+P+"';"),e=>e.stderr?.includes("movimento documental entre lojas bloqueado")===true);
  assert.throws(()=>admin(prefixo+"insert into public.produtos(loja_id,bling_id,sku,nome,situacao) values('"+L+"','98765','FORJADO-75','direto','A');"),e=>e.stderr?.includes("papel de escrita não autorizado")===true);
  assert.throws(()=>admin(prefixo+"delete from public.produtos where id='"+P+"';"),e=>e.stderr?.includes("exclusão física protegida")===true);
  assert.throws(()=>admin((prefixo||"begin; ")+"truncate public.produtos cascade; rollback;"),e=>/truncate documental bloqueado|espelho protegido contra truncate/i.test(e.stderr??""));
 }
 assert.equal(admin("select jsonb_agg(to_jsonb(p) order by id)::text from public.produtos p"+filtroEspelho),espelhoAntes);
 assert.equal(admin("select jsonb_agg(to_jsonb(c) order by loja_id)::text from public.nano_lifecycle_checkpoint c where loja_id in ('"+L+"','"+outra+"');"),cpAntes75);
 assert.equal(admin("select jsonb_agg(to_jsonb(r) order by loja_id)::text from public.nano_lifecycle_reserva r where loja_id in ('"+L+"','"+outra+"');"),reservaAntes75);
 assert.equal(admin("select count(*) from public.nano_lifecycle_execucoes where execucao='"+exec75+"';"),"0");
 assert.equal(admin("select count(*) from pg_trigger where tgname in ('zz_nano_guard_documental_loja','zz_nano_guard_documental_truncate') and tgenabled='A';"),"24");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.produtos'::regclass and tgname in ('zz_nano_lifecycle_guard_espelho','zz_nano_lifecycle_guard_truncate') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.produtos','update');"),"f");
 assert.equal(admin("select position('lock table' in lower(pg_get_functiondef('nano_lifecycle_interno.nano_lifecycle_travar_conferencia(uuid,uuid)'::regprocedure)))=0;"),"t");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.pipeline_itens'::regclass and tgname in ('nano_lifecycle_bloquear_transicao','nano_lifecycle_bloquear_truncate','nano_lifecycle_proteger_origem','nano_lifecycle_proteger_produtor') and tgenabled='A';"),"4");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.pipeline_itens','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.produto_automacao'::regclass and tgname='nano_automacao_identidade' and tgenabled='A';"),"1");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.produto_automacao','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.nano_lifecycle_reserva'::regclass and tgname in ('nano_reserva_transicao','nano_reserva_sem_exclusao') and tgenabled='A';"),"2");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.nano_lifecycle_execucoes'::regclass and tgname in ('nano_execucao_imutavel','nano_execucao_truncate') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.nano_lifecycle_reserva','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.nano_lifecycle_checkpoint'::regclass and tgname in ('nano_checkpoint_sem_exclusao','nano_lifecycle_revogar_ao_desligar') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.nano_lifecycle_checkpoint','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.nano_lifecycle_snapshots'::regclass and tgname='nano_snapshot_imutavel' and tgenabled='A';"),"1");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='public.nano_lifecycle_capturas'::regclass and tgname in ('nano_captura_imutavel','nano_captura_truncate') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','public.nano_lifecycle_snapshots','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='nano_lifecycle_interno.resultados_engenharia'::regclass and tgname in ('nano_resultado_hashes','nano_resultado_imutavel') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.resultados_engenharia','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='nano_lifecycle_interno.autorias_engenharia'::regclass and tgname='nano_autoria_imutavel' and tgenabled='A';"),"1");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.autorias_engenharia','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='nano_lifecycle_interno.leituras_documentais'::regclass and tgname in ('nano_leitura_imutavel','nano_leitura_truncate') and tgenabled='A';"),"2");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.leituras_documentais','update');"),"f");
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='nano_lifecycle_interno.documentos_tecnicos'::regclass and tgname in ('nano_documento_hash','nano_documento_imutavel','nano_documento_truncate') and tgenabled='A';"),"3");
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.documentos_tecnicos','update');"),"f");

 assert.equal((await registrar(audit,candidato,concorrente)).estado,"ja_registrada");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"';"),"2");
 assert.equal(admin("select has_function_privilege('nano_lifecycle_auditoria','nano_lifecycle_interno.nano_lifecycle_travar_conferencia(uuid,uuid)','execute');"),"f");
 assert.equal(admin("select rolcanlogin or rolbypassrls or rolsuper from pg_roles where rolname='nano_lifecycle_gate_travas';"),"f");
 // Confirma que o papel de lock não consegue modificar linhas, mesmo com GRANT UPDATE.
 assert.equal(admin("select has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.fontes_documentais','update') or has_table_privilege('nano_lifecycle_gate_travas','nano_lifecycle_interno.auditoria_escopos','update');"),"f");
 // Revisão pós-auditoria: concorrência inversa com o gate real em transação aberta.
 const recibosFiltro=" where loja_id='"+L+"'";
 const recibosAntes=admin("select jsonb_agg(to_jsonb(c) order by solicitacao)::text from nano_lifecycle_interno.conferencias_gate c"+recibosFiltro);
 const req76="fb300000-0000-0000-0000-000000000076";
 const chamadaGate76=id=>"select nano_lifecycle_interno.nano_lifecycle_registrar_conferencia("+[...v,JSON.stringify(candidato),r.id,hash,id].map(lit).join(",")+")->>'estado';";
 const gate76=spawn("psql",args("nano_e2e_auditor"),{env:env(passwords.nano_e2e_auditor),stdio:["pipe","pipe","pipe"]});
 const rl76=createInterface({input:gate76.stdout});
 gate76.stderr.resume();
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("gate inverso não iniciou")),10000);
   const linhas=[];
   gate76.once("error",e=>{clearTimeout(timer);reject(e);});
   gate76.once("exit",()=>{clearTimeout(timer);reject(Error("gate inverso encerrou"));});
   rl76.on("line",linha=>{
    if(linha==="__NANO_GATE_76__"){clearTimeout(timer);if(!linhas.includes("registrada"))reject(Error("gate inverso não registrou"));else resolve();}
    else linhas.push(linha);
   });
   gate76.stdin.write("set role nano_lifecycle_auditoria;\nbegin isolation level read committed;\n"+chamadaGate76(req76)+"\n\\echo __NANO_GATE_76__\n");
  });
  assert.equal((await registrar(audit,candidato,req76)).estado,"ocupada");
  assert.equal((await registrar(audit,candidato,deniedRequest)).estado,"ocupada");
  // O gate e o despachante compartilham exatamente a mesma exclusão por loja.
  const despacho78=(loja,item)=>admin("set role service_role; select public.nano_lifecycle_encaminhar('"+loja+"','sync_0002',(select idempotency_key from public.pipeline_itens where id='"+item+"'))->>'estado';");
  assert.equal(despacho78(L,I),"ocupado");
  assert.equal(despacho78(outra,I2),"ja_encaminhado");
  // SQLSTATE exato: não confundir rejeição de permissão com disputa do advisory lock.
  const mutacoes=[
   ["update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+L+"' and id='f' returning id;","update nano_lifecycle_interno.fontes_documentais set autorizada=false where loja_id='"+outra+"' and id='f' returning id;","f"],
   [atualizarAuto(P),atualizarAuto(P2),"t"],
   [updFila(filaId),updFila(filaId2),"fixture"],
   [toqueEspelho(P),toqueEspelho(P2),P2]
  ];
  for(const [mesma,distinta,marcador] of mutacoes){
   assert.throws(()=>admin("\\set VERBOSITY verbose\nbegin;\n"+mesma+"\nrollback;"),e=>e.stderr?.includes("55P03")===true&&e.stderr?.includes("escopo documental ocupado")===true);
   assert.equal(admin("begin;\n"+distinta+"\nrollback;"),marcador);
  }
  // A linha de recibo ainda não é visível a outra sessão antes do commit.
  assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"' and solicitacao='"+req76+"';"),"0");
 }finally{
  if(gate76.exitCode===null&&gate76.signalCode===null){
   await new Promise(resolve=>{const timer=setTimeout(()=>gate76.kill(),5000);gate76.once("exit",()=>{clearTimeout(timer);resolve();});gate76.stdin.end("rollback;\n");});
  }
  rl76.close();
 }
 // Sentido inverso: despacho legítimo mantém a exclusão até rollback.
 const retryDespacho78=loja=>"set local role service_role; select public.nano_lifecycle_encaminhar('"+loja+"','sync_0002',(select idempotency_key from public.pipeline_itens where id='"+(loja===L?I:I2)+"'))->>'estado'; reset role;";
 await testarEscritor("public.pipeline_itens",retryDespacho78(L),"ocupada","postgres","ja_encaminhado");
 await testarEscritor("public.pipeline_itens",retryDespacho78(outra),"ja_registrada","postgres","ja_encaminhado");
 // A liberação transacional permite DML legítimo e retry sem gravar o recibo abortado.
 assert.equal(admin("begin; "+atualizarAuto(P)+" rollback;"),"t");
 assert.equal((await registrar(audit,candidato,concorrente)).estado,"ja_registrada");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"' and solicitacao='"+req76+"';"),"0");
 // O mesmo login real de auditor deve receber retida em snapshots incompatíveis.
 for(const isolamento of ["repeatable read","serializable"]){
  const recusada=execFileSync("psql",args("nano_e2e_auditor"),{input:"set role nano_lifecycle_auditoria;\nbegin isolation level "+isolamento+";\n"+chamadaGate76(req76)+"\nrollback;",encoding:"utf8",timeout:15000,env:env(passwords.nano_e2e_auditor),stdio:["pipe","pipe","pipe"]}).trim();
  assert.equal(recusada,"retida");
 }
 // Imutabilidade do recibo, inclusive quando triggers ordinários seriam ignorados.
 for(const prefixo of ["","set local session_replication_role=replica; "]){
  for(const mutacao of ["update nano_lifecycle_interno.conferencias_gate set conferido_em=conferido_em+interval '1 second'"+recibosFiltro,"delete from nano_lifecycle_interno.conferencias_gate"+recibosFiltro,"truncate nano_lifecycle_interno.conferencias_gate"]){
   assert.throws(()=>admin("begin; "+prefixo+mutacao+"; rollback;"),e=>e.stderr?.includes("documento técnico histórico imutável")===true);
  }
 }
 assert.equal(admin("select jsonb_agg(to_jsonb(c) order by solicitacao)::text from nano_lifecycle_interno.conferencias_gate c"+recibosFiltro),recibosAntes);
 assert.equal(admin("select count(*) from pg_trigger where tgrelid='nano_lifecycle_interno.conferencias_gate'::regclass and tgname in ('nano_gate_imutavel','nano_gate_truncate') and tgenabled='A';"),"2");
 console.log("ok: gate inverso, SQLSTATE 55P03, outras lojas, rollback, isolamento e recibos imutáveis");
 console.log("ok: concorrência de solicitação, NOWAIT de escritores, ausência de DML");



 admin("update public.produto_automacao set pausado=true where produto_id='"+P+"';");
 assert.equal((await atual()).motivo,"evidencia_desatualizada_ou_indisponivel");
 assert.equal(await sqlGate(audit),false);
 admin("update public.produto_automacao set pausado=false where produto_id='"+P+"';");
 admin("update public.nano_lifecycle_checkpoint set consumo_habilitado=false where loja_id='"+L+"';");
 assert.equal((await atual()).motivo,"evidencia_desatualizada_ou_indisponivel");
 admin("update public.nano_lifecycle_checkpoint set consumo_habilitado=true where loja_id='"+L+"';");
 // A tentativa direta deve falhar: nem o administrador simula uma escrita fora do fence.
 assert.throws(()=>admin("update public.produtos set nome='Alteração posterior sintética' where id='"+P+"';"),e=>e.stderr?.includes("papel de escrita não autorizado")===true);
 assert.equal((await atual()).atualidade,"conferida_no_instante");
 // Nova sincronização legítima, usando as RPCs protegidas existentes.
 const sync="fa200000-0000-0000-0000-000000000003";
 const svc=sql=>admin("set role service_role;\n"+sql);
 const novaReserva=JSON.parse(svc("select public.nano_lifecycle_reservar('"+L+"','"+sync+"');"));
 assert.equal(novaReserva.estado,"reservado");assert.equal(novaReserva.geracao,3);
 assert.equal((await atual()).motivo,"evidencia_desatualizada_ou_indisponivel");
 // Reaproveita o lote sintético da captura original, preservando todos os campos.
 const linha=fixture.split("\n").find(x=>x.includes("public.nano_lifecycle_gravar_espelho("));
 const lote=JSON.parse(linha.match(/'(\[\{.*\}\])'::jsonb/)[1]);
 assert.equal(lote.length,1);assert.equal(lote[0].loja_id,L);
 lote[0].nome="Alteração posterior sintética";
 assert.equal(svc("select public.nano_lifecycle_gravar_espelho('"+L+"','"+sync+"',3,'"+JSON.stringify(lote).replaceAll("'","''")+"'::jsonb);"),"1");
 assert.equal(svc("select public.nano_lifecycle_encerrar_reserva('"+L+"','"+sync+"',3);"),"t");
 // Mesmo sem sync ativo, o espelho diverge do checkpoint anterior.
 assert.equal((await atual()).motivo,"evidencia_desatualizada_ou_indisponivel");
 assert.equal(admin("select nome from public.produtos where id='"+P+"';"),"Alteração posterior sintética");
 assert.equal(await sqlGate(audit),false);
 assert.equal((await conferir(candidato)).estado,"procedencia_conferida");
 assert.equal((await registrar(audit)).estado,"retida");
 assert.equal((await registrar(audit,candidato,deniedRequest)).estado,"retida");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"';"),"2");
 assert.equal(admin("select has_function_privilege('nano_lifecycle_produtor','nano_lifecycle_interno.nano_lifecycle_conferir_atualidade(uuid,uuid,uuid,bigint,integer,jsonb)','execute');"),"f");

 admin("update nano_lifecycle_interno.auditoria_escopos set habilitado=false where login_db='nano_e2e_parecer' and loja_id='"+L+"';");
 assert.equal((await conferir(candidato)).motivo,"verificador_nao_autorizado");
 assert.equal(admin("select count(*) from nano_lifecycle_interno.leituras_documentais where loja_id='"+L+"';"),"1");
 assert.equal(admin("select count(*) from public.pipeline_custos where loja_id='"+L+"';"),"0");
 assert.equal(admin("select estado||':'||versao||':'||resultado::text from public.pipeline_itens where id='"+I+"';"),"entrada:1:{}");
 console.log("ok: produtor, parecerista e auditor com sessões reais; integridade, revogação, zero transições e custos");
}finally{for(const s of sessions)s.close();}
