import { test } from "node:test";
import assert from "node:assert/strict";
import { chipsDeFiltro, removerFiltro, textoResultado, type FiltrosVitrine } from "./filtrosLoja.ts";

const vazio: FiltrosVitrine = { q: "", modelo: "", motor: "", ano: "", categoria: "", tipo: "" };
const nomeTipo = (c: string) => (c === "furgao" ? "Furgão fechado" : null);
const nomeCat = (s: string) => (s === "motor" ? "Motor" : null);

test("sem filtro não há chips; com filtros vêm na ordem dos passos e com nomes legíveis", () => {
  assert.deepEqual(chipsDeFiltro(vazio, nomeTipo, nomeCat), []);
  const c = chipsDeFiltro({ ...vazio, q: "bomba", categoria: "motor", ano: "2015", motor: "2.5", modelo: "HR", tipo: "furgao" }, nomeTipo, nomeCat);
  assert.deepEqual(c.map((x) => `${x.rotulo}: ${x.valor}`), ["Tipo: Furgão fechado", "Modelo: HR", "Motor: 2.5", "Ano: 2015", "Peça: Motor", "Busca: bomba"]);
  assert.equal(chipsDeFiltro({ ...vazio, tipo: "desconhecido" }, nomeTipo, nomeCat)[0].valor, "desconhecido", "sem nome conhecido, mostra o código");
});

test("remover modelo leva motor e ano; remover motor leva o ano; os demais saem sozinhos", () => {
  assert.deepEqual(removerFiltro("modelo"), { modelo: "", motor: "", ano: "" });
  assert.deepEqual(removerFiltro("motor"), { motor: "", ano: "" });
  assert.deepEqual(removerFiltro("categoria"), { categoria: "" });
  assert.deepEqual(removerFiltro("q"), { q: "" });
});

test("texto do resultado: singular, plural e se há filtro", () => {
  assert.equal(textoResultado(1, 0), "1 peça encontrada no catálogo");
  assert.equal(textoResultado(12, 2), "12 peças encontradas com os filtros escolhidos");
  assert.equal(textoResultado(0, 1), "0 peças encontradas com os filtros escolhidos");
});
