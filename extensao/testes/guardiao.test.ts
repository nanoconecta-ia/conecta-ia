import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCampos, ehSensivel, type CampoBruto } from "../src/leitura.ts";
import { MAPA_PRODUTO_BLING } from "../src/mapa-produto.ts";
import { reconhecer } from "../src/reconhecer.ts";
import { sugerir, tagsDaTela } from "../src/sugestoes.ts";
import { estruturaParaRegistro } from "../src/registro.ts";

const c = (rotulo: string, valor = "", extra: Partial<CampoBruto> = {}): CampoBruto => ({ rotulo, tipo: "text", valor, visivel: true, ...extra });
const telaProduto = [
  c("Nome", "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas"), c("Código (SKU)", "CI000016"), c("GTIN/EAN"), c("Marca", "TRIM GO AUTOPARTS"),
  c("Descrição curta"), c("Peso líquido (kg)"), c("Peso bruto (kg)"), c("Categoria", "Arrefecimento"), c("Tags"),
  c("Preço de compra", "41,90"), c("Fornecedor", "Distribuidora X"), c("NCM", "8413.30.90"), c("Senha", "x", { tipo: "password" }), c("Interno", "1", { tipo: "hidden" }),
];

test("leitura: senha/oculto nunca lidos; custo, fornecedor e fiscal mascarados (sem valor)", () => {
  const l = lerCampos(telaProduto);
  assert.ok(!l.some((x) => x.rotulo === "Senha" || x.rotulo === "Interno"));
  for (const r of ["Preço de compra", "Fornecedor", "NCM"]) { const x = l.find((y) => y.rotulo === r)!; assert.equal(x.mascarado, true, r); assert.equal(x.valor, "", r); }
  assert.equal(ehSensivel("Preço de venda"), false);
  assert.equal(ehSensivel("Custo médio"), true);
});

test("reconhecimento: cadastro de produto reconhecido pelo mapa v0 (a confirmar), com vazios e não mapeados", () => {
  const r = reconhecer(lerCampos(telaProduto), MAPA_PRODUTO_BLING);
  assert.equal(r.estado, "reconhecida");
  assert.equal(r.mapaConferido, false);
  assert.deepEqual(r.vazios.map((v) => v.mapa.canonico).sort(), ["descricaoCurta", "gtin", "pesoBruto", "pesoLiquido", "tags"]);
  assert.ok(r.naoMapeados.some((x) => x.rotulo === "Fornecedor"));
  assert.ok(!r.casados.some((x) => x.mapa.canonico === "preco"), "Preço de compra (sensível) não casa com Preço de venda");
});

test("tela que não é cadastro de produto fica desconhecida e o Nano não sugere nada", () => {
  const r = reconhecer(lerCampos([c("E-mail", "a@b.c"), c("Telefone", "11 9999"), c("Nome", "Cliente")]), MAPA_PRODUTO_BLING);
  assert.equal(r.estado, "desconhecida");
  assert.deepEqual(sugerir(r), { sugestoes: [], pendencias: [] });
});

test("sugestões: tags só a partir do que está na tela; GTIN/peso viram pendência com exigência de fonte, nunca valor", () => {
  const { sugestoes, pendencias } = sugerir(reconhecer(lerCampos(telaProduto), MAPA_PRODUTO_BLING));
  assert.equal(sugestoes.length, 1);
  assert.equal(sugestoes[0].campo, "tags");
  assert.equal(sugestoes[0].aplicavel, false);
  assert.match(sugestoes[0].valor, /bomba.*trim go autoparts.*ci000016/);
  const gtin = pendencias.find((p) => p.campo === "GTIN/EAN")!;
  assert.match(gtin.motivo, /fonte verificável/);
  assert.ok(!pendencias.some((p) => /Preço|Estoque|Código/.test(p.campo)), "campos só leitura não viram pendência do Nano");
});

test("tags: sem palavras curtas/vazias, sem repetir, até 12, junta modelo+número", () => {
  const t = tagsDaTela("Jogo de juntas do motor HR 2.5 16V Sabó", "Sabó", "85310");
  assert.ok(t.includes("juntas") && t.includes("sabo") && t.includes("85310"));
  assert.ok(!t.includes("de") && !t.includes("jogo"));
  assert.ok(t.length <= 12 && new Set(t).size === t.length);
});

test("registrar esta tela: exporta estrutura (rótulo, tipo, id, preenchido) e NUNCA valores", () => {
  const lidos = lerCampos(telaProduto);
  const e = estruturaParaRegistro({ origem: "https://erp.exemplo", caminho: "/produtos", titulo: "Produto", campos: lidos }, reconhecer(lidos, MAPA_PRODUTO_BLING));
  const json = JSON.stringify(e);
  for (const v of ["CI000016", "TRIM GO AUTOPARTS", "41,90", "Distribuidora X", "8413.30.90", "Arrefecimento"]) assert.ok(!json.includes(v), `vazou ${v}`);
  assert.equal(e.campos.find((x) => x.rotulo === "Nome")!.preenchido, true);
  assert.equal(e.campos.find((x) => x.rotulo === "Fornecedor")!.preenchido, null);
  assert.equal(e.campos.find((x) => x.rotulo === "Marca")!.casou_com, "marca");
});
