import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarSku, erroSku, MSG_NAO_ENCONTRADO, MSG_SKU_AMBIGUO } from "./produto_sku.ts";

test("classificarSku: nenhuma linha, uma linha e mais de uma", () => {
  assert.deepEqual(classificarSku([]), { estado: "nao_encontrado" });
  assert.deepEqual(classificarSku(null), { estado: "nao_encontrado" });
  assert.deepEqual(classificarSku(undefined), { estado: "nao_encontrado" });
  assert.deepEqual(classificarSku([{ id: "a" }]), { estado: "ok", produto: { id: "a" } });
  assert.deepEqual(classificarSku([{ id: "a" }, { id: "b" }]), { estado: "ambiguo" });
});
test("erroSku: motivos estáveis e sem dados de produto", () => {
  assert.deepEqual(erroSku({ estado: "ambiguo" }), { erro: MSG_SKU_AMBIGUO, motivo: "sku_ambiguo" });
  assert.deepEqual(erroSku({ estado: "nao_encontrado" }), { erro: MSG_NAO_ENCONTRADO, motivo: "nao_encontrado" });
});
