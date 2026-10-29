import { test } from "node:test";
import assert from "node:assert/strict";
import { totalLegivel, estadoBling, linkFonteSegura } from "./dashboard.ts";

test("dashboard: número não lido nunca vira zero", () => {
  assert.equal(totalLegivel(null), "—");
  assert.equal(totalLegivel(-1), "—");
  assert.equal(totalLegivel(Number.NaN), "—");
  assert.equal(totalLegivel(0), "0");
  assert.equal(totalLegivel(1500), "1.500");
});
test("dashboard: não declara Bling conectado sem confirmação", () => {
  assert.deepEqual(estadoBling(null), { rotulo: "Consultando…", tipo: "neutro" });
  assert.equal(estadoBling("conectada").tipo, "ok");
  assert.equal(estadoBling("pendente").tipo, "alerta");
  assert.equal(estadoBling("indisponível").tipo, "alerta");
  assert.notEqual(estadoBling("erro de token").tipo, "ok");
});
test("dashboard: links de notificação só HTTP(S) sem credenciais", () => {
  assert.equal(linkFonteSegura("javascript:alert(1)"), null);
  assert.equal(linkFonteSegura("data:text/html,teste"), null);
  assert.equal(linkFonteSegura("//example.com"), null);
  assert.equal(linkFonteSegura("https://usuario:senha@example.com"), null);
  assert.equal(linkFonteSegura("https://example.com/manual"), "https://example.com/manual");
});
