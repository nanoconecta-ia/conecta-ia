// Concorrência do teto financeiro, somente no PostgreSQL descartável do CI.
import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {performance} from "node:perf_hooks";
import {setTimeout as sleep} from "node:timers/promises";
import assert from "node:assert/strict";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
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
  if(linha==="__NANO_FINANCEIRO_86__"){const p=pendente;pendente=null;clearTimeout(p.timer);p.resolve(p.linhas);}
  else if(linha.trim())pendente.linhas.push(linha);
 });
 const s={
  pid:null,conexao_ms:null,
  query(sql){
   assert.ok(!fechada&&!pendente,"sessão indisponível");
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();falha();},15000);
    pendente={resolve,reject,timer,linhas:[]};
    child.stdin.write(sql+"\n\\echo __NANO_FINANCEIRO_86__\n");
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
 await s.query("set statement_timeout='10s'; set lock_timeout='5s';"+(role==="postgres"?"":" set role "+role+";"));
 return s;
}



const A="f8600000-0000-0000-0000-000000000003",B="f8600000-0000-0000-0000-000000000004", ids="'"+A+"','"+B+"'",mes="date_trunc('month',now())::date";
const teto=(l,v)=>"select nano_financeiro_interno.definir_teto('"+l+"',"+mes+","+v+",'fixture FIN 86');";
const reserva=(l,v)=>"select coalesce(public.pipeline_custo_tentar('"+l+"',null,'pesquisador','api','fixture-fin-86',"+v+")::text,'recusado');";
async function one(s,q){const rows=await s.query(q);assert.equal(rows.length,1,q);return rows[0];}
const tabs=["nano_financeiro_interno.diario","nano_financeiro_interno.diario_orcamento","public.pipeline_custos","public.pipeline_orcamentos","public.lojas"];
const filtro=t=>(t==="public.lojas"?"id":"loja_id")+" in ("+ids+")";
let admin,criada=false;
try{
 admin=await conectar("postgres");
 for(const t of tabs)assert.equal(await one(admin,"select count(*) from "+t+" where "+filtro(t)+";"),"0");
 await admin.query("insert into public.lojas(id,nome,slug) values ('"+A+"','FIN 86 C','nano-fin-86-c'),('"+B+"','FIN 86 D','nano-fin-86-d');");
 criada=true;
 const operador=await conectar("nano_orcamento_operador"),agente=await conectar("service_role"),outra=await conectar("service_role");
 await operador.query(teto(A,0.05)+teto(B,0.05));
 await operador.query("begin;"+teto(A,0.02));
 const p=one(agente,reserva(A,0.03)).then(valor=>({valor}),erro=>({erro}));
 try{
  let espera=false;const ate=performance.now()+2500;
  do{
   espera=await one(admin,"select "+operador.pid+"=any(pg_blocking_pids("+agente.pid+"));")==="t";
   if(!espera)await sleep(10);
  }while(!espera&&performance.now()<ate);
  assert.ok(espera,"alteração de teto não compartilha trava");
  assert.match(await one(outra,reserva(B,0.03)),/^\d+$/);
  await operador.query("commit;");
 }catch(e){await operador.query("rollback;");await p;throw e;}
 const resultado=await p;if(resultado.erro)throw resultado.erro;assert.equal(resultado.valor,"recusado");
 assert.equal(await one(admin,"select count(*) from nano_financeiro_interno.diario_orcamento where loja_id='"+A+"' and anterior_usd=0.05 and novo_usd=0.02;"),"1");
 assert.equal(await one(admin,"select count(*) from public.pipeline_custos where loja_id='"+A+"';"),"0");
 console.log(JSON.stringify({controle:"FIN-86-05",resultado:"aprovado",espera_real:true,reserva_recusada:true,outra_loja:"livre"}));
}finally{
 await Promise.allSettled(sessoes.filter(s=>s!==admin).map(s=>s.close()));
 try{
  if(criada){
   await admin.query("begin; "+tabs.map(t=>"delete from "+t+" where "+filtro(t)+";").join(" ")+" commit;");
   for(const t of tabs)assert.equal(await one(admin,"select count(*) from "+t+" where "+filtro(t)+";"),"0");
   console.log("FIN-86-06: limpeza integral de fixtures");
  }
 }finally{if(admin)await admin.close();}
}
