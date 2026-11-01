import { test } from "node:test";
import assert from "node:assert/strict";
import { argumentosProbe, caminhoConcat, FERRAMENTAS_VIDEO, sondarConcat } from "./concat-probe.mjs";
test("Concat: comando explicito --mcp headless por padrao, nao instala nada",()=>{
 assert.deepEqual(argumentosProbe([]),{bin:null,modo:"headless",sha256:null});
 assert.deepEqual(argumentosProbe(["--window"]),{bin:null,modo:"window",sha256:null});
 assert.throws(()=>argumentosProbe(["--token","segredo"]),/Use/);
 assert.ok(FERRAMENTAS_VIDEO.includes("export_start"));
 assert.ok(FERRAMENTAS_VIDEO.includes("concat_version"));
});
test("Concat: sem executavel nao declara MCP homologado",async()=>{
 assert.equal(caminhoConcat({}),null);
 await assert.rejects(()=>sondarConcat({bin:"./programa-inexistente"}),/nao instalado/);
});

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
test("Concat: so executa binario com caminho absoluto e SHA-256 igual ao verificado",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"concat-prova-"));
 try{
  const bin=join(dir,"concat");writeFileSync(bin,"binario de teste");
  const sha=createHash("sha256").update("binario de teste").digest("hex");
  const nuncaLanca=()=>{throw Error("nao deveria executar");};
  await assert.rejects(()=>sondarConcat({bin,lancar:nuncaLanca}),/Informe --sha256/);
  await assert.rejects(()=>sondarConcat({bin,sha256:"0".repeat(64),lancar:nuncaLanca}),/nao confere/);
  await assert.rejects(()=>sondarConcat({bin:"relativo/concat",sha256:sha,lancar:nuncaLanca}),/nao instalado/);
  await assert.rejects(()=>sondarConcat({sha256:sha,lancar:nuncaLanca}),/nao instalado/,"sem --bin nao ha descoberta automatica que execute");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
