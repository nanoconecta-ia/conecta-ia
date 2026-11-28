// Benchmark comparável pós-isolamento: PostgreSQL local descartável.
import {execFile,spawn} from "node:child_process";
import {promisify} from "node:util";
import {createInterface} from "node:readline";
import {performance} from "node:perf_hooks";
import assert from "node:assert/strict";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const [L,P,K,L2,P2,K2]=process.argv.slice(2);
for(const id of [L,P,L2,P2])assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
for(const k of [K,K2])assert.match(k,/^nano-lifecycle:[0-9a-f]{64}$/);
assert.notEqual(L,L2);assert.notEqual(P,P2);assert.notEqual(K,K2);
const args=["-XqAtw","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1"];
const env={PATH:process.env.PATH,PGPASSWORD:process.env.PGPASSWORD??"postgres",PGCONNECT_TIMEOUT:"5"};
const run=promisify(execFile);
async function sql(s){return (await run("psql",[...args,"-c","set statement_timeout='10s'; set lock_timeout='5s';","-c",s],{env,timeout:15000,maxBuffer:262144})).stdout.trim();}
async function despacho(loja,chave){return sql("set role service_role; select public.nano_lifecycle_encaminhar('"+loja+"','sync_0002','"+chave+"')->>'estado';");}
async function escritor(mutacao,marcador,fn){
 const w=spawn("psql",args,{env,stdio:["pipe","pipe","pipe"]});
 const rl=createInterface({input:w.stdout});w.stderr.resume();w.stdin.on("error",()=>{});
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("escritor sem confirmação")),10000);
   const linhas=[];
   w.once("error",e=>{clearTimeout(timer);reject(e);});
   w.once("exit",()=>{clearTimeout(timer);reject(Error("escritor encerrou antes da prova"));});
   rl.on("line",l=>{if(l==="__NANO_BENCH_WRITER__"){clearTimeout(timer);if(linhas.includes(marcador))resolve();else reject(Error("DML sem retorno esperado"));}else linhas.push(l);});
   w.stdin.write("begin; set local statement_timeout='10s'; set local role service_role;\n"+mutacao+"\n\\echo __NANO_BENCH_WRITER__\n");
  });
  await fn();
 }finally{
  if(w.exitCode===null&&w.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>w.kill(),5000);w.once("exit",()=>{clearTimeout(timer);resolve();});w.stdin.end("rollback;\n");});
  rl.close();
 }
}
const counts=loja=>sql("select count(*) from public.pipeline_itens where loja_id='"+loja+"';");
assert.equal(await counts(L),"1");assert.equal(await counts(L2),"0");
const baselineBefore=await sql("select to_jsonb(a)::text from public.produto_automacao a where produto_id='"+P+"';");
const fila="e7300000-0000-0000-0000-000000000077";
for(const [label,mutation,marker] of [
 ["automacao","update public.produto_automacao set pausado=true where produto_id='"+P+"' returning produto_id;",P],
 ["fila_legada","insert into public.pipeline_itens(id,loja_id,sku,idempotency_key) values('"+fila+"','"+L+"','BENCH-LEGADO-77','bench-legado-77') returning id;",fila]
]){
 await escritor(mutation,marker,async()=>{
  // A primeira contenção testa criação nova em L2; a segunda, retry em L2.
  assert.equal(await despacho(L,K),"ocupado");
  assert.equal(await despacho(L2,K2),label==="automacao"?"encaminhado":"ja_encaminhado");
 });
 assert.equal(await counts(L),"1");assert.equal(await counts(L2),"1");
 console.log(JSON.stringify({benchmark:"nano-despacho",cenario:"contencao_"+label,mesma_loja:"ocupado",outra_loja:label==="automacao"?"encaminhado":"ja_encaminhado",rollback:true}));
}
assert.equal(await sql("select to_jsonb(a)::text from public.produto_automacao a where produto_id='"+P+"';"),baselineBefore);
assert.equal(await sql("select count(*) from public.pipeline_itens where id='"+fila+"';"),"0");
assert.equal(await despacho(L2,K2),"ja_encaminhado");
assert.equal(await despacho(L,K),"ja_encaminhado");
assert.equal(await despacho(L2,K2),"ja_encaminhado");
const quantil=(s,p)=>s[Math.ceil(s.length*p)-1];
for(const clientes of [1,4]){
 const n=24,amostras=[],estados={ja_encaminhado:0,ocupado:0};
 const inicio=performance.now();
 let cursor=0;
 async function cliente(){
  while(cursor<n){
   const i=cursor++,start=performance.now();
   const estado=await despacho(i%2?L2:L,i%2?K2:K);
   amostras.push(performance.now()-start);
   assert.ok(Object.hasOwn(estados,estado),"estado inesperado: "+estado);
   estados[estado]++;
  }
 }
 await Promise.all(Array.from({length:clientes},()=>cliente()));
 const total=performance.now()-inicio;
 amostras.sort((a,b)=>a-b);
 assert.equal(amostras.length,n);
 console.log(JSON.stringify({benchmark:"nano-despacho",cenario:"retry_duas_lojas",clientes,amostras:n,latencia_p50_ms:Number(quantil(amostras,.5).toFixed(2)),latencia_p95_ms:Number(quantil(amostras,.95).toFixed(2)),tentativas_s:Number((n*1000/total).toFixed(2)),sucessos_s:Number((estados.ja_encaminhado*1000/total).toFixed(2)),recusas_pct:Number((100*estados.ocupado/n).toFixed(2)),estados,mede:"processo psql + conexao local + RPC"}));
}
for(const [loja,produto,chave] of [[L,P,K],[L2,P2,K2]]){
 assert.equal(await counts(loja),"1");
 const item=await sql("select id from public.pipeline_itens where loja_id='"+loja+"' and produto_id='"+produto+"' and idempotency_key='"+chave+"' and estado='entrada' and versao=1 and resultado='{}'::jsonb;");
 assert.match(item,/^[0-9a-f-]{36}$/);
 assert.equal(await sql("select count(*) from public.pipeline_historico where loja_id='"+loja+"' and item_id='"+item+"' and de is null and para='entrada';"),"1");
 assert.equal(await sql("select count(*) from public.pipeline_historico where loja_id='"+loja+"';"),"1");
 assert.equal(await sql("select count(*) from public.pipeline_custos where loja_id='"+loja+"';"),"0");
}
assert.equal(await sql("select position('lock table' in lower(pg_get_functiondef('nano_lifecycle_interno.nano_lifecycle_despachar(uuid,text,text)'::regprocedure)))=0;"),"t");
assert.equal(await sql("select has_table_privilege('nano_lifecycle_despachante','public.pipeline_itens','update') or has_table_privilege('nano_lifecycle_despachante','public.produto_automacao','update');"),"f");
for(const nivel of ["repeatable read","serializable"]){
 assert.equal(await sql("begin isolation level "+nivel+"; set local role service_role; select public.nano_lifecycle_encaminhar('"+L+"','sync_0002','"+K+"')->>'estado'; rollback;"),"ocupado");
}
console.log("ok: pós-isolamento duas lojas, nova tarefa, retry, contenção local, métricas e zero custos");
