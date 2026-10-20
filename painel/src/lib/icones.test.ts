import { test } from "node:test";
import assert from "node:assert/strict";
import { PECAS, TIPOS_VEICULO, iconeDaCategoria, tipoDeVeiculo } from "./icones.ts";

const SLUGS = ["motor", "suspensao-direcao", "freios", "filtros", "eletrica-ignicao", "arrefecimento", "escapamento", "embreagem-transmissao", "iluminacao", "lubrificantes-fluidos", "carroceria-acabamento", "alimentacao-injecao",
  "bicos-injetores", "bombas-agua", "embreagens-viscosas", "radiadores", "valvulas-termostaticas", "baterias", "sensores", "velas", "kits-embreagem", "rolamentos", "catalisadores", "silenciosos", "filtro-ar", "filtro-oleo",
  "cilindros-flexiveis", "discos", "lonas-tambores", "pastilhas", "farois-lanternas", "lampadas", "oleos-motor", "bielas", "bomba-oleo", "cabecote-valvulas", "correias-tensores", "juntas-retentores", "pistoes-aneis",
  "amortecedores", "barras-estabilizadoras", "buchas-batentes", "molas", "pivos-terminais", "paralamas-parachoques", "retrovisores", "bombas-combustivel", "fluidos-freio-arrefecimento"];

test("todo slug da taxonomia de autopeças resolve para um ícone desenhado e específico", () => {
  for (const s of SLUGS) { const k = iconeDaCategoria(s); assert.ok((PECAS as readonly string[]).includes(k), s); assert.notEqual(k, "todas", `${s} caiu no genérico`); }
});

test("áreas mantêm o ícone próprio; subcategoria usa o da área (ou o dela, se existir)", () => {
  assert.equal(iconeDaCategoria("suspensao-direcao"), "suspensao");
  assert.equal(iconeDaCategoria("amortecedores"), "suspensao");
  assert.equal(iconeDaCategoria("velas"), "vela");
  assert.equal(iconeDaCategoria("pastilhas"), "freios");
});

test("slug desconhecido usa o nome; sem pista, 'todas'", () => {
  assert.equal(iconeDaCategoria("xyz", "Suspensão dianteira"), "suspensao");
  assert.equal(iconeDaCategoria("xyz", "Escapamento esportivo"), "escapamento");
  assert.equal(iconeDaCategoria(null, null), "todas");
  assert.equal(iconeDaCategoria("qualquer", "Coisa estranha"), "todas");
});

test("os 6 tipos de veículo têm símbolo e chave única", () => {
  assert.equal(TIPOS_VEICULO.length, 6);
  assert.equal(new Set(TIPOS_VEICULO.map((t) => t.chave)).size, 6);
  for (const t of TIPOS_VEICULO) assert.match(t.simbolo, /^v-/);
});

test("categoria do banco vira o desenho certo (van e furgão iguais; utilitário e suv iguais)", () => {
  assert.equal(tipoDeVeiculo("picape")?.chave, "picape");
  assert.equal(tipoDeVeiculo("van")?.chave, "furgao");
  assert.equal(tipoDeVeiculo("Furgao")?.chave, "furgao");
  assert.equal(tipoDeVeiculo("utilitario")?.chave, "suv");
  assert.equal(tipoDeVeiculo("passeio")?.chave, "passeio");
  assert.equal(tipoDeVeiculo("trator"), null);
  assert.equal(tipoDeVeiculo(null), null);
});
