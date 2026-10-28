import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerTokens, razao } from "./contraste.ts";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const bloco = (abre: string) => { const i = css.indexOf(abre); assert.ok(i >= 0, `bloco não encontrado: ${abre}`); return css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i)); };
const TEMAS: Record<string, Record<string, string>> = {
  "padrão (claro)": lerTokens(bloco(":root {")),
  "automático escuro": lerTokens(bloco(":root:not([data-tema])")),
  claro: lerTokens(bloco('[data-tema="claro"] {')),
  escuro: lerTokens(bloco('[data-tema="escuro"] {')),
  noturno: lerTokens(bloco('[data-tema="noturno"] {')),
  contraste: lerTokens(bloco('[data-tema="contraste"] {')),
};
// [primeiro plano, fundo, mínimo]. Texto >= 4,5:1 (AA); borda de campo >= 3:1 (WCAG 1.4.11).
const TEXTO: [string, string][] = [
  ["texto", "fundo"], ["texto", "cartao"], ["texto", "realce"], ["suave", "fundo"], ["suave", "cartao"], ["suave", "realce"],
  ["marca-forte", "fundo"], ["marca-forte", "cartao"], ["marca", "fundo"], ["marca", "cartao"], ["marca-texto", "marca"], ["marca-texto", "marca-forte"],
  ["ok", "fundo"], ["ok", "cartao"], ["ok", "realce"], ["atencao", "fundo"], ["atencao", "cartao"], ["erro", "fundo"], ["erro", "cartao"], ["ciano", "fundo"], ["ciano", "cartao"], ["verde-texto", "verde"],
];
const CAMPO: [string, string][] = [["borda-forte", "fundo"], ["borda-forte", "cartao"], ["borda-forte", "realce"]];

test("todo tema define os tokens necessários, inclusive --borda-forte", () => {
  for (const [nome, t] of Object.entries(TEMAS)) for (const k of ["fundo", "cartao", "realce", "texto", "suave", "borda", "borda-forte", "marca", "marca-forte", "marca-texto", "ok", "atencao", "erro", "ciano", "verde", "verde-texto"]) assert.ok(t[k], `${nome}: falta --${k}`);
});

for (const [nome, t] of Object.entries(TEMAS)) {
  test(`${nome}: texto e estados com contraste >= 4,5:1`, () => {
    for (const [a, b] of TEXTO) { const r = razao(t[a], t[b]); assert.ok(r >= 4.5, `${nome}: --${a} sobre --${b} = ${r.toFixed(2)}:1 (mínimo 4,5)`); }
  });
  test(`${nome}: borda de campo (--borda-forte) com contraste >= 3:1`, () => {
    for (const [a, b] of CAMPO) { const r = razao(t[a], t[b]); assert.ok(r >= 3, `${nome}: --${a} sobre --${b} = ${r.toFixed(2)}:1 (mínimo 3)`); }
  });
}

test("alto contraste: texto principal e secundário >= 7:1 (AAA)", () => {
  const t = TEMAS.contraste;
  for (const [a, b] of [["texto", "fundo"], ["texto", "cartao"], ["texto", "realce"], ["suave", "fundo"], ["suave", "cartao"], ["suave", "realce"], ["marca", "fundo"], ["marca-texto", "marca"]] as const) assert.ok(razao(t[a], t[b]) >= 7, `--${a}/--${b} = ${razao(t[a], t[b]).toFixed(2)}`);
});

test("a calculadora de contraste confere com valores conhecidos", () => {
  assert.equal(Math.round(razao("#000000", "#FFFFFF") * 100) / 100, 21);
  assert.equal(razao("#777", "#777"), 1);
  assert.ok(Math.abs(razao("#767676", "#FFFFFF") - 4.54) < 0.02); // limite clássico do AA
});
