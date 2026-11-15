import { test } from "node:test";
import assert from "node:assert/strict";
import { permissaoAtivacaoPlugin, chamarPlugin, type PluginRegistro } from "./plugin.ts";

const ativo = { id: "p", nome: "Catalogo somente consulta", tipo: "api", url: "https://plugins.exemplo.com.br/sdk", capacidades: ["consultar_catalogo"], risco: "LOW", ativo: false, ultimo_teste_ok: true };

test("API SDK v1: precisa teste, URL publica, capacidades e LOW", () => {
  assert.equal(permissaoAtivacaoPlugin(ativo).permitido, true);
  assert.equal(permissaoAtivacaoPlugin({...ativo, ultimo_teste_ok: false}).permitido, false);
  assert.equal(permissaoAtivacaoPlugin({...ativo, ultimo_teste_ok: null}).permitido, false);
  assert.equal(permissaoAtivacaoPlugin({...ativo, capacidades: []}).permitido, false);
  assert.equal(permissaoAtivacaoPlugin({...ativo, url: "http://127.0.0.1:9999"}).permitido, false);
});
test("MCP, LLM e plugin_pull: cadastro nao significa executor implementado", () => {
  for (const tipo of ["mcp", "llm", "plugin_pull"]) {
    const p = permissaoAtivacaoPlugin({...ativo, tipo});
    assert.equal(p.permitido, false, tipo);
    assert.match(p.motivo, /somente cadastrado/);
  }
});
test("risco MEDIUM, HIGH ou CRITICAL nunca ativa automaticamente", () => {
  for (const risco of ["MEDIUM", "HIGH", "CRITICAL"]) {
    const r = permissaoAtivacaoPlugin({...ativo, risco});
    assert.equal(r.permitido, false, risco);
  }
});
test("plugin CRITICAL existente nao executa chamada mesmo que marcado ativo", async () => {
  let chamadas = 0;
  const inv = {...ativo, ativo:true, risco:"CRITICAL"} as PluginRegistro;
  const r = await chamarPlugin(inv, null, "consultar_catalogo", {}, async () => { chamadas++; return new Response("{}"); });
  assert.deepEqual(r,{ok:false,erro:"Plugin de risco acima de LOW exige aprovação humana: o agente não o chama sozinho."});
  assert.equal(chamadas,0);
});
test("plugin MCP nao executa por contrato SDK", async () => {
  let chamadas = 0;
  const inv = {...ativo, ativo:true, tipo:"mcp"} as PluginRegistro;
  const r = await chamarPlugin(inv, null, "consultar_catalogo",{},async()=>{chamadas++;return new Response("{}")});
  assert.equal(r.ok,false); assert.equal(chamadas,0);
});