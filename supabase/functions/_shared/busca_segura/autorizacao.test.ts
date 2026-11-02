// Teste de aceite 11 do PR #242: nenhuma escrita no Bling, deploy, merge ou publicação sem aprovação específica. Prova ESTRUTURAL (registro + política + código-fonte).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { buscarDefinicao, ferramentasVisiveis } from "../conector/registro.ts";
import { decidir } from "../conector/policy.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "../conector/bling_campos.ts";
import { FERRAMENTAS_ESCRITA_REAL } from "../conector/porta_bling.ts";

const TOCADAS = ["engenharia.consulta.interpretar", "conecta.imagem.buscar_web", "conecta.imagem.propor", "bling.produtos.preparar_atualizacao", "bling.produtos.preparar_cadastro"];

test("as ferramentas que este PR toca são leitura ou proposta, nunca escrevem fora e nunca vão ao MCP externo", () => {
  for (const id of TOCADAS) {
    const d = buscarDefinicao(id)!; assert.ok(d, id);
    assert.ok(d.permissao === "leitura" || d.permissao === "propor", `${id}: ${d.permissao}`);
    assert.equal(d.escreveExterno, false, id);
    // buscar_web (busca com credencial da loja) e o cadastro de produto novo nunca vão ao MCP externo; as demais já eram expostas como leitura/proposta antes deste PR.
    if (id === "conecta.imagem.buscar_web" || id === "bling.produtos.preparar_cadastro") assert.equal(d.exposicao.mcp, false, id);
  }
});
test("nenhuma ferramenta visível ao chat ou ao MCP escreve fora ou executa", () => {
  for (const origem of ["chat", "gateway_mcp"] as const) for (const d of ferramentasVisiveis(origem, ["leitura", "propor", "simular"])) {
    assert.equal(d.escreveExterno, false, `${origem}: ${d.id}`); assert.notEqual(d.permissao, "executar", `${origem}: ${d.id}`);
  }
});
test("a política NEGA execução vinda do chat e do MCP, mesmo da escrita no Bling", () => {
  for (const id of ["bling.produtos.criar", "bling.produtos.alterar"]) for (const origem of ["chat", "gateway_mcp"] as const) {
    const r = decidir(buscarDefinicao(id), { origem, aprovacaoValida: true, simulado: false, escritaRealLiberada: true, produtoTravado: false });
    assert.equal(r.decisao, "negada", `${id} via ${origem}: ${JSON.stringify(r)}`);
  }
});
test("criar produto no Bling segue desligado: nenhum campo liberado e a porta real não tem rota", () => {
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.criar"], undefined);
  assert.ok(!FERRAMENTAS_ESCRITA_REAL.includes("bling.produtos.criar"));
});
test("os módulos novos de busca segura são PUROS: sem fetch, sem rpc, sem Bling, sem escrita", () => {
  const dir = new URL(".", import.meta.url).pathname;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
    const src = readFileSync(dir + f, "utf8");
    for (const proibido of [/\bfetch\s*\(/, /\.rpc\s*\(/, /\.chamar\s*\(/, /porta_bling/, /Deno\./, /\.from\s*\(/, /\.insert\s*\(/, /\.update\s*\(/]) assert.ok(!proibido.test(src), `${f} usa ${proibido}`);
  }
});
