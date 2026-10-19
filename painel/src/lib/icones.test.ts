import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONES, TIPOS_VEICULO, iconeDaCategoria } from "./icones.ts";

test("todo slug da taxonomia de autopeças resolve para um ícone que existe", () => {
  const slugs = ["motor", "suspensao-direcao", "freios", "filtros", "eletrica-ignicao", "arrefecimento", "escapamento", "embreagem-transmissao", "iluminacao", "lubrificantes-fluidos", "carroceria-acabamento", "alimentacao-injecao",
    "bicos-injetores", "bombas-agua", "embreagens-viscosas", "radiadores", "valvulas-termostaticas", "baterias", "sensores", "velas", "kits-embreagem", "rolamentos", "catalisadores", "silenciosos", "filtro-ar", "filtro-oleo",
    "cilindros-flexiveis", "discos", "lonas-tambores", "pastilhas", "farois-lanternas", "lampadas", "oleos-motor", "bielas", "bomba-oleo", "cabecote-valvulas", "correias-tensores", "juntas-retentores", "pistoes-aneis",
    "amortecedores", "barras-estabilizadoras", "buchas-batentes", "molas", "pivos-terminais", "paralamas-parachoques", "retrovisores", "bombas-combustivel", "fluidos-freio-arrefecimento"];
  for (const s of slugs) { const k = iconeDaCategoria(s); assert.ok(ICONES[k], s); assert.notEqual(k, "peca", `${s} caiu no genérico`); }
});

test("slug desconhecido usa o nome; sem pista, peça genérica", () => {
  assert.equal(iconeDaCategoria("xyz", "Suspensão dianteira"), "suspensao");
  assert.equal(iconeDaCategoria("xyz", "Escapamento esportivo"), "escapamento");
  assert.equal(iconeDaCategoria(null, null), "peca");
  assert.equal(iconeDaCategoria("qualquer", "Coisa estranha"), "peca");
});

test("tipos de veículo têm ícone desenhado", () => {
  for (const t of TIPOS_VEICULO) assert.ok(ICONES[t.chave], t.chave);
});

test("todo ícone tem traço e só usa comandos de caminho válidos", () => {
  for (const [k, d] of Object.entries(ICONES)) { assert.ok(d.s.length > 10, k); assert.match(d.s, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/, k); if (d.f) assert.match(d.f, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/, k); }
});
