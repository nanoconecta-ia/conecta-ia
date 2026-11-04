import { test } from "node:test";
import assert from "node:assert/strict";
import { IaErro } from "../ia/tipos.ts";
import { configuracaoReserva, enderecoReserva, podeUsarReserva } from "./reserva_ia.ts";
const base = {provedor:"openrouter_free",erro:new IaErro(429,"x"),consentimento:true,iniciou:true,cotaConhecida:false,anexos:0,textoTransmitido:false,tentativas:0,propostas:0};
test("reserva exige consentimento e falha segura, nunca duplica operação",()=>{
 assert.equal(podeUsarReserva(base),true);
 for(const patch of [{provedor:"gemini"},{consentimento:false},{iniciou:false},{anexos:1},{textoTransmitido:true},{tentativas:1},{propostas:1},{erro:new IaErro(401,"x")},{erro:new IaErro(503,"interno")}]) assert.equal(podeUsarReserva({...base,...patch}),false);
 assert.equal(podeUsarReserva({...base,iniciou:false,cotaConhecida:true}),true);
});
test("reserva aceita somente endpoint Groq conferido, sem aliases externos",()=>{
 assert.equal(enderecoReserva("https://api.groq.com/openai/v1/"),true);
 for(const u of ["http://api.groq.com/openai/v1","https://api.groq.com.evil/openai/v1","https://api.groq.com/openai/v1?x=1","https://openrouter.ai/api/v1",null])assert.equal(enderecoReserva(u),false);
 assert.equal(configuracaoReserva(null).disponivel,false);
 assert.equal(configuracaoReserva({provedor:"compativel_openai",ativa:true,modelo:"llama",base_url:"https://api.groq.com/openai/v1"}).disponivel,true);
});
