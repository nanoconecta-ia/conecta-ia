import { test } from "node:test";
import assert from "node:assert/strict";
import { gtinValido, validarRascunho } from "./regras_cadastro.ts";

const F = [{ documento: "Cadastro do Bling" }];
const ctx = { lojaId: "L" };
const base = { codigo: "CI001087", nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" };
const URL_F = [{ url: "https://www.sabo.com.br/catalogo/x" }];

test("rascunho mínimo vale, lista pendências e NÃO inclui fiscal", () => {
  const r = validarRascunho(base, URL_F, ctx);
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  assert.deepEqual(r.proposta.depois, { codigo: "CI001087", nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" });
  assert.ok(r.proposta.pendencias.some((p) => /fiscais/.test(p)) && r.proposta.pendencias.some((p) => /imagens/.test(p)));
  assert.equal(r.proposta.idempotency_key, "cadastro:L:CI001087");
});
test("fiscal, custo, fornecedor e estoque no rascunho são recusados", () => {
  for (const k of ["ncm", "cest", "cfop", "custo", "precoCompra", "fornecedor", "estoque", "margem"]) {
    const r = validarRascunho({ ...base, [k]: "1" }, URL_F, ctx);
    assert.ok(!r.ok, k);
  }
});
test("campo desconhecido e fonte ausente recusam", () => {
  assert.ok(!validarRascunho({ ...base, cor: "azul" }, URL_F, ctx).ok);
  assert.ok(!validarRascunho(base, [], ctx).ok);
});
test("marca inventada ou genérica não passa; marca escrita no nome (declarada) passa", () => {
  assert.ok(!validarRascunho({ ...base, marca: "IMPORTADO" }, URL_F, ctx).ok);
  assert.ok(!validarRascunho({ ...base, marca: "Bosch Premium Line" }, F, ctx).ok);
  const r = validarRascunho({ codigo: "CI001088", nome: "Bomba oleo - MARCA: TRIM GO", marca: "TRIM GO" }, F, ctx);
  assert.ok(r.ok, JSON.stringify(r));
});
test("GTIN com dígito verificador e medidas positivas", () => {
  assert.ok(gtinValido("7891000100103") && !gtinValido("7891000100104") && !gtinValido("123"));
  assert.ok(!validarRascunho({ ...base, gtin: "7891000100104" }, URL_F, ctx).ok);
  assert.ok(!validarRascunho({ ...base, peso_kg: 0 }, URL_F, ctx).ok);
  assert.ok(validarRascunho({ ...base, gtin: "7891000100103", peso_kg: 1.2, largura_cm: 10, altura_cm: 5, profundidade_cm: 8, categoria_bling_id: "123", preco_venda: 99.9, descricao_complementar: "Texto." }, URL_F, ctx).ok);
});
test("preço de venda: sem custo no texto; no máximo 2 casas", () => {
  assert.ok(!validarRascunho({ ...base, preco_venda: 10.123 }, URL_F, ctx).ok);
  assert.ok(!validarRascunho({ ...base, descricao_curta: "custo baixo do fornecedor X" }, URL_F, ctx).ok);
});
test("código inválido e origem inválida recusam", () => {
  assert.ok(!validarRascunho({ ...base, codigo: "a b" }, URL_F, ctx).ok);
  assert.ok(!validarRascunho({ ...base, origem: { tipo: "palpite" } }, URL_F, ctx).ok);
  const r = validarRascunho({ ...base, origem: { tipo: "nota_fiscal", ref: "NF 1234 item 1" } }, URL_F, ctx);
  assert.ok(r.ok && r.proposta.origem.tipo === "nota_fiscal");
});
