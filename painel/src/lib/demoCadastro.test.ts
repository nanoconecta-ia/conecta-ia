import { test } from "node:test";
import assert from "node:assert/strict";
import { EXEMPLO, resumoEstados, ROTULO_ESTADO } from "./demoCadastro.ts";

test("exemplo não traz preço, custo nem estoque", () => {
  const txt = JSON.stringify(EXEMPLO).toLowerCase();
  for (const proibido of ["preco", "preço", "custo", "estoque", "saldo"]) assert.equal(txt.includes(proibido), false, proibido);
});

test("só o que veio do Bling está confirmado; taxonomia e OEM seguem a confirmar", () => {
  assert.ok(EXEMPLO.taxonomia.every((n) => n.estado === "a_confirmar"));
  assert.ok(EXEMPLO.codigos.filter((c) => c.tipo === "oem").every((c) => c.estado === "a_confirmar"));
  assert.ok(EXEMPLO.codigos.filter((c) => c.estado === "confirmado").every((c) => c.fonte === "Bling"));
});

test("sem foto aprovada o estado é ausente e todo estado tem rótulo", () => {
  assert.equal(EXEMPLO.fotos.principal, null);
  const r = resumoEstados();
  assert.ok(r.ausente >= 1);
  for (const k of Object.keys(r)) assert.ok(ROTULO_ESTADO[k as keyof typeof ROTULO_ESTADO]);
});
