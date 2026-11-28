// Concorrência da autoridade financeira, somente no PostgreSQL descartável do CI.
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
  if(linha==="__NANO_FINANCEIRO_85__"){const p=pendente;pendente=null;clearTimeout(p.timer);p.resolve(p.linhas);}
  else if(linha.trim())pendente.linhas.push(linha);
 });
 const s={
  pid:null,conexao_ms:null,
  query(sql){
   assert.ok(!fechada&&!pendente,"sessão indisponível");
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();falha();},15000);
    pendente={resolve,reject,timer,linhas:[]};
    child.stdin.write(sql+"\n\\echo __NANO_FINANCEIRO_85__\n");
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


const A="f8500000-0000-0000-0000-000000000001", B="f8500000-0000-0000-0000-000000000002";
const ids="'"+A+"','"+B+"'", mes="date_trunc('month',now())::date";
async function one(s,q){const rows=await s.query(q);assert.equal(rows.length,1,q);return rows[0];}
const reservar=(l,v)=>"select coalesce(public.pipeline_custo_tentar('"+l+"',null,'pesquisador','api','fixture-fin-85',"+v+")::text,'recusado');";
const confirmar=(l,id,v)=>"select public.pipeline_custo_confirmar('"+l+"',"+id+","+v+",1,0,0,1);";
const estado=async(s,l)=>JSON.parse(await one(s,"select public.pipeline_orcamento_estado('"+l+"');"));
const contar=(s,t)=>one(s,"select count(*) from "+t+" where "+(t==="public.lojas"?"id":"loja_id")+" in ("+ids+");");
const tabelas=["nano_financeiro_interno.diario","public.pipeline_custos","public.pipeline_orcamentos","public.lojas"];
const emitir=(controle,dados)=>console.log(JSON.stringify({teste:"nano-financeiro-autoridade",controle,...dados}));
const iniciar=p=>p.then(valor=>({valor}),erro=>({erro}));
async function resultado(p){const r=await p;if(r.erro)throw r.erro;return r.valor;}
async function espera(admin,titular,concorrente){
 const ate=performance.now()+2500;
 do{
  if(await one(admin,"select "+titular.pid+"=any(pg_blocking_pids("+concorrente.pid+"));")==="t")return;
  await sleep(10);
 }while(performance.now()<ate);
 throw Error("bloqueio real não observado: "+concorrente.pid);
}
let admin,criada=false;
try{
 admin=await conectar("postgres");
 for(const t of tabelas)assert.equal(await contar(admin,t),"0");
 // Transações independentes exigem fixtures comprometidas, somente no banco descartável.
 await admin.query("begin; insert into public.lojas(id,nome,slug) values ('"+A+"','FIN 85 A','nano-fin-85-a'),('"+B+"','FIN 85 B','nano-fin-85-b'); insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('"+A+"',"+mes+",0.05),('"+B+"',"+mes+",0.05); commit;");
 criada=true;
 const a=await conectar("service_role"), b=await conectar("service_role"), c=await conectar("service_role"), outra=await conectar("service_role");
 assert.equal(await one(admin,"select pg_has_role('service_role','nano_financeiro_escritor','MEMBER');"),"f");
 // Duas reservas reais sob a nova autoridade, mesma loja/mês, com uma terceira loja livre.
 await a.query("begin;");
 const id=await one(a,reservar(A,0.03));assert.match(id,/^\d+$/);
 const p1=iniciar(one(b,reservar(A,0.03)));
 let idB;
 try{
  await espera(admin,a,b);
  idB=await one(outra,reservar(B,0.03));assert.match(idB,/^\d+$/);
  await espera(admin,a,b);
  await a.query("commit;");
 }catch(e){await a.query("rollback;");await p1;throw e;}
 assert.equal(await resultado(p1),"recusado");
 assert.notEqual(id,idB);
 assert.deepEqual(await estado(admin,A),{limite_usd:0.05,gasto_usd:0.03,restante_usd:0.02});
 assert.equal(await contar(admin,"nano_financeiro_interno.diario"),"2");
 emitir("FIN-85-01",{resultado:"aprovado",espera_real:true,segunda_reserva:"recusada",outra_loja:"livre"});
 // Uma confirmação em aberto disputa com outra confirmação do mesmo ID e uma nova reserva.
 await a.query("begin;");
 await a.query(confirmar(A,id,0.06));
 const duplicada="do $fin$ begin begin perform public.pipeline_custo_confirmar('"+A+"',"+id+",0.01,1,0,0,1); raise exception 'duplicidade aceita'; exception when sqlstate 'P0002' then null; end; end $fin$; select 'duplicada_recusada';";
 const p2=iniciar(one(b,duplicada));
 const p3=iniciar(one(c,reservar(A,0.01)));
 try{
  await espera(admin,a,b);
  // PostgreSQL pode formar fila de espera atrás de b; prova que c aguarda o mesmo lock.
  const ate=performance.now()+2500;
  let bloqueada=false;
  do{
   bloqueada=await one(admin,"select cardinality(pg_blocking_pids("+c.pid+"))>0;")==="t";
   if(!bloqueada)await sleep(10);
  }while(!bloqueada&&performance.now()<ate);
  assert.ok(bloqueada,"reserva não disputou confirmação");
  const livre=await one(outra,reservar(B,0.01));assert.match(livre,/^\d+$/);
  await a.query("commit;");
 }catch(e){await a.query("rollback;");await Promise.all([p2,p3]);throw e;}
 assert.equal(await resultado(p2),"duplicada_recusada");
 assert.equal(await resultado(p3),"recusado");
 assert.deepEqual(await estado(admin,A),{limite_usd:0.05,gasto_usd:0.06,restante_usd:-0.01});
 assert.deepEqual(await estado(admin,B),{limite_usd:0.05,gasto_usd:0.04,restante_usd:0.01});
 assert.equal(await one(b,reservar(A,0)),"recusado");
 assert.equal(await one(admin,"select count(*) from public.pipeline_custos where loja_id='"+A+"' and id="+id+" and estado='confirmado' and usd=0.06;"),"1");
 assert.equal(await one(admin,"select count(*) from nano_financeiro_interno.diario where custo_id="+id+" and loja_id='"+A+"' and evento='confirmacao' and reservado_usd=0.03 and real_usd=0.06 and limite_usd=0.05 and saldo_usd=-0.01;"),"1");
 assert.equal(await one(admin,"select count(*) from nano_financeiro_interno.diario where custo_id="+id+" and evento='reserva' and reservado_usd=0.03;"),"1");
 assert.equal(await contar(admin,"public.pipeline_custos"),"3");
 assert.equal(await contar(admin,"nano_financeiro_interno.diario"),"4");
 emitir("FIN-85-02/03",{resultado:"aprovado",esperas_reais:true,confirmacao_duplicada:"recusada",reserva_durante_confirmacao:"recusada",saldo_usd:-0.01,outra_loja:"livre",custos:3,eventos:4});
}finally{
 await Promise.allSettled(sessoes.filter(s=>s!==admin).map(s=>s.close()));
 try{
  if(criada){
   // Limpeza administrativa exclusivamente de fixtures próprias: diário primeiro por FK RESTRICT.
   await admin.query("begin; "+tabelas.map(t=>"delete from "+t+" where "+(t==="public.lojas"?"id":"loja_id")+" in ("+ids+");").join(" ")+" commit;");
   for(const t of tabelas)assert.equal(await contar(admin,t),"0");
   emitir("FIN-85-04",{resultado:"limpeza_aprovada",lojas:0,orcamentos:0,custos:0,diario:0});
  }
 }finally{if(admin)await admin.close();}
}
console.log("ok: concorrência da autoridade financeira, diário e isolamento; somente CI descartável");
