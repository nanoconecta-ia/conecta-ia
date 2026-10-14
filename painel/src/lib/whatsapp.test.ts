import { test } from "node:test";
import assert from "node:assert/strict";
import { linkWhatsapp, normalizarWhatsapp } from "./whatsapp.ts";

test("normaliza números brasileiros", () => {
  assert.equal(normalizarWhatsapp("(62) 99165-4515"), "5562991654515");
  assert.equal(normalizarWhatsapp("+55 62 3333-4444"), "556233334444");
  assert.equal(normalizarWhatsapp("5562991654515"), "5562991654515");
});
test("recusa números inválidos", () => {
  assert.equal(normalizarWhatsapp("123"), null);
  assert.equal(normalizarWhatsapp(""), null);
  assert.equal(normalizarWhatsapp("1199999999999999"), null);
});
test("link do WhatsApp codifica a mensagem", () => {
  assert.equal(linkWhatsapp("5562991654515", "NCM 8409 ok?"), "https://wa.me/5562991654515?text=NCM%208409%20ok%3F");
});
