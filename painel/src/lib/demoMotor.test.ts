import { test } from "node:test";
import assert from "node:assert/strict";
import { EXEMPLO_MOTOR } from "./demoMotor.ts";

test("motor: sem preço, custo ou estoque; SKU e código do motor não inventados", () => {
  const txt = JSON.stringify(EXEMPLO_MOTOR).toLowerCase();
  for (const proibido of ["preço", "preco", "custo", "estoque", "saldo"]) assert.equal(txt.includes(proibido), false, proibido);
  assert.equal(EXEMPLO_MOTOR.sku, "CI002916");
  const bloco = EXEMPLO_MOTOR.evidencias.find((e) => e.dado === "número do bloco");
  assert.equal(bloco?.estado, "nao_consultado");
});

test("motor: aplicação e taxonomia seguem a confirmar", () => {
  assert.ok(EXEMPLO_MOTOR.taxonomia.every((n) => n.estado === "a_confirmar"));
  assert.equal(EXEMPLO_MOTOR.evidencias.find((e) => e.dado.startsWith("aplicação"))?.estado, "a_confirmar");
});

import { VERSOES_MOTOR } from "./demoMotor.ts";
test("motor: o que o catálogo não lista fica não consultado, nunca ausente; 8v e 16v não se misturam", () => {
  const todos = (l: import("./demoMotor.ts").ItemKit[]): import("./demoMotor.ts").ItemKit[] => l.flatMap((n) => [n, ...(n.filhos ? todos(n.filhos) : [])]);
  assert.ok(todos(VERSOES_MOTOR["8v"].itens).every((n) => n.estado !== "ausente"));
  assert.ok(todos(VERSOES_MOTOR["8v"].itens).every((n) => n.nome !== "Tuchos" && n.nome !== "Eixos de comando"));
  assert.ok(todos(VERSOES_MOTOR["16v"].itens).some((n) => n.nome === "Tuchos"));
  assert.notEqual(VERSOES_MOTOR["8v"].sku, VERSOES_MOTOR["16v"].sku);
});
