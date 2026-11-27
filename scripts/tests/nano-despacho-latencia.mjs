// Instrumentação somente no banco descartável do CI. Não redefine funções nem altera permissões.
import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {performance} from "node:perf_hooks";
import {setTimeout as sleep} from "node:timers/promises";
import assert from "node:assert/strict";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const [L,K,L2,K2]=process.argv.slice(2);
for(const id of [L,L2])assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
for(const k of [K,K2])assert.match(k,/^nano-lifecycle:[0-9a-f]{64}$/);
assert.notEqual(L,L2);assert.notEqual(K,K2);
const args=["-XqAtw","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1"];
const env={PATH:process.env.PATH,PGPASSWORD:process.env.PGPASSWORD??"postgres",PGCONNECT_TIMEOUT:"5"};
const sessoes=[];
function sessao(){
 const inicio=performance.now(), child=spawn("psql",args,{env,stdio:["pipe","pipe","pipe"]});
 const rl=createInterface({input:child.stdout});let pendente=null,fechada=false,stderr="";
 child.stderr.on("data",b=>{stderr=(stderr+b.toString()).slice(-4000);});
 const falha=()=>{fechada=true;if(pendente){const p=pendente;pendente=null;clearTimeout(p.timer);p.reject(Error("sessão SQL encerrou: "+stderr));}};
 child.on("error",falha);child.on("exit",falha);child.stdin.on("error",falha);
 rl.on("line",linha=>{
  if(!pendente)return;
  if(linha==="__NANO_LATENCIA_79__"){const p=pendente;pendente=null;clearTimeout(p.timer);p.resolve(p.linhas);}
  else if(linha.trim())pendente.linhas.push(linha);
 });
 const s={
  pid:null,conexao_ms:null,
  query(sql){
   assert.ok(!fechada&&!pendente,"sessão indisponível");
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();falha();},15000);
    pendente={resolve,reject,timer,linhas:[]};
    child.stdin.write(sql+"\n\\echo __NANO_LATENCIA_79__\n");
   });
  },
  async close(){
   if(!fechada&&child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{
    const timer=setTimeout(()=>child.kill(),3000);
    child.once("exit",()=>{clearTimeout(timer);resolve();});
    child.stdin.end();
   });
   rl.close();
  },
  inicio
 };
 sessoes.push(s);return s;
}
async function conectar(role){
 const s=sessao();
 const [pid]=await s.query("select pg_backend_pid();");
 s.pid=Number(pid);assert.ok(Number.isSafeInteger(s.pid)&&s.pid>0);
 s.conexao_ms=performance.now()-s.inicio;
 await s.query("set statement_timeout='10s'; set lock_timeout='5s';"+(role==="service_role"?" set role service_role;":""));
 return s;
}
const arred=v=>Number(v.toFixed(3));
const resumo=valores=>{
 const s=[...valores].sort((a,b)=>a-b);assert.ok(s.length&&s.every(v=>Number.isFinite(v)&&v>=0));
 const q=p=>arred(s[Math.ceil(p*s.length)-1]);
 return {p50:q(.5),p95:q(.95),p99:q(.99),max:arred(s.at(-1))};
};
async function rpc(s,loja,chave){
 const inicio=performance.now();
 // Materialização e dependência preservam a ordem: timestamp inicial -> RPC real -> timestamp final.
 const linhas=await s.query("with inicio as materialized (select clock_timestamp() t), chamada as materialized (select t,public.nano_lifecycle_encaminhar('"+loja+"','sync_0002','"+chave+"') r from inicio) select jsonb_build_object('estado',r->>'estado','rpc_ms',extract(epoch from(clock_timestamp()-t))*1000) from chamada;");
 assert.equal(linhas.length,1);
 const r=JSON.parse(linhas[0]);assert.ok(Number.isFinite(r.rpc_ms)&&r.rpc_ms>=0);
 return {...r,cliente_ms:performance.now()-inicio};
}
async function json(s,sql){const linhas=await s.query(sql);assert.equal(linhas.length,1);return JSON.parse(linhas[0]);}
const estadoOk="ja_encaminhado";
try{
 const observador=await conectar("postgres"), titular=await conectar("postgres"), a=await conectar("service_role"), b=await conectar("service_role");
 const antes=await json(observador,"select jsonb_build_object('tarefas',(select jsonb_agg(to_jsonb(i) order by id) from public.pipeline_itens i where loja_id in ('"+L+"','"+L2+"')),'historico',(select jsonb_agg(to_jsonb(h) order by id) from public.pipeline_historico h where loja_id in ('"+L+"','"+L2+"')),'custos',(select count(*) from public.pipeline_custos where loja_id in ('"+L+"','"+L2+"')));");
 assert.equal(antes.tarefas.length,2);assert.equal(antes.historico.length,2);assert.equal(antes.custos,0);
 // Controle positivo: titular bloqueia apenas a linha do checkpoint de L.
 await titular.query("begin; select loja_id from public.nano_lifecycle_checkpoint where loja_id='"+L+"' for update;");
 const pendente=rpc(a,L,K).then(resultado=>({resultado}),erro=>({erro}));
 const espera=()=>json(observador,"select jsonb_build_object('bloqueado',"+titular.pid+"=any(pg_blocking_pids("+a.pid+")),'evento',(select wait_event from pg_stat_activity where pid="+a.pid+"),'tipo',(select wait_event_type from pg_stat_activity where pid="+a.pid+"),'espera_observada_ms',(select max(extract(epoch from(clock_timestamp()-waitstart))*1000) from pg_locks where pid="+a.pid+" and not granted and waitstart is not null));");
 let primeira,ultima,independente;
 try{
  const limite=performance.now()+2000;
  do{primeira=await espera();if(primeira.bloqueado&&primeira.tipo==="Lock"&&primeira.espera_observada_ms!==null)break;await sleep(10);}while(performance.now()<limite);
  assert.ok(primeira.bloqueado&&primeira.tipo==="Lock"&&primeira.espera_observada_ms!==null,"espera real do checkpoint não observada");
  independente=await rpc(b,L2,K2);assert.equal(independente.estado,estadoOk);
  ultima=await espera();assert.ok(ultima.bloqueado&&ultima.tipo==="Lock"&&ultima.espera_observada_ms!==null);
 }finally{await titular.query("rollback;");}
 const desbloqueado=await pendente;if(desbloqueado.erro)throw desbloqueado.erro;
 assert.equal(desbloqueado.resultado.estado,estadoOk);
 console.log(JSON.stringify({benchmark:"nano-despacho-latencia",cenario:"checkpoint_controlado",evento:ultima.evento,espera_minima_observada_ms:arred(ultima.espera_observada_ms),rpc_bloqueada_ms:arred(desbloqueado.resultado.rpc_ms),rpc_outra_loja_ms:arred(independente.rpc_ms),metodo:"pg_blocking_pids + pg_locks.waitstart; limite inferior, não decomposição exata"}));
 // Exclusão advisory controlada sem manter linha do checkpoint.
 await titular.query("begin; select pg_advisory_xact_lock(hashtextextended('nano.gate.documental:"+L+"',0));");
 try{
  const negada=await rpc(a,L,K),livre=await rpc(b,L2,K2);
  assert.equal(negada.estado,"ocupado");assert.equal(livre.estado,estadoOk);
  console.log(JSON.stringify({benchmark:"nano-despacho-latencia",cenario:"advisory_controlado",rpc_recusa_ms:arred(negada.rpc_ms),rpc_outra_loja_ms:arred(livre.rpc_ms),metodo:"RPC sob advisory ocupado; não mede isoladamente pg_try_advisory_xact_lock"}));
 }finally{await titular.query("rollback;");}
 for(const clientes of [1,2,4,8]){
  const conexoes=await Promise.all(Array.from({length:clientes},()=>conectar("service_role")));
  try{
   const totalRpc=[],totalCliente=[],totalEstados={ja_encaminhado:0,ocupado:0};let tempoTotal=0;
   for(let repeticao=1;repeticao<=3;repeticao++){
    const n=48,amostras=[];let cursor=0;
    const inicio=performance.now();
    await Promise.all(conexoes.map(async s=>{
     while(cursor<n){const i=cursor++;amostras.push(await rpc(s,i%2?L2:L,i%2?K2:K));}
    }));
    const tempo=performance.now()-inicio;tempoTotal+=tempo;assert.equal(amostras.length,n);
    const estados={ja_encaminhado:0,ocupado:0};
    for(const r of amostras){assert.ok(Object.hasOwn(estados,r.estado),"estado inesperado "+r.estado);estados[r.estado]++;totalEstados[r.estado]++;totalRpc.push(r.rpc_ms);totalCliente.push(r.cliente_ms);}
    console.log(JSON.stringify({benchmark:"nano-despacho-latencia",cenario:"persistente",clientes,repeticao,amostras:n,rpc_ms:resumo(amostras.map(r=>r.rpc_ms)),cliente_ms:resumo(amostras.map(r=>r.cliente_ms)),sucessos_s:arred(estados.ja_encaminhado*1000/tempo),estados}));
   }
   assert.equal(totalRpc.length,144);
   console.log(JSON.stringify({benchmark:"nano-despacho-latencia",cenario:"agregado",clientes,amostras:144,conexao_psql_ms:resumo(conexoes.map(s=>s.conexao_ms)),rpc_ms:resumo(totalRpc),cliente_ms:resumo(totalCliente),sucessos_s:arred(totalEstados.ja_encaminhado*1000/tempoTotal),recusas_pct:arred(100*totalEstados.ocupado/144),estados:totalEstados}));
  }finally{await Promise.all(conexoes.map(s=>s.close()));}
 }
 const depois=await json(observador,"select jsonb_build_object('tarefas',(select jsonb_agg(to_jsonb(i) order by id) from public.pipeline_itens i where loja_id in ('"+L+"','"+L2+"')),'historico',(select jsonb_agg(to_jsonb(h) order by id) from public.pipeline_historico h where loja_id in ('"+L+"','"+L2+"')),'custos',(select count(*) from public.pipeline_custos where loja_id in ('"+L+"','"+L2+"')));");
 assert.deepEqual(depois,antes);
 console.log("ok: latência RPC, conexão separada, checkpoint observado, advisory controlado, 576 retries e estado íntegro");
}finally{await Promise.allSettled(sessoes.map(s=>s.close()));}
