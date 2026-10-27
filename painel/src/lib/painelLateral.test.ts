import { test } from "node:test";
import assert from "node:assert/strict";
import { ajustarLargura, dividePagina, larguraPeloPonteiro, LARGURA_MAX, LARGURA_MIN, LARGURA_PADRAO, passoDeTeclado, reserva, validar, type EstadoPainel } from "./painelLateral.ts";

const fixoDir: EstadoPainel = { modo: "fixo", lado: "dir", largura: 440 };

test("ajustarLargura: respeita mínimo, máximo e deixa espaço para a página", () => {
  assert.equal(ajustarLargura(100, 1920), LARGURA_MIN);
  assert.equal(ajustarLargura(5000, 1920), LARGURA_MAX);
  assert.equal(ajustarLargura(600, 1200), 600);
  assert.equal(ajustarLargura(700, 1200), 640, "teto = tela 1200 - 560 de página");
  assert.equal(ajustarLargura(Number.NaN, 1920), LARGURA_PADRAO);
});

test("reserva: só divide a tela quando fixo, aberto e a tela comporta", () => {
  assert.deepEqual(reserva(fixoDir, 1920, true), { esq: 0, dir: 440 });
  assert.deepEqual(reserva({ ...fixoDir, lado: "esq" }, 1920, true), { esq: 440, dir: 0 });
  assert.deepEqual(reserva(fixoDir, 1920, false), { esq: 0, dir: 0 }, "fechado não reserva");
  assert.deepEqual(reserva({ ...fixoDir, modo: "flutuante" }, 1920, true), { esq: 0, dir: 0 }, "flutuante não reserva");
  assert.deepEqual(reserva(fixoDir, 800, true), { esq: 0, dir: 0 }, "tela pequena: vira sobreposição");
  assert.equal(dividePagina(fixoDir, 1099, true), false);
  assert.equal(dividePagina(fixoDir, 1100, true), true);
});

test("separador: arrastar muda a largura pelo lado certo; teclado respeita o lado", () => {
  assert.equal(larguraPeloPonteiro(1500, "dir", 1920), 420); // 1920 - 1500
  assert.equal(larguraPeloPonteiro(500, "esq", 1920), 500);
  assert.equal(larguraPeloPonteiro(1900, "dir", 1920), LARGURA_MIN, "não encolhe abaixo do mínimo");
  assert.equal(passoDeTeclado("ArrowLeft", "dir", false), 24);
  assert.equal(passoDeTeclado("ArrowLeft", "esq", false), -24);
  assert.equal(passoDeTeclado("ArrowRight", "dir", true), -96);
  assert.equal(passoDeTeclado("a", "dir", false), 0);
});

test("validar: valor salvo estragado volta ao padrão sem quebrar", () => {
  assert.deepEqual(validar(null), { modo: "flutuante", lado: "dir", largura: LARGURA_PADRAO });
  assert.deepEqual(validar({ modo: "fixo", lado: "esq", largura: 9999 }, 1920), { modo: "fixo", lado: "esq", largura: LARGURA_MAX });
  assert.deepEqual(validar({ modo: "xyz", lado: 3, largura: "a" }), { modo: "flutuante", lado: "dir", largura: LARGURA_PADRAO });
});
