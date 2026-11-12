import { test } from "node:test";
import assert from "node:assert/strict";
import { pontoCasa, pontoFoco, type Caixa } from "./olhoNano.ts";

const caixa = (left: number, top: number, width: number, height: number): Caixa => ({ left, top, width, height, right: left + width, bottom: top + height });

test("pontoCasa: âncora sem área (elemento escondido) → null; com área fica dentro da tela", () => {
  assert.equal(pontoCasa(null, 390, 844), null);
  assert.equal(pontoCasa(caixa(0, 0, 0, 0), 390, 844), null);
  assert.deepEqual(pontoCasa(caixa(14, 80, 362, 60), 390, 844), { x: 346, y: 110 });
  assert.deepEqual(pontoCasa(caixa(240, 80, 1180, 60), 1440, 900), { x: 1374, y: 110 });
});

test("pontoFoco: vai para a direita do campo se couber, senão para a esquerda; nunca sai da tela", () => {
  assert.deepEqual(pontoFoco(caixa(100, 200, 300, 40), 1440, 900), { x: 437, y: 220 });
  assert.deepEqual(pontoFoco(caixa(14, 400, 362, 160), 390, 844), { x: 34, y: 434 });
  assert.deepEqual(pontoFoco(caixa(1000, 880, 420, 40), 1440, 900), { x: 963, y: 866 });
  assert.equal(pontoFoco(caixa(0, 0, 0, 10), 390, 844), null);
});
