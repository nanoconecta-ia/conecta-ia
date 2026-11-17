import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
import {test} from "node:test";
const caminho=resolve(dirname(fileURLToPath(import.meta.url)),"../../../supabase/functions/loja-publica/index.ts");
const api=readFileSync(caminho,"utf8");

test("site público Mobis nunca lista produtos com apenas exibicao_teste",()=>{
  assert.doesNotMatch(api,/publicado\.eq\.true,exibicao_teste\.eq\.true/);
  assert.doesNotMatch(api,/previaConsultaMobis/);
  assert.match(api,/consultaPublicados\s*=\s*sb\.from\("produtos"\)/);
  assert.match(api,/\.eq\("publicado", true\)/);
});
test("aplicações por veículo só com aprovação e visibilidade explícita",()=>{
  assert.match(api,/app\.status !== "aprovado" \|\| app\.pagina_indexavel !== true/);
  assert.match(api,/aq = aq\.eq\("status", "aprovado"\)\.eq\("pagina_indexavel", true\)/);
  assert.match(api,/if \(!p\?\.publicado\)/);
});
