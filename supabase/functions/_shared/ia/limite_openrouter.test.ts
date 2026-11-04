import { test } from "node:test";
import assert from "node:assert/strict";
import { limiteOpenRouter } from "./limite_openrouter.ts";
const url="https://openrouter.ai/api/v1/chat/completions";
test("cota diária extrai só enum e data, nunca mensagem bruta",()=>{
 const r=limiteOpenRouter(url,429,JSON.stringify({error:{message:"free-models-per-day TOKEN-SECRETO"}}),new Headers());
 assert.equal(r?.motivo_ia,"cota_diaria");assert.equal(r?.renovacao_estimada,true);
 assert.ok(Date.parse(r!.tentar_novamente_em!)>Date.now());assert.ok(!JSON.stringify(r).includes("SECRETO"));assert.ok(!r?.message.includes("SECRETO"));
});
test("limite de minuto não vira bloqueio diário, outros provedores não são classificados",()=>{
 assert.equal(limiteOpenRouter(url,429,'{"error":{"message":"free-models-per-min"}}',new Headers())?.motivo_ia,"limite_minuto");
 assert.equal(limiteOpenRouter(url,429,'{"error":{"message":"upstream busy"}}',new Headers()),null);
 assert.equal(limiteOpenRouter("https://api.groq.com",429,'{"error":{"message":"free-models-per-day"}}',new Headers()),null);
 assert.equal(limiteOpenRouter(url,429,"inválido",new Headers()),null);
});
test("horário válido do provedor prevalece; valores inválidos não são refletidos",()=>{
 const tempo=Date.now()+120000;
 const r=limiteOpenRouter(url,429,'{"error":{"metadata":{"limit_source":"openrouter_free_tier_daily"}}}',new Headers({"x-ratelimit-reset":String(tempo)}));
 assert.equal(r?.tentar_novamente_em,new Date(tempo).toISOString());assert.equal(r?.renovacao_estimada,undefined);
});
