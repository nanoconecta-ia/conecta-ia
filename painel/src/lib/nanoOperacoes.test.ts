import { test } from "node:test";
import assert from "node:assert/strict";
import { autorizarOperacao, prepararPropostaCadastro, dadosPermitidosProvedorGratuito } from "./nanoOperacoes.ts";
const base = { lojaId: "mobis", lojaAutorizada: "mobis", usuarioAutenticado: true, escritaBlingHabilitada: false };
test("consulta no escopo autorizado; bloqueia acesso cruzado", () => {
  assert.equal(autorizarOperacao("bling.consultar", base).permitido, true);
  assert.equal(autorizarOperacao("bling.consultar", { ...base, lojaAutorizada: "outra" }).permitido, false);
});
test("fornecedor exige autorização explícita", () => {
  assert.equal(autorizarOperacao("fornecedor.consultar", base).permitido, false);
  assert.equal(autorizarOperacao("fornecedor.consultar", { ...base, fornecedorAutorizado: true }).permitido, true);
});
test("escrita exige chave, aprovação e versão idêntica", () => {
  assert.equal(autorizarOperacao("bling.gravar", base).permitido, false);
  const habilitado = { ...base, escritaBlingHabilitada: true, aprovacaoId: "123", versaoAprovada: "v1", versaoSolicitada: "v2" };
  assert.equal(autorizarOperacao("bling.gravar", habilitado).permitido, false);
  assert.equal(autorizarOperacao("bling.gravar", { ...habilitado, versaoSolicitada: "v1" }).permitido, true);
});
test("produto excluído com mesmo SKU bloqueia cadastro automático", () => {
  const r = prepararPropostaCadastro({ sku: "CI000016" }, [{ sku: "ci000016", excluido: true }]);
  assert.equal(r.verificacao.duplicado, true);
  assert.equal(r.gravadoNoBling, false);
  assert.equal(r.status, "revisao_humana_obrigatoria");
});
test("ausência na amostra não comprova inexistência no Bling", () => {
  const r = prepararPropostaCadastro({ sku: "TESTE-1" }, []);
  assert.equal(r.verificacao.coberturaCompleta, false);
  assert.equal(r.gravadoNoBling, false);
});
test("dados de custo e fornecedor não seguem para provedor gratuito", () => {
  assert.deepEqual(dadosPermitidosProvedorGratuito({ sku: "ABC", custo: 12, fornecedor: "RMP", ncm: "x", token: "abc" }), { sku: "ABC" });
});
