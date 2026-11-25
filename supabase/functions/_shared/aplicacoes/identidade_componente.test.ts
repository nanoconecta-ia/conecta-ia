import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverIdentidadeDeComponente, type ReferenciaOemPesquisa } from "./identidade_componente.ts";
const oem = (codigo: string): ReferenciaOemPesquisa => ({
  codigo, estado: "verificado_no_epc", fonte_url: "https://partsouq.com/en/catalog/genuine/unit?id=exemplo",
  descricao_fonte: "EPC Bongo ilustrativo - DADOS FICTICIOS DE TESTE",
  motor: "D4CB", modelo: "Bongo K2500", mercado: "EUR", ano_modelo: 2014,
  diagrama: "CAMSHAFT & VALVE", posicao_diagrama: "24100B", versao_confirmada: true,
});
const base = { sku_bl: null, sku_bl_confirmado: false, sku_nf: null, sku_nf_confirmado: false, codigo_fabricante: null };
test("SKU do Bling se mantem fisico e OEM fica como referencia separada", () => {
  const r = resolverIdentidadeDeComponente({ ...base, sku_bl: "CI123", sku_bl_confirmado: true, oems: [oem("24100-4A100")] });
  assert.equal(r.tipo, "sku_bling");
  assert.equal(r.chave_indice, "SKU:CI123");
  assert.equal(r.sku_fiscal, "CI123");
  assert.ok(r.oems_candidatos.includes("241004A100"));
});
test("SKU comprovado de NF sem cadastro Bling nao cria SKU do ERP", () => {
  const r = resolverIdentidadeDeComponente({ ...base, sku_nf: "nf-123", sku_nf_confirmado: true, oems: [] });
  assert.equal(r.tipo, "sku_nota_fiscal");
  assert.equal(r.sku_fiscal, "nf-123");
  assert.equal(r.chave_indice, "SKU_NF:NF123");
});
test("sem SKU e com um OEM EPC contextualizado: alias de busca, NUNCA SKU fiscal", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems: [oem("24100-4A100")] });
  assert.equal(r.tipo, "oem_referencia_tecnica");
  assert.equal(r.chave_indice, "OEM:241004A100");
  assert.equal(r.sku_fiscal, null);
  assert.equal(r.necessita_revisao, true);
});
test("candidato sem variante comprovada nao vira identidade principal", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems: [{...oem("22100-4A700"),estado:"candidato"}] });
  assert.equal(r.chave_indice, null);
  assert.deepEqual(r.oems_candidatos, ["221004A700"]);
});
test("OEMs de medidas e versoes diferentes ficam ambiguos", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems: [oem("22311-4A100"), oem("22311-4A110")] });
  assert.equal(r.chave_indice, null);
  assert.match(r.motivo, /Multiplos OEMs/);
});
test("numero sem fonte e diagrama nao se torna OEM verificado", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems: [{...oem("23111-4A701"),fonte_url:"",posicao_diagrama:null}] });
  assert.equal(r.tipo, "pendente");
});
test("SKU de NF NAO CONFIRMADO deve ser ignorado", () => {
  const r = resolverIdentidadeDeComponente({ ...base, sku_nf:"NF-FICTICIA",oems:[] });
  assert.equal(r.chave_indice, null);
  assert.equal(r.sku_fiscal, null);
});
test("referencia rejeitada nao aparece na pesquisa", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems: [{...oem("11111-00000"),estado:"rejeitado"}] });
  assert.deepEqual(r.oems_candidatos, []);
});
test("ausencia completa conserva pendencia, nao gera codigo", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems:[] });
  assert.equal(r.tipo,"pendente");
  assert.equal(r.chave_indice,null);
});

test("SKU alegado mas não conferido no Bling não pode substituir OEM de referência", () => {
  const r = resolverIdentidadeDeComponente({ ...base, sku_bl:"CI000000",sku_bl_confirmado:false, oems:[oem("24100-4A100")] });
  assert.equal(r.tipo, "oem_referencia_tecnica");
  assert.equal(r.sku_fiscal,null);
});
test("ano de modelo inválido não passa como EPC confirmado", () => {
  const r = resolverIdentidadeDeComponente({ ...base, oems:[{...oem("24100-4A100"),ano_modelo:0}] });
  assert.equal(r.tipo, "pendente");
});
