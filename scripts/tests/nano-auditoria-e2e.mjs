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
 assert.equal(admin("select count(*) from pg_trigger where tgname in ('zz_nano_guard_documental_loja','zz_nano_guard_documental_truncate') and tgenabled='A';"),"8");
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
