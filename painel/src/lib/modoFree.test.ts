import { test } from "node:test";
import assert from "node:assert/strict";
import { exigeConfirmacao, MODOS_FREE, modoDaChave } from "./modoFree.ts";

test("modo a partir da chave: sem chave guardada não há modo; desligar preserva a chave", () => {
  assert.equal(modoDaChave(undefined), null);
  assert.equal(modoDaChave({ ativa: false, final_chave: null }), null, "chave removida");
  assert.equal(modoDaChave({ ativa: false, final_chave: "wxyz" }), "desligado");
  assert.equal(modoDaChave({ ativa: true, failover: false, final_chave: "wxyz" }), "manual");
  assert.equal(modoDaChave({ ativa: true, failover: true, final_chave: "wxyz" }), "automatico");
  assert.equal(modoDaChave({ ativa: true, failover: null, final_chave: "wxyz" }), "manual", "coluna antiga/ausente = manual");
});
test("a autorização do dono é pedida ao LIGAR (nunca ao desligar nem ao trocar entre ligados)", () => {
  assert.equal(exigeConfirmacao(null, "manual"), true); assert.equal(exigeConfirmacao("desligado", "automatico"), true);
  assert.equal(exigeConfirmacao("manual", "automatico"), false); assert.equal(exigeConfirmacao("automatico", "manual"), false);
  assert.equal(exigeConfirmacao("manual", "desligado"), false); assert.equal(exigeConfirmacao("automatico", "desligado"), false);
});
test("os três modos existem, na ordem desligado, manual, automático", () => { assert.deepEqual(MODOS_FREE.map((m) => m.id), ["desligado", "manual", "automatico"]); });
