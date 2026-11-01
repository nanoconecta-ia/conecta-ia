import { test } from "node:test";
import assert from "node:assert/strict";
import { apagarVarias, mensagemApagar } from "./apagar-historico.ts";

test("apagarVarias segue depois de uma recusa e conta cada resultado", async () => {
  const r = await apagarVarias(["a", "b", "c"], async (id) => { if (id === "b") throw new Error("aguarde o turno em execução"); });
  assert.deepEqual(r.apagadas, ["a", "c"]);
  assert.deepEqual(r.recusadas, [{ id: "b", motivo: "aguarde o turno em execução" }]);
  assert.match(mensagemApagar(r), /2 apagada\(s\); 1 não foi possível/);
});

test("mensagemApagar: tudo apagado, e lista vazia", async () => {
  assert.match(mensagemApagar(await apagarVarias(["a"], async () => {})), /1 conversa\(s\) apagada\(s\)\. A auditoria/);
  assert.equal(mensagemApagar(await apagarVarias([], async () => {})), "Não havia conversa para apagar.");
});
