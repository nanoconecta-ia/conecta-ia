// Piloto de 1 SKU sintético no PostgreSQL descartável; usa o adaptador real de Engineering.
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {persistirResultadoEngenharia} from "../../supabase/functions/_shared/nano_lifecycle/entrada_engenharia.ts";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const [loja,item]=process.argv.slice(2);
const uuid=x=>typeof x==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
assert.ok(uuid(loja)&&uuid(item));
const lit=v=>v===null?"null":typeof v==="number"&&Number.isSafeInteger(v)?String(v):"'"+(typeof v==="string"?v:JSON.stringify(v)).replaceAll("'","''")+"'";
function sql(query,role="service_role"){
 return execFileSync("psql",["-X","-qAt","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1","-c","set role "+role,"-c",query],{encoding:"utf8",timeout:15000,env:{PATH:process.env.PATH,PGPASSWORD:"postgres",PGCONNECT_TIMEOUT:"5"}}).trim();
}
const r=JSON.parse(sql("select jsonb_build_object('loja',loja_id,'item',id,'execucao',nano_execucao,'geracao',nano_geracao,'versao',versao) from public.pipeline_itens where loja_id="+lit(loja)+" and id="+lit(item)+" and estado='entrada' and entrada->>'origem'='nano_lifecycle' and reservado_ate>clock_timestamp()"));
assert.equal(r.loja,loja);assert.equal(r.item,item);assert.equal(r.geracao,1);
const base=[["p_loja","uuid"],["p_item","uuid"],["p_execucao","uuid"],["p_geracao","bigint"],["p_versao","integer"]];
const spec={nano_lifecycle_entrada_tecnica:base,nano_lifecycle_persistir_engenharia:[...base,["p_entrada","jsonb"],["p_extracao","jsonb"]]};
const admin={async rpc(nome,args){
 const s=Object.hasOwn(spec,nome)?spec[nome]:null;
 if(!s||Object.keys(args).length!==s.length||s.some(([k])=>!Object.hasOwn(args,k)))throw Error("RPC fora do piloto");
 try{return {data:JSON.parse(sql("select public."+nome+"("+s.map(([k,t])=>lit(args[k])+"::"+t).join(",")+")::text")),error:null};}
 catch(e){console.error("falha RPC no piloto",nome,e.stderr?.toString().slice(0,500));return {data:null,error:"SQL"};}
}};
const resultado=await persistirResultadoEngenharia(admin,r);
assert.ok(["gravado","ja_gravado"].includes(resultado.estado),JSON.stringify(resultado));assert.equal(resultado.homologada,false);
console.log(resultado.estado);
