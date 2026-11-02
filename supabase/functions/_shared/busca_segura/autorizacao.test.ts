// Teste de aceite 11 do PR #242: nenhuma escrita no Bling, deploy, merge ou publicação sem aprovação específica. Prova ESTRUTURAL (registro + política + código-fonte).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { buscarDefinicao, ferramentasVisiveis } from "../conector/registro.ts";
import { decidir } from "../conector/policy.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "../conector/bling_campos.ts";
import { FERRAMENTAS_ESCRITA_REAL } from "../conector/porta_bling.ts";

const TOCADAS = ["engenharia.consulta.interpretar", "conecta.imagem.buscar_web", "conecta.imagem.propor", "bling.produtos.preparar_atualizacao", "bling.produtos.preparar_cadastro", "engenharia.pesquisa.investigar"];

test("as ferramentas que este PR toca são leitura ou proposta, nunca escrevem fora e nunca vão ao MCP externo", () => {
  for (const id of TOCADAS) {
    const d = buscarDefinicao(id)!; assert.ok(d, id);
    assert.ok(d.permissao === "leitura" || d.permissao === "propor", `${id}: ${d.permissao}`);
    assert.equal(d.escreveExterno, false, id);
    // buscar_web e a investigação (usam a busca com credencial da loja) nunca vão ao MCP externo; o cadastro novo só PROPÕE e vai ao MCP por ordem do dono (02/11/2026).
    if (id === "conecta.imagem.buscar_web" || id === "engenharia.pesquisa.investigar") assert.equal(d.exposicao.mcp, false, id);
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

// ── Cadastro novo pelo agente EXTERNO (MCP): só com o escopo de proposta, só propõe, sem autoaprovação
import { HANDLERS } from "../conector/handlers.ts";
import { BlingMock } from "../conector/bling_mock.ts";
test("MCP: preparar_cadastro só aparece com o escopo 'propor'; sem ele o agente externo só lê", () => {
  assert.ok(!ferramentasVisiveis("gateway_mcp", ["leitura"]).some((f) => f.id === "bling.produtos.preparar_cadastro"));
  assert.ok(ferramentasVisiveis("gateway_mcp", ["leitura", "propor"]).some((f) => f.id === "bling.produtos.preparar_cadastro"));
  assert.ok(ferramentasVisiveis("gateway_mcp", ["leitura", "propor"]).every((f) => f.permissao !== "executar"));
});
test("MCP: o agente externo propõe produto novo; a marca exige URL de fonte (não vale 'documento' descrito) e nada é gravado no Bling", async () => {
  const itens: Record<string, unknown>[] = [], bling = new BlingMock();
  const rpc = async (fn: string, args: Record<string, unknown>) => { if (fn === "agente_proposta_item_adicionar") itens.push(args);
    return { data: ({ agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } } as Record<string, unknown>)[fn] ?? null, error: null }; };
  const q: any = { select: () => q, eq: () => q, in: () => q, like: () => q, then: (r: (v: unknown) => unknown) => r({ data: [], error: null }) };
  const ctx = { lojaId: "L", userId: "u", bling, rpc, admin: { from: () => q }, dados: { produtoPorSku: async () => null }, agente: { nome: "Cliente externo: GPT" } } as any;
  const fraca = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: { nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" }, fontes: [{ documento: "Etiqueta da embalagem" }] }, ctx) as any;
  assert.equal(fraca.erro, "Rascunho recusado"); assert.equal(itens.length, 0);
  const boa = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: { nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" }, fontes: [{ url: "https://www.sabo.com.br/catalogo/x" }] }, ctx) as any;
  assert.equal(boa.proposta_id, "p1", JSON.stringify(boa)); assert.equal(itens.length, 1);
  assert.equal(itens[0].p_operacao, "bling.produtos.criar"); assert.match(String((itens[0].p_depois as Record<string, unknown>).codigo), /^CI\d{6}$/);
  assert.equal(bling.recebidos.length, 0, "propor não escreve no Bling");
});
