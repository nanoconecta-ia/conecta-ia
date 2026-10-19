import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aleatorioB64u, ESCOPOS, mmss, ROTULOS_ESCOPO, ROTULOS_TIPO_APROVACAO, segundosAte, sha256Hex } from "./pair.ts";

const migracao = readFileSync(new URL("../../../supabase/migrations/20261018230657_conecta_pair.sql", import.meta.url), "utf8");
const escoposMigracao = readFileSync(new URL("../../../supabase/migrations/20261018230659_pair_consulta_bling.sql", import.meta.url), "utf8");

test("escopos do painel = escopos da migração, todos com rótulo, nenhum aprova/executa/administra", () => {
  const bloco = /pair_escopos_validos\(\) returns text\[\][\s\S]*?array\[([\s\S]*?)\];/.exec(escoposMigracao)![1];
  const daMigracao = [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual([...ESCOPOS].sort(), daMigracao);
  for (const e of ESCOPOS) { assert.ok(ROTULOS_ESCOPO[e], e); assert.doesNotMatch(e, /aprovar|executar|admin/); }
});
test("todo tipo de aprovação do banco tem rótulo na Central", () => {
  const lista = /check \(tipo in \(([^)]*'orcamento_alteracao'[^)]*)\)\)/.exec(migracao)![1];
  const tipos = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(tipos.length, 8);
  for (const t of tipos) assert.ok(ROTULOS_TIPO_APROVACAO[t], t);
});
test("segredo do navegador: 256 bits, base64url, único; SHA-256 confere", async () => {
  const a = aleatorioB64u(); assert.match(a, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(a, aleatorioB64u());
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("contagem regressiva", () => { assert.equal(segundosAte("2026-01-01T00:02:00Z", Date.parse("2026-01-01T00:00:00Z")), 120); assert.equal(segundosAte("2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:05:00Z")), 0); assert.equal(mmss(125), "2:05"); });
