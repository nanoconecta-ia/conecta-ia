import { test } from "node:test";
import assert from "node:assert/strict";
import { conferir, normalizar, type CategoriaBling, type Ligacao, type NoTax } from "./taxonomiaBling.ts";

const no = (id: string, nome: string, pai: string | null = null): NoTax => ({ id, nome, slug: id, pai_id: pai });
const cat = (id: string, nome: string, pai: string | null = null): CategoriaBling => ({ bling_id: id, nome, pai_bling_id: pai });
const lig = (b: string, n: string): Ligacao => ({ bling_categoria_id: b, taxonomia_no_id: n });

test("normalizar ignora acento, caixa, apóstrofo tipográfico e espaços", () => {
  assert.equal(normalizar("  Bombas  d’água "), normalizar("bombas d'agua"));
});

test("ligados, faltas no Bling (pai antes do filho) e categorias do Bling sem nó", () => {
  const nos = [no("arr", "Arrefecimento"), no("bomba", "Bombas d'água", "arr"), no("rad", "Radiadores", "arr"), no("eletr", "Elétrica"), no("vela", "Velas", "eletr")];
  const cats = [cat("10", "Arrefecimento"), cat("99", "Brindes")];
  const c = conferir(nos, cats, [lig("10", "arr")]);
  assert.deepEqual(c.ligados.map((p) => p.no.id), ["arr"]);
  assert.deepEqual(c.faltamNoBling.map((f) => f.no.id), ["eletr", "bomba", "rad", "vela"], "áreas de topo antes das subcategorias");
  const bomba = c.faltamNoBling.find((f) => f.no.id === "bomba")!;
  assert.equal(bomba.paiBlingId, "10"); assert.equal(bomba.dependeDoPai, false);
  const vela = c.faltamNoBling.find((f) => f.no.id === "vela")!;
  assert.equal(vela.paiBlingId, null); assert.equal(vela.dependeDoPai, true, "o pai (Elétrica) também falta: criar antes");
  assert.deepEqual(c.blingSemNo.map((x) => x.bling_id), ["99"]);
});

test("sugere ligar por nome igual (sem ligar sozinho) e respeita a mãe quando as duas já estão ligadas", () => {
  const nos = [no("arr", "Arrefecimento"), no("bomba", "Bombas d'água", "arr"), no("rad", "Radiadores", "arr")];
  const cats = [cat("10", "Arrefecimento"), cat("11", "BOMBAS D’ÁGUA", "10"), cat("12", "Radiadores", "77")];
  const c = conferir(nos, cats, [lig("10", "arr")]);
  assert.deepEqual(c.sugestoes.map((s) => [s.no.id, s.categoria.bling_id]), [["bomba", "11"]]);
  assert.deepEqual(c.faltamNoBling.map((f) => f.no.id), ["rad"], "Radiadores existe no Bling, mas sob outra mãe: não é sugerido");
  assert.deepEqual(c.blingSemNo.map((x) => x.bling_id), ["12"]);
});

test("divergência de hierarquia e ligação quebrada (categoria sumiu do Bling)", () => {
  const nos = [no("arr", "Arrefecimento"), no("bomba", "Bombas d'água", "arr")];
  const cats = [cat("10", "Arrefecimento"), cat("11", "Bombas d'água", "55")];
  const c = conferir(nos, cats, [lig("10", "arr"), lig("11", "bomba"), lig("404", "arr")]);
  assert.equal(c.divergencias.length, 1); assert.equal(c.divergencias[0].no.id, "bomba");
  assert.deepEqual(c.ligacoesQuebradas, [lig("404", "arr")]);
});

test("sem dados, tudo vazio; pai '0' do Bling vale como topo", () => {
  assert.deepEqual(conferir([], [], []).faltamNoBling, []);
  const c = conferir([no("arr", "Arrefecimento")], [cat("10", "Arrefecimento", "0")], [lig("10", "arr")]);
  assert.equal(c.divergencias.length, 0);
});
