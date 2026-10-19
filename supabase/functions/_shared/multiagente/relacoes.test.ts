import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarClasse, podePromover, sugerirHipotese, tetoDaRelacao } from "./relacoes.ts";

const cat = { tipo: "catalogo" as const, fonte: "https://x.invalid/c", data: "2026-10-19" };
test("semelhança de descrição NUNCA gera relação: no máximo uma hipótese a investigar", () => {
  const s = sugerirHipotese("Bomba de óleo HR 2.5 16V D4CB alumínio", "Bomba de oleo HR 2.5 16V D4CB aluminio");
  assert.equal(s.relacao, "hipotese");
  assert.ok(s.similaridade >= 0.9);
  assert.equal(tetoDaRelacao([{ tipo: "descricao", fonte: "texto", data: "2026-10-19" }]).tipo, "hipotese", "descrição idêntica ainda é só hipótese");
  assert.ok(!podePromover("referencia_cruzada", [{ tipo: "descricao" }]).ok);
  assert.ok(!podePromover("equivalente_validado", [{ tipo: "descricao", fonte: "a", data: "b" }]).ok);
  assert.equal(sugerirHipotese("Bomba de óleo", "Pastilha de freio dianteira").relacao, null);
});

test("cada tipo de relação tem teto definido pelo tipo de evidência", () => {
  assert.equal(tetoDaRelacao([cat]).tipo, "referencia_cruzada");
  assert.ok(!podePromover("equivalente_validado", [cat]).ok, "catálogo não valida");
  assert.ok(!podePromover("substituto_homologado", [cat, { tipo: "especificacao", fonte: "f", data: "d" }]).ok, "especificação não homologa");
  assert.equal(tetoDaRelacao([cat, { tipo: "especificacao", fonte: "f", data: "d" }]).tipo, "equivalencia_funcional");
  assert.equal(tetoDaRelacao([cat, { tipo: "ensaio", documento: "relatório 123", data: "2026-10-01" }]).tipo, "equivalente_validado");
  assert.equal(tetoDaRelacao([{ tipo: "homologacao", documento: "ato 77", data: "2026-01-01" }]).tipo, "substituto_homologado");
  assert.equal(tetoDaRelacao([{ tipo: "ensaio", documento: "sem data" }]).tipo, "hipotese", "evidência sem data não vale");
  assert.ok(podePromover("hipotese", []).ok);
});

test("classe da peça: cada classe exige a evidência da própria classe", () => {
  const base = { codigoPertenceAMontadora: false, vendidaSobMarcaDaMontadora: false, evidencias: [] };
  assert.equal(classificarClasse({ ...base, codigoPertenceAMontadora: true, vendidaSobMarcaDaMontadora: true, evidencias: [cat] }).classe, "genuina");
  assert.equal(classificarClasse({ ...base, codigoPertenceAMontadora: true, vendidaSobMarcaDaMontadora: true, evidencias: [] }).classe, "a_confirmar", "genuína sem catálogo");
  assert.equal(classificarClasse({ ...base, evidencias: [{ tipo: "descricao", fonte: "o texto diz original", data: "d" }] }).classe, "a_confirmar", "'original' no texto não basta");
  const oem = classificarClasse({ ...base, fornecimentoOriginal: { tipo: "primeiro_equipamento", aprovado: true, documento: "contrato X" }, evidencias: [{ tipo: "fornecimento_original", documento: "contrato X", data: "2026-01-01" }] });
  assert.equal(oem.classe, "oem_primeiro_equipamento");
  assert.equal(classificarClasse({ ...base, fornecimentoOriginal: { tipo: "oes", aprovado: false }, evidencias: [{ tipo: "fornecimento_original", documento: "d", data: "d" }] }).classe, "a_confirmar", "fornecimento não aprovado não vira OEM");
  assert.equal(classificarClasse({ ...base, evidencias: [{ tipo: "catalogo_comercial_fabricante", fonte: "https://fab.invalid", data: "2026-10-19" }] }).classe, "aftermarket_equivalente");
  assert.equal(classificarClasse({ ...base, fornecimentoOriginal: { tipo: "oes", aprovado: true, documento: "d" }, evidencias: [{ tipo: "fornecimento_original", documento: "d", data: "x" }] }).classe, "oes");
});
