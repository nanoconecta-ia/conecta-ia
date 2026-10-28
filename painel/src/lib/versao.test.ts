import { test } from "node:test";
import assert from "node:assert/strict";
(globalThis as Record<string, unknown>).__COMMIT__ = "local";
(globalThis as Record<string, unknown>).__CONSTRUIDO__ = "2026-10-28T11:44:00.000Z";
const { desatualizada, rotuloVersao, quando } = await import("./versao.ts");

test("desatualizada só com dois commits reais e diferentes", () => {
  assert.equal(desatualizada({ commit: "9778eab" }, { commit: "1234567" }), true);
  assert.equal(desatualizada({ commit: "9778eab" }, { commit: "9778eab" }), false);
  assert.equal(desatualizada({ commit: "local" }, { commit: "1234567" }), false, "build local nunca avisa");
  assert.equal(desatualizada({ commit: "9778eab" }, { commit: "local" }), false);
  assert.equal(desatualizada({ commit: "9778eab" }, null), false);
  assert.equal(desatualizada({ commit: "9778eab" }, "<html>"), false);
  assert.equal(desatualizada({ commit: "9778eab" }, { commit: 42 }), false);
  assert.equal(desatualizada({ commit: "9778eab" }, { commit: "DROP TABLE" }), false);
});
test("rótulo e data", () => {
  assert.equal(rotuloVersao({ commit: "9778eab" }), "9778eab");
  assert.equal(rotuloVersao({ commit: "local" }), "local");
  assert.equal(quando({ commit: "x", construido: "lixo" }), "");
  assert.match(quando({ commit: "x", construido: "2026-10-28T11:44:00.000Z" }), /\d{2}\/\d{2}/);
});
