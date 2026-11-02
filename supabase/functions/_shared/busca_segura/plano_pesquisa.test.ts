import { test } from "node:test";
import assert from "node:assert/strict";
import { limparTexto, ORCAMENTO_PADRAO, planejarConsultas, reformular, type DadosProduto } from "./plano_pesquisa.ts";

const base: DadosProduto = { sku: "CI000016", oem: ["25100-42000"], gtin: "7891000100103", marca: "TRIM GO", descricao: "Bomba d'água", peca: "bomba d'água", motor: "4D56", veiculo: "Hyundai HR", ano: 2009, categoria: "arrefecimento" };

test("as etapas saem na ordem: código/SKU, OEM, GTIN, descrição+motor+veículo, catálogos alternativos, imagens", () => {
  const p = planejarConsultas(base, { max_consultas: 20, max_por_etapa: 5 });
  assert.deepEqual(p.consultas.map((c) => c.etapa), ["codigo_fabricante", "oem", "gtin", "descricao_motor_veiculo", "catalogos_alternativos", "imagens"]);
  assert.equal(p.consultas.at(-1)!.alvo, "imagens");
  assert.match(p.consultas[0].texto, /"CI000016"/);
  assert.match(p.consultas[4].texto, /Urba OR Schadek OR Indisa/);
});
test("SKU interno NÃO é tratado como código de fabricante nem OEM, e isso vem avisado", () => {
  const p = planejarConsultas({ ...base, codigo_fabricante: null }, { max_consultas: 20, max_por_etapa: 5 });
  assert.ok(p.avisos.some((a) => /NÃO é tratado como código de fabricante nem como OEM/.test(a)));
  assert.ok(p.consultas.find((c) => c.etapa === "codigo_fabricante")!.observacao?.includes("SKU interno"));
});
test("código de fabricante conhecido entra primeiro, antes do SKU", () => {
  const p = planejarConsultas({ ...base, codigo_fabricante: "90000472" }, { max_consultas: 20, max_por_etapa: 5 });
  assert.match(p.consultas[0].texto, /"90000472"/); assert.match(p.consultas[1].texto, /"CI000016"/);
});
test("o orçamento limita o total e por etapa, sem busca infinita, e avisa o que ficou de fora", () => {
  const p = planejarConsultas({ ...base, oem: ["A-1", "B-2", "C-3", "D-4"] });
  assert.ok(p.consultas.length <= ORCAMENTO_PADRAO.max_consultas);
  assert.ok(p.consultas.filter((c) => c.etapa === "oem").length <= ORCAMENTO_PADRAO.max_por_etapa);
  assert.ok(p.omitidas > 0 && p.avisos.some((a) => /fora do orçamento/.test(a)));
});
test("GTIN com dígito verificador inválido não é pesquisado; sem GTIN não há etapa de GTIN", () => {
  assert.ok(!planejarConsultas({ ...base, gtin: "7891000100104" }).consultas.some((c) => c.etapa === "gtin"));
  assert.ok(planejarConsultas({ ...base, gtin: "7891000100104" }).avisos.some((a) => /dígito verificador inválido/.test(a)));
  assert.ok(!planejarConsultas({ ...base, gtin: null }).consultas.some((c) => c.etapa === "gtin"));
});
test("custo, fornecedor, fiscal e dados pessoais NUNCA vão para as consultas", () => {
  const sujo: DadosProduto = { ...base, descricao: "Bomba d'água\nFornecedor cadastrado: DISTRIBUIDORA X\nPreço de compra: 110,48\nNCM 8413.30.90\ncontato fulano@x.com", peca: null };
  const p = planejarConsultas(sujo, { max_consultas: 20, max_por_etapa: 5 });
  const tudo = JSON.stringify(p.consultas);
  for (const proibido of ["DISTRIBUIDORA X", "110,48", "8413.30.90", "fulano@x.com", "Fornecedor", "compra"]) assert.ok(!tudo.includes(proibido), proibido);
  assert.equal(limparTexto("Marca: X | Custo: 5 | Peça Y"), "Marca: X Peça Y");
});
test("consultas duplicadas são removidas", () => {
  const p = planejarConsultas({ ...base, codigo_fabricante: "CI000016" }, { max_consultas: 20, max_por_etapa: 5 });
  assert.equal(p.consultas.filter((c) => c.etapa === "codigo_fabricante").length, 1);
});
test("reformulação usa só sinônimos fornecidos como dado, respeita o orçamento e não repete consulta feita", () => {
  const sin = { "bomba d'agua": ["water pump", "bomba de água do motor"] };
  const r = reformular(base, sin, ["water pump 4D56 Hyundai HR"], 5);
  assert.deepEqual(r.map((c) => c.texto), ["bomba de água do motor 4D56 Hyundai HR"]);
  assert.equal(r[0].etapa, "reformulacao");
  assert.deepEqual(reformular(base, sin, [], 0), []);
  assert.deepEqual(reformular({ ...base, peca: "junta" }, sin, [], 5), [], "sem sinônimo para a peça = sem reformulação inventada");
});
