import { test } from "node:test";
import assert from "node:assert/strict";
import { argumentosProbe, caminhoConcat, FERRAMENTAS_VIDEO, sondarConcat } from "./concat-probe.mjs";
test("Concat: comando explicito --mcp headless por padrao, nao instala nada",()=>{
 assert.deepEqual(argumentosProbe([]),{bin:null,modo:"headless"});
 assert.deepEqual(argumentosProbe(["--window"]),{bin:null,modo:"window"});
 assert.throws(()=>argumentosProbe(["--token","segredo"]),/Use/);
 assert.ok(FERRAMENTAS_VIDEO.includes("export_start"));
 assert.ok(FERRAMENTAS_VIDEO.includes("concat_version"));
});
test("Concat: sem executavel nao declara MCP homologado",async()=>{
 assert.equal(caminhoConcat({}),null);
 await assert.rejects(()=>sondarConcat({bin:"./programa-inexistente"}),/nao instalado/);
});
