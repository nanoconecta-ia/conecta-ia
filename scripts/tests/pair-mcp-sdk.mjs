// Cliente MCP real em HTTP loopback; sessões e produtos SIMULADOS, sem Supabase/ERP/IA remotos.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tratar } from '../../supabase/functions/_shared/pair/gateway.ts';
import { sha256Hex } from '../../supabase/functions/_shared/pair/cripto.ts';
if (!process.env.MCP_SDK_DIR) throw Error('Informe MCP_SDK_DIR com SDK instalado no runner descartável.');
const sdk = p => pathToFileURL(resolve(process.env.MCP_SDK_DIR, 'dist/esm', p)).href;
const {Client} = await import(sdk('client/index.js'));
const {StreamableHTTPClientTransport} = await import(sdk('client/streamableHttp.js'));
const metade='t'.repeat(43),sal='s'.repeat(43),token=`${metade}.${sal}`;
const hash=await sha256Hex(metade),salHash=await sha256Hex(sal);
const sessao={sessao_id:'sintetica',loja_id:'loja-A',usuario_id:'usuario-A',dispositivo_id:'dispositivo-A',nome:'Cliente SIMULADO',tipo:'agente_externo',escopos:['bling:consultar'],capacidades:[]};
const audit=[],consultas=[];let revogada=false;
const portas={
  validar:async(h,s)=>h===hash&&s===salHash&&!revogada?sessao:null,
  limite:async()=>true,
  auditar:async e=>{audit.push(e)},
  dados:{consultarProdutoBling:async(s,sku)=>{assert.equal(s.loja_id,'loja-A');consultas.push(sku);return {origem:'api_bling',simulado:true,ambiente:'sintetico',dados:{sku,nome:'Produto SIMULADO'}}}},
};
const server=createServer(async(req,res)=>{
  try {
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const r=await tratar({metodo:req.method,authorization:req.headers.authorization??null,corpo:Buffer.concat(chunks).toString()},portas);
    res.writeHead(r.status,{'Content-Type':'application/json',...r.headers});res.end(r.corpo?JSON.stringify(r.corpo):undefined);
  } catch {res.writeHead(503);res.end('{}')}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const client=new Client({name:'teste-conecta-sintetico',version:'1.0.0'});
const transport=new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`),{requestInit:{headers:{Authorization:'Bearer '+token}}});
try {
  await client.connect(transport);
  await client.ping();
  const lista=await client.listTools();assert.equal(lista.tools.length,1);assert.equal(lista.tools[0].name,'conecta.bling_consultar_produto');
  const r=await client.callTool({name:lista.tools[0].name,arguments:{sku:'80692'}});
  const d=JSON.parse(r.content[0].text);assert.equal(d.ambiente,'sintetico');assert.equal(d.dados.sku,'80692');assert.deepEqual(consultas,['80692']);assert.equal(audit.at(-1).resultado,'ok');
  const negado=await client.callTool({name:lista.tools[0].name,arguments:{sku:'80692',loja_id:'loja-B'}});assert.equal(negado.isError,true);assert.equal(consultas.length,1);
  revogada=true;await assert.rejects(client.callTool({name:lista.tools[0].name,arguments:{sku:'80692'}}));assert.equal(consultas.length,1);
  console.log('SDK MCP 1.32.0: initialize, notificação, ping, tools/list, tools/call, isolamento e revogação passaram. Dados SIMULADOS.');
} finally {await client.close();server.closeAllConnections();await new Promise(ok=>server.close(ok))}
