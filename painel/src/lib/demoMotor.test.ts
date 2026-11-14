import { test } from "node:test";
import assert from "node:assert/strict";
import { EXEMPLO_MOTOR } from "./demoMotor.ts";

test("motor: sem preço, custo ou estoque; SKU e código do motor não inventados", () => {
  const txt = JSON.stringify(EXEMPLO_MOTOR).toLowerCase();
  for (const proibido of ["preço", "preco", "custo", "estoque", "saldo"]) assert.equal(txt.includes(proibido), false, proibido);
  assert.equal(EXEMPLO_MOTOR.sku, "a informar");
  const cod = EXEMPLO_MOTOR.evidencias.find((e) => e.dado.startsWith("código do motor"));
  assert.equal(cod?.estado, "ausente");
});

test("motor: aplicação e taxonomia seguem a confirmar", () => {
  assert.ok(EXEMPLO_MOTOR.taxonomia.every((n) => n.estado === "a_confirmar"));
  assert.equal(EXEMPLO_MOTOR.evidencias.find((e) => e.dado === "aplicação HR")?.estado, "a_confirmar");
});
