// Testes de aceite 3 e 5 do PR #242.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarIntercambio, compararMedidas } from "./intercambio.ts";
import { espessuraPorPiques, type TabelaPiques } from "./piques.ts";

test("aceite 3: OEM igual mas dimensões divergem -> intercâmbio REJEITADO e relação incompatível", () => {
  const r = avaliarIntercambio({ oemA: "20910-4AU07", oemB: "209104AU07", medidasA: { diametro_mm: 91.0, espessura_mm: 1.2 }, medidasB: { diametro_mm: 91.0, espessura_mm: 1.6 }, declarada: "equivalente", direcao: "bidirecional", evidenciaForte: true });
  assert.equal(r.decisao, "rejeitada"); assert.equal(r.relacao_registrada, "incompativel");
  assert.ok(r.motivos.some((m) => /OEM coincide/.test(m)) && r.motivos.some((m) => /espessura_mm/.test(m)));
});
test("OEM igual sem medidas dos dois lados: pendente, nunca confirmável", () => {
  const r = avaliarIntercambio({ oemA: "A1", oemB: "A1", declarada: "equivalente", direcao: "a_para_b", evidenciaForte: true });
  assert.equal(r.decisao, "pendente_medidas"); assert.equal(r.relacao_registrada, "semelhante");
});
test("material diferente (metal x fibra) é divergência; dentes exigem igualdade exata", () => {
  assert.ok(compararMedidas({ material: "metal" }, { material: "Fibra" }).divergencias.length === 1);
  assert.ok(compararMedidas({ dentes: 120 }, { dentes: 121 }).divergencias.length === 1);
  assert.equal(compararMedidas({ espessura_mm: 1.2 }, { espessura_mm: 1.23 }).divergencias.length, 0, "tolerância de 0,05 mm");
});
test("medidas conferem + evidência forte: confirmável (por uma pessoa); sem evidência forte: candidata; semelhante nunca vira equivalente", () => {
  const base = { oemA: "A1", oemB: "B2", medidasA: { diametro_mm: 91, espessura_mm: 1.2, material: "metal" }, medidasB: { diametro_mm: 91, espessura_mm: 1.2, material: "metal" }, direcao: "bidirecional" as const };
  assert.equal(avaliarIntercambio({ ...base, declarada: "equivalente", evidenciaForte: true }).decisao, "confirmavel");
  assert.equal(avaliarIntercambio({ ...base, declarada: "equivalente", evidenciaForte: false }).decisao, "candidata");
  const s = avaliarIntercambio({ ...base, declarada: "semelhante", evidenciaForte: true });
  assert.equal(s.decisao, "candidata"); assert.equal(s.relacao_registrada, "semelhante");
});
test("dado faltando de um lado impede 'confirmável' e a direção é registrada", () => {
  const r = avaliarIntercambio({ oemA: "A1", oemB: "B2", medidasA: { diametro_mm: 91, espessura_mm: 1.2 }, medidasB: { diametro_mm: 91 }, declarada: "substitui", direcao: "a_para_b", evidenciaForte: true });
  assert.equal(r.decisao, "candidata"); assert.equal(r.direcao, "a_para_b"); assert.ok(r.comparacao.sem_dado.includes("espessura_mm"));
});
test("declarada incompatível sempre rejeita", () => {
  assert.equal(avaliarIntercambio({ oemA: "A", oemB: "B", declarada: "incompativel", direcao: "bidirecional", evidenciaForte: true }).decisao, "rejeitada");
});

const alvoJ = { fabricante: "Sabó", produto: "Junta do cabeçote HR 2.5" };
const tabela: TabelaPiques = { fabricante: "Sabó", produto: "Junta do cabeçote HR 2.5", fonte_url: "https://fabricante.exemplo.com.br/tabela-piques.pdf", linhas: [{ piques: 1, espessura_mm: 1.25 }, { piques: 2, espessura_mm: 1.35 }] };
test("aceite 5: piques sem tabela -> espessura PENDENTE, nunca inferida", () => {
  const r = espessuraPorPiques(2, alvoJ, null);
  assert.equal(r.estado, "pendente"); assert.match((r as { motivo: string }).motivo, /não inferida/);
});
test("piques com tabela do fabricante e do produto certos: determinada, com a fonte", () => {
  const r = espessuraPorPiques(2, alvoJ, tabela);
  assert.deepEqual(r, { estado: "determinada", espessura_mm: 1.35, fonte_url: tabela.fonte_url });
});
test("tabela de outro fabricante/produto, sem https, piques ausentes ou duplicados -> pendente", () => {
  assert.equal(espessuraPorPiques(2, { fabricante: "Outra", produto: alvoJ.produto }, tabela).estado, "pendente");
  assert.equal(espessuraPorPiques(2, { fabricante: "Sabó", produto: "Outra junta" }, tabela).estado, "pendente");
  assert.equal(espessuraPorPiques(2, alvoJ, { ...tabela, fonte_url: "http://x" }).estado, "pendente");
  assert.equal(espessuraPorPiques(3, alvoJ, tabela).estado, "pendente");
  assert.equal(espessuraPorPiques(1, alvoJ, { ...tabela, linhas: [...tabela.linhas, { piques: 1, espessura_mm: 1.5 }] }).estado, "pendente");
  assert.equal(espessuraPorPiques(-1, alvoJ, tabela).estado, "pendente");
});
