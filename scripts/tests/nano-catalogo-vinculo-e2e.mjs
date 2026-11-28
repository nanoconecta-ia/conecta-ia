// CI efêmero, após testes existentes de catálogo e auditoria. Sem credencial de produção.
import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {createInterface} from "node:readline";
if(process.env.GITHUB_ACTIONS!=="true"||process.env.PGHOST!=="localhost"||process.env.PGPORT!=="5432"||process.env.PGDATABASE!=="conecta_teste"||process.env.PGUSER!=="postgres")throw Error("somente CI descartável");
const args=["-XqAtw","-h","127.0.0.1","-p","5432","-U","postgres","-d","conecta_teste","-v","ON_ERROR_STOP=1"];
const env={PATH:process.env.PATH,PGPASSWORD:"postgres",PGCONNECT_TIMEOUT:"5"};
const sql=texto=>execFileSync("psql",args,{input:texto,encoding:"utf8",timeout:30000,env,stdio:["pipe","pipe","pipe"]}).trim();
const L="fa000000-0000-0000-0000-000000000001",P="fa100000-0000-0000-0000-000000000001";
const A="fb123000-0000-0000-0000-000000000001",M="fb123100-0000-0000-0000-000000000001",R="fb123200-0000-0000-0000-000000000001",H="fb123300-0000-0000-0000-000000000001";
const Q="fb300000-0000-0000-0000-000000000001";
const L2="e1140000-0000-0000-0000-000000000002",H2="e1143000-0000-0000-0000-000000000003";
assert.equal(sql("select count(*) from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"' and solicitacao='"+Q+"' and aplicacao_id is null and not homologada;"),"1");
sql("begin; insert into public.marcas(id,loja_id,nome,tipo,status) values ('"+M+"','"+L+"','Marca CI 123','veiculo','aprovado'); insert into public.produto_aplicacoes(id,loja_id,produto_id,modelo,motorizacao,ano_inicial,ano_final,marca_veiculo_id,montadora_origem_id,codigo_oem,status,fonte,coletado_em,pagina_indexavel,pagina_slug) values ('"+A+"','"+L+"','"+P+"','Modelo teste','M1',2014,2016,'"+M+"','"+M+"','12345-67890','a_confirmar','fixture CAT-123',now(),false,'ci-cat-123'); insert into public.usuarios_loja(loja_id,user_id,papel) values ('"+L+"','"+H+"','lojista'); commit;");
const insert=(app,snap,digest)=>"insert into nano_lifecycle_interno.conferencias_gate(loja_id,solicitacao,item_id,geracao,candidato,leitura_id,sha256,auditor,conferido_em,aplicacao_id,aplicacao_snapshot,aplicacao_sha256) select c.loja_id,'"+R+"',c.item_id,c.geracao,c.candidato,c.leitura_id,c.sha256,c.auditor,c.conferido_em,"+app+","+snap+","+digest+" from nano_lifecycle_interno.conferencias_gate c join public.produto_aplicacoes a on a.id='"+A+"' where c.loja_id='"+L+"' and c.solicitacao='"+Q+"';";
const snapshot="to_jsonb(a.*)", hash=s=>"encode(sha256(convert_to(("+s+")::text,'UTF8')),'hex')";
const id="'"+A+"'";
const validar=mutacao=>assert.throws(()=>sql("\\set VERBOSITY verbose\nbegin;\n"+mutacao+"\nrollback;"),e=>e.stderr?.includes("23514")&&e.stderr?.includes("nano_gate_vinculo_aplicacao"));
validar(insert(id,snapshot,"repeat('0',64)"));
validar(insert("'"+M+"'",snapshot,hash(snapshot)));
validar(insert(id,"null","null"));
for(const delta of ["'{\"produto_id\":\""+M+"\"}'","'{\"modelo\":\"Outro\"}'","'{\"ano_final\":2017}'","'{\"codigo_oem\":\"OUTRO\"}'","'{\"loja_id\":\""+L2+"\"}'"]){
 const alterado=snapshot+"||"+delta+"::jsonb";
 validar(insert(id,alterado,hash(alterado)));
}
const resultado=sql("begin; "+insert(id,snapshot,hash(snapshot))+" select jsonb_build_object('aplicacao',aplicacao_id,'homologada',homologada,'sha',aplicacao_sha256,'revisao',candidato->'escopo'->>'revisao') from nano_lifecycle_interno.conferencias_gate where loja_id='"+L+"' and solicitacao='"+R+"'; rollback;");
const v=JSON.parse(resultado);
assert.equal(v.aplicacao,A);assert.equal(v.homologada,false);assert.match(v.sha,/^[0-9a-f]{64}$/);assert.ok(v.revisao);
assert.equal(sql("select count(*) from nano_lifecycle_interno.conferencias_gate where solicitacao='"+R+"';"),"0");
console.log("ok: CAT-123-01 representação candidata no recibo existente; divergências de identidade, fato e hash retidas; rollback");
const lock=l=>"pg_try_advisory_xact_lock(hashtextextended('nano.gate.documental:'||'"+l+"',0))";
const app="update public.produto_aplicacoes set modelo='Outro' where loja_id='"+L+"' and id='"+A+"' returning id;";
const humano="update public.usuarios_loja set papel='editor' where loja_id='"+L+"' and user_id='"+H+"' returning user_id;";
const marca="update public.marcas set nome='Outro' where loja_id='"+L+"' and id='"+M+"' returning id;";
const outra="update public.usuarios_loja set papel='editor' where loja_id='"+L2+"' and user_id='"+H2+"' returning user_id;";
async function manter(instrucao,verificar){
 const proc=spawn("psql",args,{env,stdio:["pipe","pipe","pipe"]});proc.stderr.resume();
 const rl=createInterface({input:proc.stdout});
 try{
  await new Promise((resolve,reject)=>{
   const t=setTimeout(()=>reject(Error("transação de teste não iniciou")),10000);
   proc.once("error",e=>{clearTimeout(t);reject(e);});
   proc.once("exit",()=>{clearTimeout(t);reject(Error("transação encerrou"));});
   rl.on("line",l=>{if(l==="__CAT123__"){clearTimeout(t);resolve();}});
   proc.stdin.write("begin;\n"+instrucao+"\n\\echo __CAT123__\n");
  });
  verificar();
 }finally{
  if(proc.exitCode===null&&proc.signalCode===null){
   await new Promise(resolve=>{const t=setTimeout(()=>proc.kill(),5000);proc.once("exit",()=>{clearTimeout(t);resolve();});proc.stdin.end("rollback;\n");});
  }
  rl.close();
 }
}
for(const mutacao of [app,humano,marca]){
 await manter(mutacao,()=>{
  assert.equal(sql("select "+lock(L)+";"),"f");
  assert.equal(sql("select "+lock(L2)+";"),"t");
 });
}
console.log("ok: CAT-123-02 escritor de aplicação, papel e marca ocupa namespace comum só na sua loja");
await manter("select "+lock(L)+";",()=>{
 for(const prefixo of ["","set local session_replication_role=replica; "]){
  for(const mutacao of [app,humano,marca]){
   assert.throws(()=>sql("\\set VERBOSITY verbose\nbegin; "+prefixo+mutacao+" rollback;"),e=>e.stderr?.includes("55P03")&&e.stderr?.includes("escopo documental ocupado"));
  }
 }
 assert.equal(sql("begin; "+outra+" rollback;"),H2);
});
assert.equal(sql("begin; "+app+" rollback;"),A);
assert.equal(sql("begin; "+humano+" rollback;"),H);
assert.equal(sql("begin; "+marca+" rollback;"),M);
assert.equal(sql("select modelo from public.produto_aplicacoes where id='"+A+"';"),"Modelo teste");
assert.equal(sql("select papel from public.usuarios_loja where loja_id='"+L+"' and user_id='"+H+"';"),"lojista");
assert.equal(sql("select count(*) from pg_trigger where tgname in ('zz_nano_guard_catalogo_loja','zz_nano_guard_catalogo_truncate') and tgenabled='A' and tgrelid in ('public.produto_aplicacoes'::regclass,'public.usuarios_loja'::regclass,'public.marcas'::regclass);"),"6");
console.log("ok: CAT-123-03 sentido inverso, replica, isolamento de loja e rollback; sem autoridade de decisão");
