import test from "node:test";
import assert from "node:assert/strict";
import { indicadorQr } from "./indicadorQr.ts";
const agora = Date.parse("2026-11-15T04:00:00.000Z");
const iso = (offset:number) => new Date(agora+offset*1000).toISOString();
const base={disponivel:true,online:true,janela_ate:iso(3600),token_ate:iso(900),ultimo_sinal_em:iso(-20)};
test('pulso recente + token e janela validos: online',()=>assert.equal(indicadorQr(base,agora).online,true));
test('token valido sem consumidor nao e online',()=>assert.deepEqual(indicadorQr({...base,online:false,ultimo_sinal_em:null},agora).online,false));
test('escuta antiga nao e online mesmo com flag antiga',()=>assert.equal(indicadorQr({...base,ultimo_sinal_em:iso(-76)},agora).online,false));
test('token vencido nunca fica online',()=>assert.equal(indicadorQr({...base,token_ate:iso(-1)},agora).online,false));
test('janela vencida e sem autorizacao nunca online',()=>{
assert.equal(indicadorQr({...base,janela_ate:iso(-1)},agora).online,false);
assert.equal(indicadorQr(null,agora).online,false);
});
