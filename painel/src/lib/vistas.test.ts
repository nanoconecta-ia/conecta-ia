import { test } from "node:test";
import assert from "node:assert/strict";
import { VISTAS, posicaoPct, vistaDaArea } from "./vistas.ts";
import { PECAS, iconeDaCategoria } from "./icones.ts";

test("cada vista tem pontos numerados em sequência, dentro do desenho", () => {
  for (const v of VISTAS) {
    assert.ok(v.pontos.length >= 4, v.area);
    v.pontos.forEach((p, i) => { assert.equal(p.n, i + 1); assert.ok(p.x > 0 && p.x < v.largura && p.y > 0 && p.y < v.altura, `${v.area} #${p.n}`); assert.match(p.slug, /^[a-z0-9-]{2,80}$/); });
  }
});

test("vista por área; área sem desenho devolve undefined", () => {
  assert.equal(vistaDaArea("motor")?.arquivo, "motor");
  assert.equal(vistaDaArea("freios")?.arquivo, "freios");
  assert.equal(vistaDaArea("filtros"), undefined);
  assert.equal(vistaDaArea(null), undefined);
});

test("posição em % é proporcional ao desenho", () => {
  const motor = vistaDaArea("motor")!;
  assert.deepEqual(posicaoPct(motor, { n: 1, x: 380, y: 360, rotulo: "", slug: "motor" }), { left: "50%", top: "50%" });
});

test("o slug de cada ponto resolve para um ícone de peça válido", () => {
  for (const v of VISTAS) for (const p of v.pontos) assert.ok((PECAS as readonly string[]).includes(iconeDaCategoria(p.slug)), p.slug);
});
