import { test } from "node:test";
import assert from "node:assert/strict";
import { marcaGenerica, validarMarca } from "./regras_marca.ts";

const nome = "BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V 26 DTS ALUMINIO - MARCA: TRIM GO";
test("termos de origem ou genéricos nunca são marca", () => {
  for (const m of ["IMPORTADO", "nacional", "Genérico", "ORIGINAL", "similar", "China", "OEM", "sem marca", "Premium", "", null, " MARCA: IMPORTADO"]) assert.equal(marcaGenerica(m), true, String(m));
  for (const m of ["TRIM GO", "SABÓ", "Mahle", "NGK"]) assert.equal(marcaGenerica(m), false, m);
});
test("marca escrita no próprio cadastro/nota vale como DECLARADA, não verificada (caso CI001086)", () => {
  const r = validarMarca("TRIM GO", [{ documento: "Cadastro do próprio Bling" }], { textosDoCadastro: [nome] });
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.evidencia, "declarada_no_cadastro"); assert.equal(r.verificada, false); assert.match(r.aviso ?? "", /verificação independente/);
});
test("marca que NÃO está no cadastro e sem fonte é recusada: o agente não chuta nome de marca", () => {
  const r = validarMarca("Bosch Premium Line", [{ documento: "Cadastro do próprio Bling" }], { textosDoCadastro: [nome] });
  assert.equal(r.ok, false); if (!r.ok) assert.match(r.erro, /Sem evidência/);
  assert.equal(validarMarca("Mahle", [], { textosDoCadastro: [nome] }).ok, false);
});
test("URL https externa é evidência; http, vazio ou lixo não são", () => {
  assert.ok(validarMarca("Mahle", [{ url: "https://www.mahle.com.br/catalogo/x" }], { textosDoCadastro: [] }).ok);
  for (const url of ["http://mahle.com.br/x", "mahle", "javascript:alert(1)", ""]) assert.equal(validarMarca("Mahle", [{ url }], { textosDoCadastro: [] }).ok, false, url);
});
test("documento descrito só vale quando quem pede é uma PESSOA e não é boilerplate", () => {
  const f = [{ documento: "Etiqueta da embalagem fotografada em 02/11" }];
  assert.equal(validarMarca("Sabó", f, { textosDoCadastro: [] }).ok, false, "modelo/LLM não pode se auto-citar");
  const r = validarMarca("Sabó", f, { textosDoCadastro: [], porPessoa: true });
  assert.ok(r.ok && r.evidencia === "documento_da_pessoa");
  assert.equal(validarMarca("Sabó", [{ documento: "Pedido do lojista no chat do Nano.ia" }], { textosDoCadastro: [], porPessoa: true }).ok, false);
});
test("marca com HTML, curta demais, longa demais ou genérica é recusada; prefixo MARCA: é removido", () => {
  for (const m of ["<b>Mahle</b>", "M", "x".repeat(81), "IMPORTADO"]) assert.equal(validarMarca(m, [{ url: "https://a.com.br/x" }], { textosDoCadastro: [] }).ok, false, m);
  const r = validarMarca(" MARCA: TRIM GO", [], { textosDoCadastro: [nome] });
  assert.ok(r.ok && r.marca === "TRIM GO");
});
test("palavra parcial não conta: 'GO' não está em 'ALGO'; marca precisa aparecer inteira", () => {
  assert.equal(validarMarca("GO", [], { textosDoCadastro: ["PECA ALGO NOVA"] }).ok, false);
  assert.equal(validarMarca("TRIM", [], { textosDoCadastro: ["PECA TRIMESTRAL"] }).ok, false);
});

import { conflitoDeMarca } from "./regras_marca.ts";
test("conflitoDeMarca: mesma marca com outra grafia não é conflito; marca diferente é", () => {
  assert.equal(conflitoDeMarca(" MARCA: TRIM GO", "TRIM GO").conflito, false);
  assert.equal(conflitoDeMarca("SABÓ", "Sabo").conflito, false);
  assert.equal(conflitoDeMarca("Sabó", "Jusa").conflito, true);
  assert.equal(conflitoDeMarca("", "Jusa").conflito, false);
  assert.equal(conflitoDeMarca(null, "Jusa").atual, null);
});
