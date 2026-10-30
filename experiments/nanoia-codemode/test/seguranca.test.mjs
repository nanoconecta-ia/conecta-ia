import test from "node:test";
import assert from "node:assert/strict";
import { catalogoListar, catalogoVer, taxonomiaConsultar, resumoCatalogo, pendencias } from "../src/dados-sinteticos.mjs";
import { autenticarDemo, criarOrcamentoDeChamadas } from "../src/seguranca.mjs";
const A = "e_X0_demo______________________A", B = "e_X0_demo______________________B";
const env = { PILOT_ENABLED: "true", PILOT_TOKEN_A: A, PILOT_TOKEN_B: B };
const req = (token) => new Request("http://local.invalid/mcp", { headers: { authorization: "Bearer " + token } });

test("autenticação bloqueia ambiente desativado, token errado, curto e inválido", async () => {
  assert.equal(await autenticarDemo(req(A), { ...env, PILOT_ENABLED: "false" }), null);
  assert.equal(await autenticarDemo(req("curto"), env), null);
  assert.equal(await autenticarDemo(req("e_X0_demo______________________C"), env), null);
  assert.equal(await autenticarDemo(new Request("http://local.invalid/mcp"), env), null);
  assert.equal(await autenticarDemo(req(A), env), "piloto-a");
  assert.equal(await autenticarDemo(req(B), env), "piloto-b");
});
test("não há leitura cruzada entre as duas lojas; o parâmetro não escolhe tenant", () => {
  assert.equal(resumoCatalogo("piloto-a").produtos, 3);
  assert.equal(resumoCatalogo("piloto-b").produtos, 1);
  assert.deepEqual(catalogoListar("piloto-b", { busca: "TEST-A" }), []);
  assert.throws(() => catalogoVer("piloto-b", "TEST-A-001"), /produto_nao_encontrado/);
  assert.throws(() => catalogoListar("outra-loja", {}), /tenant_nao_autorizado/);
});
test("somente leitura e minimização: nenhum objeto devolve custo, fornecedor, NCM ou credenciais", () => {
  for (const tenant of ["piloto-a", "piloto-b"]) {
    for (const item of catalogoListar(tenant)) {
      const p = catalogoVer(tenant, item.sku);
      for (const proibido of ["custo", "fornecedor", "ncm", "cfop", "senha", "token", "segredo"]) {
        assert.ok(!Object.keys(p).some((k) => k.toLowerCase().includes(proibido)));
      }
      assert.equal(p.homologado, false);
      assert.equal(p.origem, "fixture_sintetica");
    }
  }
});
test("valida SKU, busca, limite e motor; não inventa compatibilidade", () => {
  assert.throws(() => catalogoVer("piloto-a", "../senha"), /sku_invalido/);
  assert.throws(() => catalogoListar("piloto-a", { limite: 100000 }), /argumento_invalido/);
  assert.throws(() => catalogoListar("piloto-a", { busca: "x".repeat(100) }), /argumento_invalido/);
  assert.throws(() => taxonomiaConsultar("piloto-a", "D4CB | SQL"), /motor_invalido/);
  assert.equal(taxonomiaConsultar("piloto-a", "D4CB").homologacao, "nao_verificada");
  assert.deepEqual(pendencias(catalogoVer("piloto-a", "TEST-A-001")), ["marca", "logistica"]);
});
test("orçamento falha após limite para uma execução", () => {
  const contar = criarOrcamentoDeChamadas(3);
  assert.deepEqual([contar(), contar(), contar()], [1, 2, 3]);
  assert.throws(contar, /limite_de_chamadas/);
  assert.throws(() => criarOrcamentoDeChamadas(-1), /limite_invalido/);
});
