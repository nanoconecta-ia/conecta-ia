import { test } from "node:test";
import assert from "node:assert/strict";
import { ferramentasLocaisMcp } from "./catalogo_mcp.ts";

test("sessão sem escopo não descobre nada", () => assert.deepEqual(ferramentasLocaisMcp([]), []));
test("escopo consulta vê consultas e pedidos com aprovação; nunca capacidade desligada/escrita", () => {
  const nomes = ferramentasLocaisMcp(["consulta"]).map((t) => t.title);
  assert.ok(nomes.includes("windows.sistema.inventario") && nomes.includes("browser.elemento.clicar"));
  assert.ok(!nomes.includes("windows.servico.reiniciar"));
});
test("nomes aceitos por qualquer LLM e schema fechado com os mesmos padrões do validador", () => {
  for (const t of ferramentasLocaisMcp(["consulta"])) {
    assert.match(t.name, /^[A-Za-z0-9_-]{1,100}$/); assert.equal(t.inputSchema.additionalProperties, false);
    for (const p of Object.values(t.inputSchema.properties)) assert.doesNotThrow(() => new RegExp(p.pattern));
  }
});
test("a descrição avisa quando exige aprovação humana", () =>
  assert.match(ferramentasLocaisMcp(["consulta"]).find((t) => t.title === "browser.elemento.clicar")!.description, /exige aprovação humana/));
