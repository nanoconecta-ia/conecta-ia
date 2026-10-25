import { test } from "node:test";
import assert from "node:assert/strict";
import { paraBase64, rotuloBytes, validarSelecao } from "./anexosChat.ts";

test("anexos do chat: valida tipo, tamanho, quantidade e PDF por provedor", () => {
  const ok = { name: "a.png", type: "image/png", size: 1000 };
  assert.equal(validarSelecao(ok, [], true), null);
  assert.match(validarSelecao({ ...ok, type: "application/x-msdownload" }, [], true)!, /use imagem/);
  assert.match(validarSelecao({ ...ok, size: 0 }, [], true)!, /vazio/);
  assert.match(validarSelecao({ ...ok, size: 3_000_001 }, [], true)!, /passa de 3 MB/);
  assert.match(validarSelecao(ok, [{ bytes: 1 }, { bytes: 1 }, { bytes: 1 }], true)!, /Máximo de 3/);
  assert.match(validarSelecao({ ...ok, size: 2_900_000 }, [{ bytes: 2_000_000 }], true)!, /total/);
  assert.match(validarSelecao({ name: "a.pdf", type: "application/pdf", size: 10 }, [], false)!, /não PDF/);
  assert.equal(validarSelecao({ name: "a.pdf", type: "application/pdf", size: 10 }, [], true), null);
});
test("anexos do chat: base64 de arquivo grande sem estourar a pilha; rótulo de tamanho", () => {
  const b = new Uint8Array(2_000_000).fill(65);
  assert.equal(paraBase64(b).length, Math.ceil(2_000_000 / 3) * 4);
  assert.equal(paraBase64(new Uint8Array([72, 105])), "SGk=");
  assert.equal(rotuloBytes(500), "500 B"); assert.equal(rotuloBytes(2048), "2 KB"); assert.equal(rotuloBytes(1_572_864), "1.5 MB");
});
