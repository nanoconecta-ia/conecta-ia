import { test } from "node:test";
import assert from "node:assert/strict";
import { acentoMontadora, CORES_MOBIS_SHOWROOM, faixasPublicasPorAplicacao, identidadeDaMontadora, rotuloOemConjunto } from "./showroomMobis.ts";

test("paleta fixa da Mobis; azul e vermelho Kia são apenas acentos de aplicação", () => {
  assert.equal(CORES_MOBIS_SHOWROOM.vermelho, "#E2181A");
  assert.equal(CORES_MOBIS_SHOWROOM.grafite, "#1F2327");
  assert.equal(acentoMontadora("hyundai"), "#1877F2");
  assert.notEqual(acentoMontadora("kia"), acentoMontadora("hyundai"));
});
test("reconhece HR e Bongo sem misturar fabricante do veículo e da peça", () => {
  assert.equal(identidadeDaMontadora("Hyundai HR"), "hyundai");
  assert.equal(identidadeDaMontadora("HR 2.5"), "hyundai");
  assert.equal(identidadeDaMontadora("Kia Bongo K2500"), "kia");
  assert.equal(identidadeDaMontadora("Bongo K2500"), "kia");
  assert.equal(identidadeDaMontadora("TRIM GO"), "neutra");
});
test("mesmo SKU gera faixas distintas somente para aplicações aprovadas indexáveis", () => {
  const x = faixasPublicasPorAplicacao([
    { slug: "ci003696-hyundai-hr", modelo: "Hyundai HR", titulo: "Motor D4CB", status: "aprovado", indexavel: true },
    { slug: "ci003696-bongo", modelo: "Kia Bongo K2500", titulo: "Motor D4CB", status: "aprovado", indexavel: true },
    { slug: "ci003696-bongo", modelo: "Kia Bongo K2500", titulo: "Duplicado", status: "aprovado", indexavel: true },
  ]);
  assert.equal(x.length, 2);
  assert.notEqual(x[0].destino, x[1].destino);
  assert.equal(x[0].montadora, "hyundai");
  assert.equal(x[1].montadora, "kia");
});
test("candidata pendente, não indexável e sem slug nunca cria banner de produto", () => {
  assert.deepEqual(faixasPublicasPorAplicacao([
    { slug: "hr", modelo: "Hyundai HR", titulo: "A confirmar", status: "a_confirmar" },
    { slug: "bongo", modelo: "Kia Bongo K2500", titulo: "Pendente", status: "aprovado", indexavel: false },
    { slug: "", modelo: "HR", titulo: "Sem rota", status: "aprovado" },
  ]), []);
});
test("código OEM candidato não vira OEM homologado na vitrine", () => {
  assert.equal(rotuloOemConjunto("2J0224AU00A", false), "Referência OEM do conjunto em validação");
  assert.equal(rotuloOemConjunto(null, true), "Referência OEM do conjunto em validação");
  assert.equal(rotuloOemConjunto("OEM-PROVADO", true), "OEM-PROVADO");
});
