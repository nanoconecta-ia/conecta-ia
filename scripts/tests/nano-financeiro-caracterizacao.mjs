// Caracterização de riscos financeiros, somente no PostgreSQL descartável do CI.
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
  if(linha==="__NANO_FINANCEIRO_81__"){const p=pendente;pendente=null;clearTimeout(p.timer);p.resolve(p.linhas);}
  else if(linha.trim())pendente.linhas.push(linha);
 });
 const s={
  pid:null,conexao_ms:null,
  query(sql){
   assert.ok(!fechada&&!pendente,"sessão indisponível");
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();falha();},15000);
    pendente={resolve,reject,timer,linhas:[]};
    child.stdin.write(sql+"\n\\echo __NANO_FINANCEIRO_81__\n");
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

const A="f8100000-0000-0000-0000-000000000001",B="f8100000-0000-0000-0000-000000000002";
const ids="'"+A+"','"+B+"'";
const mes="date_trunc('month',now())::date";
async function one(s,q){const rows=await s.query(q);assert.equal(rows.length,1);return rows[0];}
async function estado(s,loja){return JSON.parse(await one(s,"select public.pipeline_orcamento_estado('"+loja+"');"));}
const reservar=loja=>"select coalesce(public.pipeline_custo_tentar('"+loja+"',null,'pesquisador','api','fixture-fin-81',0.03)::text,'recusado');";
const total=s=>one(s,"select count(*) from public.pipeline_custos where loja_id in ("+ids+");");
const lojas=s=>one(s,"select count(*) from public.lojas where id in ("+ids+");");
const orcamentos=s=>one(s,"select count(*) from public.pipeline_orcamentos where loja_id in ("+ids+");");
const emitir=(controle,dados)=>console.log(JSON.stringify({teste:"nano-financeiro",controle,...dados}));
let admin,fixtureCriada=false;
try{
 admin=await conectar("postgres");
 assert.equal(await lojas(admin),"0");assert.equal(await total(admin),"0");assert.equal(await orcamentos(admin),"0");
 // Fixtures precisam estar visíveis entre sessões. Somente IDs exclusivos, sem API ou dinheiro real.
 await admin.query("begin; insert into public.lojas(id,nome,slug) values ('"+A+"','FIN 81 A','nano-fin-81-a'),('"+B+"','FIN 81 B','nano-fin-81-b'); insert into public.pipeline_orcamentos(loja_id,mes,limite_usd) values ('"+A+"',"+mes+",0.05),('"+B+"',"+mes+",0.05); commit;");
 fixtureCriada=true;
 const a=await conectar("service_role"), b=await conectar("service_role"), outra=await conectar("service_role");
 const titular=await conectar("postgres");
 // FIN-01/04/05: caracterização em uma única transação reversível, papel real.
 await a.query("begin;");
 try{
  const id=await one(a,reservar(A));assert.match(id,/^\d+$/);
  await a.query("select public.pipeline_custo_confirmar('"+A+"',"+id+",0.06,1,0,0,1);");
  const est=await estado(a,A);assert.deepEqual(est,{limite_usd:0.05,gasto_usd:0.06,restante_usd:-0.01});
  assert.equal(await one(a,reservar(A)),"recusado");
  assert.deepEqual(await estado(a,B),{limite_usd:0.05,gasto_usd:0,restante_usd:0.05});
  assert.equal(await one(a,"select count(*) from public.pipeline_custos where loja_id='"+A+"' and id="+id+" and estado='confirmado' and usd=0.06;"),"1");
  await a.query("do $$ begin begin perform public.pipeline_custo_confirmar('"+A+"',"+id+",0.01,1,0,0,1); raise exception 'confirmacao duplicada aceita'; exception when sqlstate 'P0002' then null; end; end $$;");
  await a.query("do $$ begin begin perform public.pipeline_custo_confirmar('"+B+"',"+id+",0.01,1,0,0,1); raise exception 'confirmacao cruzada aceita'; exception when sqlstate 'P0002' then null; end; end $$;");
  emitir("FIN-01",{resultado:"risco_reproduzido",reserva_usd:0.03,...est,nova_reserva:"recusada",confirmacao_duplicada:"recusada",confirmacao_cruzada:"recusada"});
 }finally{await a.query("rollback;");}
 assert.equal(await total(admin),"0");
 // FIN-02: alteração direta do teto ignora advisory usado por reserva. A trava permanece no titular.
 await titular.query("begin; select pg_advisory_xact_lock(hashtextextended('pipeline_orcamento:'||'"+A+"'::uuid::text||("+mes+")::text,0));");
 try{
  await a.query("begin; set local lock_timeout='500ms';");
  try{
   const alterado=await one(a,"update public.pipeline_orcamentos set limite_usd=0.01 where loja_id='"+A+"' and mes="+mes+" returning limite_usd;");
   assert.equal(Number(alterado),0.01);
   // DML direto do razão sem chamada de reserva.
   const valor=await one(a,"insert into public.pipeline_custos(loja_id,capacidade,tipo,fonte,usd) values ('"+A+"','pesquisador','api','fixture-fin-81-direto',0.02) returning usd;");
   assert.equal(Number(valor),0.02);
   const est=await estado(a,A);assert.deepEqual(est,{limite_usd:0.01,gasto_usd:0.02,restante_usd:-0.01});
   emitir("FIN-02",{resultado:"risco_reproduzido",advisory_em_outra_sessao:true,...est});
  }finally{await a.query("rollback;");}
 }finally{await titular.query("rollback;");}
 assert.equal(await total(admin),"0");assert.deepEqual(await estado(admin,A),{limite_usd:0.05,gasto_usd:0,restante_usd:0.05});
 // FIN-03/04: primeiro reserva e mantém transação. Segundo aguarda o lock; outra loja opera.
 await a.query("begin;");const idA=await one(a,reservar(A));assert.match(idA,/^\d+$/);
 const pendente=one(b,reservar(A)).then(valor=>({valor}),erro=>({erro}));
 let bloqueio=false,idB;
 try{
  const ate=performance.now()+2000;
  do{
   bloqueio=await one(admin,"select "+a.pid+"=any(pg_blocking_pids("+b.pid+"));")==="t";
   if(!bloqueio)await sleep(10);
  }while(!bloqueio&&performance.now()<ate);
  assert.ok(bloqueio,"disputa real de reserva não observada");
  idB=await one(outra,reservar(B));assert.match(idB,/^\d+$/);
  assert.equal(await one(admin,"select "+a.pid+"=any(pg_blocking_pids("+b.pid+"));"),"t");
  await a.query("commit;");
 }catch(e){await a.query("rollback;");await pendente;throw e;}
 const segunda=await pendente;if(segunda.erro)throw segunda.erro;
 assert.equal(segunda.valor,"recusado");
 assert.notEqual(idA,idB);assert.equal(await total(admin),"2");
 for(const l of [A,B])assert.deepEqual(await estado(admin,l),{limite_usd:0.05,gasto_usd:0.03,restante_usd:0.02});
 emitir("FIN-03/04",{resultado:"controle_aprovado",espera_real:true,mesma_loja:"segunda_recusada",outra_loja:"reserva_aceita",reservas:2});
 // FIN-05: identidade, estado e valores das reservas; sem acesso de escrita de usuários finais.
 assert.equal(await one(admin,"select count(*) from public.pipeline_custos where loja_id in ("+ids+") and estado='reservado' and usd=0.03 and chamadas=0 and tokens_in=0 and tokens_out=0;"),"2");
 for(const papel of ["anon","authenticated"]){
  assert.equal(await one(admin,"select has_table_privilege('"+papel+"','public.pipeline_custos','INSERT,UPDATE,DELETE') or has_table_privilege('"+papel+"','public.pipeline_orcamentos','INSERT,UPDATE,DELETE');"),"f");
  assert.equal(await one(admin,"select has_function_privilege('"+papel+"','public.pipeline_custo_tentar(uuid,uuid,text,text,text,numeric)','EXECUTE');"),"f");
 }
 emitir("FIN-05",{resultado:"controles_aprovados",reservas_preservadas:2,usuarios_finais_sem_escrita:true});
}finally{
 // Fecha sessões de trabalho antes de remover APENAS fixtures próprias.
 await Promise.allSettled(sessoes.filter(s=>s!==admin).map(s=>s.close()));
 try{
  if(fixtureCriada){
   await admin.query("begin; delete from public.pipeline_custos where loja_id in ("+ids+"); delete from public.pipeline_orcamentos where loja_id in ("+ids+"); delete from public.lojas where id in ("+ids+"); commit;");
   assert.equal(await total(admin),"0");assert.equal(await orcamentos(admin),"0");assert.equal(await lojas(admin),"0");
   emitir("FIN-06",{resultado:"limpeza_aprovada",lojas:0,orcamentos:0,custos:0,nota:"rollback nos casos de risco; limpeza transacional de fixtures comprometidas para prova concorrente; sequências podem avançar no banco descartável"});
  }
 }finally{if(admin)await admin.close();}
}
console.log("ok: caracterização financeira FIN-01/02, concorrência e isolamento FIN-03/04, controles FIN-05 e limpeza FIN-06; sem execução externa");
