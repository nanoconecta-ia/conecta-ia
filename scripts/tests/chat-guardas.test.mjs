import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const root=new URL('../../',import.meta.url).pathname;
for(const nome of ['piloto-real','validar-gateway']) for(const args of [[],['--executar-real','--executar-nuvem','--confirmar-projeto=ptilvkzuhjnqnfydjcly']])test(`${nome}: sem autorização específica não há rede`,()=>{
 const r=spawnSync(process.execPath,['--import','data:text/javascript,globalThis.fetch=()=>process.exit(99)',root+'scripts/chat/'+nome+'.mjs',...args],{env:{...process.env,CHAT_LOJA_ID:'aaaaaaaa-0000-0000-0000-000000000001',CHAT_USUARIO_JWT:'JWT-SINTETICO-NAO-EXIBIR',CHAT_ANON_KEY:'PUBLICA-SINTETICA',CHAT_SKU:'SKU-1',CHAT_IDEMPOTENCY_KEY:'idempotencia-sintetica'},encoding:'utf8'});
 assert.equal(r.status,1);assert.ok(!r.stdout.includes('JWT-SINTETICO'));assert.ok(!r.stderr.includes('JWT-SINTETICO'));
});
test('CI do chat não executa piloto, segredos, publicação ou runner especial',async()=>{
 const s=(await readFile(root+'.github/workflows/chat-operacional.yml','utf8')).replace(/^\s*#.*$/gm,'');
 assert.ok(!/secrets\.|pull_request_target|functions deploy|supabase link|db push|self-hosted|id-token: write|--executar-real|--executar-nuvem/.test(s));assert.match(s,/contents: read/);assert.match(s,/ubuntu-24.04/);
});
