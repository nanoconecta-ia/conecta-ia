// Build servido somente em loopback, sem credenciais nem chamadas de produção.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',WEB_OAUTH_LEGADO_ATIVO:''};
for(const k of Object.keys(env))if(/^(SUPABASE_|BLING_|CREDENCIAIS_)/.test(k))delete env[k];
const processo=spawn('npm',['run','start','--','--hostname','127.0.0.1','--port','18765'],{cwd:'web',env,detached:true,stdio:['ignore','pipe','pipe']});
let saida='';processo.stdout.on('data',b=>saida=(saida+b).slice(-4000));processo.stderr.on('data',b=>saida=(saida+b).slice(-4000));
const base='http://127.0.0.1:18765';
const ler=p=>fetch(base+p,{redirect:'manual',signal:AbortSignal.timeout(3000)});
try {
  const prazo=Date.now()+45000;let pronta=false;
  while(Date.now()<prazo&&processo.exitCode===null){try{if((await ler('/')).status===200){pronta=true;break}}catch{}await new Promise(ok=>setTimeout(ok,200))}
  assert.ok(pronta,'Next não iniciou: '+saida);
  assert.equal((await ler('/entrar')).status,200);
  for(const p of ['/painel','/painel/bling','/admin']){const r=await ler(p);assert.ok([303,307,308].includes(r.status),p);assert.match(r.headers.get('location')??'',/\/entrar/)}
  if(existsSync('web/src/app/api/bling/conectar/route.ts'))for(const p of ['/api/bling/conectar','/api/bling/callback?code=simulado&state=simulado']){const r=await ler(p);assert.equal(r.status,503);assert.match(await r.text(),/desativado/i)}
  console.log('Next local: login público, painel/admin protegidos e OAuth legado desligado; nenhuma credencial utilizada.');
}finally{try{process.kill(-processo.pid,'SIGTERM')}catch{}}
