import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaCompativel, montarFicha, periodo } from "./ficha.ts";

const p = { nome: "Motor parcial", sku: "CI003109", marca: "Trim Go", preco: 18900, descricao: null, imagem: "https://x/y.png", whatsapp: null };
test("período: intervalo, aberto e único", () => {
  assert.equal(periodo(2012, 2016), "2012–2016"); assert.equal(periodo(2012, 2012), "2012"); assert.equal(periodo(2012, null), "2012 em diante"); assert.equal(periodo(null, 2010), "até 2010"); assert.equal(periodo(null, null), null);
});
test("ficha com aplicações aprovadas: título, veículos, spec e compatibilidade", () => {
  const f = montarFicha(p, [
    { modelo: "Ranger", motor: "2.2 16V diesel", de: 2012, ate: null, tipo: "picape" },
    { modelo: "Transit", motor: "2.2 16V diesel", de: 2012, ate: 2020, tipo: "furgao" },
    { modelo: "Transit", motor: "2.2 16V diesel", de: 2012, ate: 2020, tipo: "furgao" },
  ]);
  assert.equal(f.codigo, "CI003109"); assert.equal(f.veiculos, "Ranger / Transit"); assert.equal(f.spec, "2.2 16V diesel · 2012–2020");
  assert.deepEqual(f.compativel, ["Ranger · 2.2 16V diesel · 2012 em diante", "Transit · 2.2 16V diesel · 2012–2020"]);
  assert.deepEqual(f.tipos, ["picape", "furgao"]); assert.deepEqual(f.aConfirmar, []);
});
test("sem aplicação aprovada: nada inventado, marca o que falta", () => {
  const f = montarFicha({ ...p, imagem: null }, []);
  assert.equal(f.veiculos, null); assert.equal(f.spec, null); assert.deepEqual(f.compativel, []); assert.deepEqual(f.aConfirmar, ["compatibilidade", "foto"]);
  assert.equal(linhaCompativel({ modelo: "X", motor: null, de: null, ate: null, tipo: null }), "X");
});
test("mais de 3 modelos viram 'e outros'", () => {
  const f = montarFicha(p, ["A", "B", "C", "D"].map((m) => ({ modelo: m, motor: null, de: null, ate: null, tipo: null })));
  assert.equal(f.veiculos, "A / B / C e outros");
});
