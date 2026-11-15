import { test } from "node:test";
import assert from "node:assert/strict";
import { alertaPrazo, contadorPrazo, mensagemAlertaPrazo, segundosRestantes, tokenEJanelaValidos } from "./relogioPair.ts";
const agora = Date.parse("2026-11-15T03:00:00.000Z");
const futuro = (s: number) => new Date(agora + s * 1000).toISOString();

test("contagem regressiva correta sem horas negativas", () => {
  assert.equal(contadorPrazo(futuro(3661), agora), "01:01:01");
  assert.equal(contadorPrazo(futuro(90061), agora), "1 d 01:01:01");
  assert.equal(contadorPrazo(futuro(-1), agora), "00:00:00");
  assert.equal(contadorPrazo(null, agora), "--:--:--");
  assert.equal(segundosRestantes("data-invalida", agora), null);
});
test("avisos graduais aos 15, 5 e 1 minutos", () => {
  assert.equal(alertaPrazo(futuro(1000), agora), "normal");
  assert.equal(alertaPrazo(futuro(900), agora), "atencao");
  assert.equal(alertaPrazo(futuro(300), agora), "urgente");
  assert.equal(alertaPrazo(futuro(60), agora), "critico");
  assert.equal(alertaPrazo(futuro(0), agora), "vencido");
  assert.match(mensagemAlertaPrazo("token", "vencido"), /novo pareamento/);
});
test("sessão visualmente ativa não pode ocultar token vencido", () => {
  assert.equal(tokenEJanelaValidos(futuro(300), futuro(1200), agora), true);
  assert.equal(tokenEJanelaValidos(futuro(-1), futuro(1200), agora), false);
  assert.equal(tokenEJanelaValidos(futuro(300), futuro(-1), agora), false);
});
