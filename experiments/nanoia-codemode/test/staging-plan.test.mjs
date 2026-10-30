import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir=join(dirname(fileURLToPath(import.meta.url)),"..");
test("plano GitHub gera workers distintos, host privado e pai com binding estrito",()=>{
  const id=String(13000000000+Math.floor(Math.random()*10000000));
  const h=join(dir,"staging",`.run-${id}-host.jsonc`);
  const p=join(dir,"staging",`.run-${id}-pai.jsonc`);
  try{
    const out=JSON.parse(execFileSync(process.execPath,["staging/preparar-plano.mjs",id],
      {cwd:dir,encoding:"utf8"}));
    const host=JSON.parse(readFileSync(h,"utf8"));
    const pai=JSON.parse(readFileSync(p,"utf8"));
    assert.equal(host.name,out.hostName);
    assert.equal(pai.name,out.parentName);
    assert.notEqual(host.name,pai.name);
    assert.equal(host.workers_dev,false);
    assert.equal(pai.workers_dev,true);
    assert.equal(pai.services[0].service,host.name);
    assert.equal(pai.services[0].binding,"PILOT_HOST_SERVICE");
    assert.equal(pai.worker_loaders[0].binding,"LOADER");
    assert.equal(pai.vars.PILOT_BRIDGE_TRANSPORT,"service");
    assert.equal(pai.vars.PILOT_ENABLED,"true");
    assert.equal(host.durable_objects.bindings[0].class_name,"ReplayAuditoriaHml");
    assert.throws(()=>execFileSync(process.execPath,["staging/preparar-plano.mjs",id],
      {cwd:dir,stdio:"pipe"}),"a segunda execução não pode sobrescrever configuração");
  }finally{
    for(const f of [h,p])if(existsSync(f))rmSync(f);
  }
});
test("não aceita run_id malicioso ou nomes de Worker de produção",()=>{
  for(const bad of ["abc","1","../../foo","00000000000000000000000000"])
    assert.throws(()=>execFileSync(process.execPath,["staging/preparar-plano.mjs",bad],
      {cwd:dir,stdio:"pipe"}));
});
