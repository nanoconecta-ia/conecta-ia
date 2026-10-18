import { test } from "node:test";
import assert from "node:assert/strict";
import { classificar, LIMITE_BYTES, nomeSeguro, sha256Hex } from "./anexos.ts";

test("anexos: classifica imagem/documento e recusa tipo, vazio e tamanho", () => {
  assert.deepEqual(classificar({ name: "a.png", type: "image/png", size: 10 }), { ok: true, tipo: "imagem" });
  assert.deepEqual(classificar({ name: "a.pdf", type: "application/pdf", size: 10 }), { ok: true, tipo: "documento" });
  assert.equal(classificar({ name: "a.exe", type: "application/x-msdownload", size: 10 }).ok, false);
  assert.equal(classificar({ name: "a.svg", type: "image/svg+xml", size: 10 }).ok, false);   // SVG pode carregar script
  assert.equal(classificar({ name: "a.gif", type: "image/gif", size: 10 }).ok, false);       // fora da lista do servidor
  assert.equal(classificar({ name: "v", type: "image/png", size: 0 }).ok, false);
  assert.equal(classificar({ name: "g", type: "image/png", size: LIMITE_BYTES + 1 }).ok, false);
});

test("anexos: nome seguro, sem '..' nem barras", () => {
  assert.equal(nomeSeguro("Catálogo Sabó 2026 (final).pdf"), "Catalogo-Sabo-2026-final-.pdf");
  assert.equal(nomeSeguro("../../etc/passwd"), "etc-passwd");
  assert.equal(nomeSeguro("***"), "arquivo");
});

test("anexos: sha256 em hex minúsculo de 64 caracteres", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
