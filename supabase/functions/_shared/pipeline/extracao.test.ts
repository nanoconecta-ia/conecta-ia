import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anosInformados, candidatosOem, extrair, gtinValido } from "./extracao.ts";

const golden = JSON.parse(readFileSync(new URL("../../../../scripts/catalogo_ia/tests/golden_extracao.json", import.meta.url), "utf8"));

test("extração em TypeScript dá o MESMO resultado que a ferramenta Python (casos de referência compartilhados)", () => {
  for (const c of golden) {
    const e = extrair(c.sku, c.nome, c.descricao, c.marca, c.gtin);
    const x = c.esperado;
    assert.deepEqual(e.codigos_oem.map((o) => [o.normalizado, o.confianca]), x.oem, `${c.id}: oem`);
    assert.deepEqual(e.aplicacao.motores, x.motores, `${c.id}: motores`);
    assert.deepEqual(e.aplicacao.emissoes, x.emissoes, `${c.id}: emissões`);
    assert.deepEqual(e.aplicacao.veiculos_citados, x.veiculos, `${c.id}: veículos`);
    assert.deepEqual(e.aplicacao.anos_informados.map((a) => [a.inicio, a.fim, a.em_aberto]), x.anos, `${c.id}: anos`);
    assert.equal(e.nao_se_aplica, x.nao_se_aplica, `${c.id}: NÃO SE APLICA`);
    assert.deepEqual(e.excluido.motores, x.excluido.motores, `${c.id}: motores excluídos`);
    assert.deepEqual(e.excluido.emissoes, x.excluido.emissoes, `${c.id}: emissões excluídas`);
    assert.deepEqual(e.excluido.anos_informados.map((a) => [a.inicio, a.fim, a.em_aberto]), x.excluido.anos, `${c.id}: anos excluídos`);
    assert.equal(e.gtin ? e.gtin.valido : null, x.gtin_valido, `${c.id}: gtin`);
  }
});

test("o que o NÃO SE APLICA cita nunca vira aplicação", () => {
  const e = extrair("80692", "Jogo de juntas D4CB", "Serve em D4CB Euro V (2013+). NÃO SE APLICA: Motores D4BH Euro III até 2012.");
  assert.deepEqual(e.aplicacao.motores, ["D4CB"]);
  assert.deepEqual(e.aplicacao.emissoes, ["Euro 5"]);
  assert.deepEqual(e.excluido.motores, ["D4BH"]);
});

test("códigos, anos e GTIN: formato sem inventar", () => {
  assert.deepEqual(candidatosOem("codigo 411004h000").map((c) => [c.normalizado, c.confianca]), [["41100-4H000", "baixa"]]);
  assert.equal(candidatosOem("GTIN 7891252806921 NCM 8484.90.00").length, 0);
  assert.deepEqual(anosInformados("ano 2014"), [{ inicio: 2014, fim: null, em_aberto: false, trecho: "2014" }]);
  assert.ok(gtinValido("7891252806921"));
  assert.ok(!gtinValido("7891252806922"));
});
