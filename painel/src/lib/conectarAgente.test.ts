import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENTES, PERMISSOES, nomeSugerido, passosDeConexao, resumoConexao } from "./conectarAgente.ts";

test("nenhuma permissão inicial inclui simular, executar ou escrita", () => {
  for (const p of PERMISSOES) for (const e of p.escopos) assert.ok(["leitura", "propor"].includes(e));
});
test("resumo sempre mostra escrita no Bling bloqueada", () => {
  const r = resumoConexao("chatgpt", "consulta", 30);
  assert.equal(r.escritaBling, "bloqueada"); assert.deepEqual(r.escopos, ["leitura"]); assert.equal(r.expiracao, "30 dias");
  assert.deepEqual(resumoConexao("claude", "consulta_proposta", 7).escopos, ["leitura", "propor"]);
});
test("compatibilidade com ChatGPT/Claude é declarada não verificada, sem fingir conexão", () => {
  for (const c of CLIENTES.filter((x) => x.id !== "outro")) assert.match(c.nota, /NÃO VERIFICADA/);
  assert.match(passosDeConexao("chatgpt", "https://x/functions/v1/conector-mcp").join(" "), /OAuth/);
});
test("passos não carregam token e mandam guardar a chave fora do chat", () => {
  const t = passosDeConexao("outro", "https://x/functions/v1/conector-mcp").join("\n");
  assert.match(t, /Bearer <chave>/); assert.doesNotMatch(t, /eyJ|sk-|mcp_[a-z0-9]{16}/i);
  assert.match(passosDeConexao("claude", "https://x").join(" "), /nunca numa mensagem de chat/);
});
test("nome sugerido", () => assert.equal(nomeSugerido("claude"), "Agente Claude"));
