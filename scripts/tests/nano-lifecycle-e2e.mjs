// Integração TS -> RPCs SQL reais em PostgreSQL 16 DESCARTÁVEL do CI.
// Não usa HTTP/PostgREST nem o Bling real. Nenhum acesso ao Supabase hospedado.
import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {criarPortaSupabase} from "../../supabase/functions/_shared/nano_lifecycle/porta_supabase.ts";
import {executarRodadaLifecycle} from "../../supabase/functions/_shared/nano_lifecycle/rodada_sync.ts";
import {sincronizarComReserva} from "../../supabase/functions/_shared/nano_lifecycle/sync_protegido.ts";

if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGPORT!=="5432"||process.env.PGUSER!=="postgres")throw Error("Somente banco descartável do CI");
function sql(q,role="service_role"){
 // Parâmetros explícitos: não herdar PGHOSTADDR, PGSERVICE ou outras opções de conexão.
 return execFileSync("psql",["-X","-qAt","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1","-c","set role "+role,"-c",q],{encoding:"utf8",timeout:15000,env:{PATH:process.env.PATH,PGPASSWORD:"postgres",PGCONNECT_TIMEOUT:"5"}}).trim();
}
const literal=v=>v===null?"null":typeof v==="number"&&Number.isSafeInteger(v)?String(v):"'"+(typeof v==="string"?v:JSON.stringify(v)).replaceAll("'","''")+"'";
const assinaturas={
 nano_lifecycle_reservar:[["p_loja","uuid"],["p_execucao","uuid"],["p_segundos","integer"]],
 nano_lifecycle_encerrar_reserva:[["p_loja","uuid"],["p_execucao","uuid"],["p_geracao","bigint"]],
 nano_lifecycle_ler:[["p_loja","uuid"],["p_tipo","text"],["p_revisao","text"]],
 nano_lifecycle_finalizar:[["p_loja","uuid"],["p_execucao","uuid"],["p_geracao","bigint"],["p_revisao","text"],["p_predecessor","text"],["p_estado","text"],["p_eventos","jsonb"],["p_bloqueios","jsonb"],["p_digest","text"],["p_produtos","jsonb"]],
 nano_lifecycle_gravar_tecnico:[["p_loja","uuid"],["p_execucao","uuid"],["p_geracao","bigint"],["p_linhas","jsonb"]],
 nano_lifecycle_gravar_espelho:[["p_loja","uuid"],["p_execucao","uuid"],["p_geracao","bigint"],["p_linhas","jsonb"]],
 nano_lifecycle_registrar_varredura:[["p_loja","uuid"],["p_execucao","uuid"],["p_geracao","bigint"],["p_grupos","jsonb"]]
};
const admin={async rpc(nome,args){
 const spec=Object.hasOwn(assinaturas,nome)?assinaturas[nome]:null;
 if(!spec||Object.keys(args).length!==spec.length||spec.some(([k])=>!Object.hasOwn(args,k)))throw Error("RPC fora do contrato");
 try{return {data:JSON.parse(sql("select coalesce(to_jsonb(public."+nome+"("+spec.map(([k,t])=>literal(args[k])+"::"+t).join(",")+")),'null'::jsonb)::text")),error:null}}
 catch(e){console.error("RPC de teste falhou:",nome,e.stderr?.toString().slice(0,500));return {data:null,error:"falha SQL"}}
}};
const loja=randomUUID(),pid=randomUUID(),outra=randomUUID();
const q=literal;
const linha=(nome,bling_id="123",sku="NANO-E2E-1")=>({loja_id:loja,bling_id,sku,nome,situacao:"A",categoria_bling_id:null,marca:null,gtin:null,descricao_curta:null,descricao_complementar:null,peso_kg:null,largura_cm:null,altura_cm:null,profundidade_cm:null,formato:null,pai_bling_id:null});
const r={paginas:3,vistos:1,gravados:1,detalhes:1,resumosExcluidos:0,ausentes:0,completo:true};
const executar=async(linhas,completo=true)=>{
 const porta=criarPortaSupabase(admin,async reserva=>{
  const ret=await admin.rpc("nano_lifecycle_gravar_tecnico",{p_loja:reserva.loja,p_execucao:reserva.execucao,p_geracao:reserva.geracao,p_linhas:linhas});
  assert.equal(ret.error,null);assert.equal(ret.data,linhas.length);
  if(completo){
   const v=await admin.rpc("nano_lifecycle_registrar_varredura",{p_loja:reserva.loja,p_execucao:reserva.execucao,p_geracao:reserva.geracao,p_grupos:{ativos:[linhas.map(l=>l.bling_id)],inativos:[[]],excluidos:[[]]}});
   assert.equal(v.error,null);assert.deepEqual(v.data.candidatos,[]);
  }
  return {...r,gravados:linhas.length,vistos:linhas.length,completo};
 });
 const resultado=await executarRodadaLifecycle(porta,{loja,execucao:randomUUID(),habilitada:true});
 return {porta,resultado};
};
try{
 sql("insert into public.lojas(id,nome,slug) values ("+q(loja)+",'Nano CI E2E',"+q("nano-e2e-"+loja)+"),("+q(outra)+",'Outra CI E2E',"+q("nano-e2e-"+outra)+"); insert into public.produtos(id,loja_id,bling_id,sku,nome,situacao,preco,estoque,publicado) values ("+q(pid)+","+q(loja)+",'123','NANO-E2E-1','Original','A',99,3,true), (gen_random_uuid(),"+q(outra)+",'123','NANO-E2E-1','Outra loja','A',88,2,false); insert into public.nano_lifecycle_checkpoint(loja_id,habilitado) values ("+q(loja)+",true)","postgres");
 const a=await executar([linha("Original")]);
 assert.equal(a.resultado.confirmado,true,JSON.stringify(a.resultado));
 const rev1=a.resultado.revisao;
 const c1=await a.porta.captura(loja,rev1);
 assert.equal(c1.estado,"baseline");assert.deepEqual(c1.eventos,[]);
 console.log("ok E2E: baseline confirmada sem backlog");
 const b=await executar([linha("Alteração parcial")],false);
 assert.equal(b.resultado.estado,"sync_incompleta");
 assert.equal(await b.porta.checkpoint(loja),rev1);
 assert.equal(sql("select nome from public.produtos where id="+q(pid)),"Alteração parcial");
 console.log("ok E2E: alteração parcial não avança checkpoint");
 // A próxima rodada compara com o snapshot persistido, não com o espelho já alterado.
 const c=await executar([linha("Alteração parcial"),linha("Peça nova","456","NANO-E2E-2")]);
 assert.equal(c.resultado.confirmado,true,JSON.stringify(c.resultado));
 const rev2=c.resultado.revisao,cap=await c.porta.captura(loja,rev2);
 assert.equal(cap.checkpointAnterior,rev1);
 assert.deepEqual(cap.eventos.map(e=>e.tipo).sort(),["alteracao_tecnica","novo"]);
 assert.equal(cap.eventos.find(e=>e.tipo==="alteracao_tecnica").produto_id,pid);
 assert.equal(cap.eventos.find(e=>e.tipo==="alteracao_tecnica").campos.includes("nome"),true);
 assert.equal(await c.porta.checkpoint(loja),rev2);
 console.log("ok E2E: recuperação registra mudança parcial e novo SKU sem perda");
 assert.equal(sql("select count(*) from public.nano_lifecycle_snapshots where loja_id="+q(loja)),"2");
 assert.equal(sql("select count(*) from public.nano_lifecycle_capturas where loja_id="+q(loja)),"2");
 assert.equal(sql("select count(*) from public.produtos where id="+q(pid)+" and preco=99 and estoque=3 and publicado"),"1");
 assert.equal(sql("select count(*) from public.produtos where loja_id="+q(loja)+" and bling_id='456' and preco is null and estoque is null and not publicado"),"1");
 assert.equal(sql("select count(*) from public.produtos where loja_id="+q(outra)+" and nome='Outra loja' and preco=88 and estoque=2"),"1");
 assert.equal(sql("select count(*) from public.pipeline_itens where loja_id="+q(loja)),"0");
 console.log("ok E2E: identidade, dados comerciais, isolamento e ausência de despacho preservados");
 // Agora usa o algoritmo real de sync, não o callback de lote técnico.
 // As páginas do ERP são simuladas; SQL, reserva, espelho e diário são reais.
 const campos="loja_id,bling_id,sku,nome,preco,estoque,situacao,sincronizado_em,categoria_bling_id,marca,gtin,gtin_tributario,descricao_curta,descricao_complementar,peso_kg,largura_cm,altura_cm,profundidade_cm,unidade,condicao,formato,pai_bling_id,volumes";
 const item=(id,nome,codigo,preco,saldo)=>({id,nome,codigo,preco,situacao:"A",estoque:{saldoVirtualTotal:saldo}});
 const i1=item(123,"Alteração integral","NANO-E2E-1",110,8),i2=item(456,"Peça nova","NANO-E2E-2",50,4);
 let instante=Date.now()+48*3600_000;
 const rodada=async(itens, falhar=false)=>{
  const execucao=randomUUID();
  const origem={
   existentes:async()=>JSON.parse(sql("select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb)::text from (select "+campos+" from public.produtos where loja_id="+q(loja)+" order by id) t")),
   listarPagina:async(_p,_l,g)=>g==="inativos"&&falhar?{erro:"falha simulada de listagem"}:{itens:g==="ativos"?itens:[]},
   detalhe:async id=>itens.find(i=>i.id===id)??null,
   registrarErro:async()=>{},espera:async()=>{},agora:()=>instante
  };
  instante+=48*3600_000;
  const porta=criarPortaSupabase(admin,reserva=>sincronizarComReserva(admin,origem,reserva));
  return {execucao,porta,resultado:await executarRodadaLifecycle(porta,{loja,execucao,habilitada:true})};
 };
 const d=await rodada([i1,i2],true);
 assert.equal(d.resultado.estado,"sync_incompleta",JSON.stringify(d.resultado));
 assert.equal(await d.porta.checkpoint(loja),rev2);
 assert.equal(sql("select count(*) from public.nano_lifecycle_varreduras where loja_id="+q(loja)+" and execucao="+q(d.execucao)),"0");
 console.log("ok E2E protegido: erro no grupo impede evidência e checkpoint");
 const f=await rodada([i1]);
 assert.equal(f.resultado.estado,"sync_incompleta",JSON.stringify(f.resultado));
 assert.equal(await f.porta.checkpoint(loja),rev2);
 assert.equal(sql("select candidatos->0->>'bling_id' from public.nano_lifecycle_varreduras where loja_id="+q(loja)+" and execucao="+q(f.execucao)),"456");
 assert.equal(sql("select situacao from public.produtos where loja_id="+q(loja)+" and bling_id='456'"),"A");
 console.log("ok E2E protegido: candidato ausente retém checkpoint sem inativar produto");
 const g=await rodada([i1,i2]);
 assert.equal(g.resultado.confirmado,true,JSON.stringify(g.resultado));
 const rev3=g.resultado.revisao,cap3=await g.porta.captura(loja,rev3);
 assert.equal(cap3.checkpointAnterior,rev2);
 assert.equal(cap3.eventos.length,1);
 assert.equal(cap3.eventos[0].tipo,"alteracao_tecnica");
 assert.equal(cap3.eventos[0].produto_id,pid);
 assert.deepEqual(cap3.eventos[0].campos,["nome"]);
 assert.equal(sql("select count(*) from public.produtos where id="+q(pid)+" and preco=110 and estoque=8 and publicado"),"1");
 assert.equal(sql("select count(*) from public.produtos where loja_id="+q(loja)+" and bling_id='456' and preco=50 and estoque=4 and not publicado"),"1");
 assert.equal(sql("select count(*) from public.nano_lifecycle_varreduras where loja_id="+q(loja)+" and execucao="+q(g.execucao)+" and candidatos='[]'::jsonb"),"1");
 assert.equal(sql("select count(*) from public.pipeline_itens where loja_id="+q(loja)),"0");
 console.log("ok E2E protegido: recuperação integral, preços/saldos do ERP espelhados e evento técnico único");

}finally{
 sql("update public.nano_lifecycle_checkpoint set habilitado=false where loja_id="+q(loja)+"; delete from public.lojas where id in ("+q(loja)+","+q(outra)+")","postgres");
}
