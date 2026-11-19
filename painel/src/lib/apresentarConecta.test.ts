import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arquivosDeDescoberta, textoParaApresentar } from "./apresentarConecta.ts";

test("descoberta respeita subpasta do GitHub Pages e rota hash", () => {
  const urls = arquivosDeDescoberta("https://nanoconecta-ia.github.io/conecta-ia/conecta.html#/gateway");
  assert.equal(urls.manifesto, "https://nanoconecta-ia.github.io/conecta-ia/agentes/capacidades.json");
  assert.equal(urls.openapi, "https://nanoconecta-ia.github.io/conecta-ia/agentes/openapi.json");
  assert.ok(urls.mcp.startsWith("https://"));
});

test("apresentação não dá acesso irrestrito nem finge execução A2A", () => {
  const t = textoParaApresentar("https://nanoconecta-ia.github.io/conecta-ia/#/gateway");
  assert.match(t, /A2A ainda não possui servidor/);
  assert.match(t, /NÃO alegue acesso/);
  assert.match(t, /autorização do proprietário/);
  assert.doesNotMatch(t, /sk-[a-z0-9]{20,}/i);
});

test("OpenAPI descreve gateway existente, com Bearer e sem escrita aberta", () => {
  const o = JSON.parse(readFileSync(new URL("../../public/agentes/openapi.json", import.meta.url), "utf8"));
  assert.equal(o.openapi, "3.1.1");
  assert.equal(o.paths["/conector-mcp"].post.operationId, "executarJsonRpcMcp");
  assert.equal(o.components.securitySchemes.bearerMcp.scheme, "bearer");
  assert.equal(o["x-conecta-a2a-status"], "not-implemented");
  assert.equal(Object.keys(o.paths).length, 1);
});

test("manifesto não se apresenta como Agent Card de servidor A2A inexistente", () => {
  const m = JSON.parse(readFileSync(new URL("../../public/agentes/capacidades.json", import.meta.url), "utf8"));
  assert.equal(m.interfaces.a2a.status, "not_implemented");
  assert.equal(m.interfaces.a2a.agentCardAvailable, false);
  assert.equal(m.security.external_agent_can_publish, false);
  assert.equal(m.security.external_agent_can_write_bling, false);
});

test("botão de apresentação fica na página de Conectar meu agente, que não depende da flag do conector", () => {
  const fonte = readFileSync(new URL("../paginas/MeuAgente.tsx", import.meta.url), "utf8");
  assert.match(fonte, /<ApresentarConecta \/>/);
  const ui = readFileSync(new URL("../componentes/ApresentarConecta.tsx", import.meta.url), "utf8");
  assert.match(ui, /Copiar para outro chat/);
  assert.match(ui, /Ver o texto para copiar manualmente/);
  const flags = readFileSync(new URL("./flags.ts", import.meta.url), "utf8");
  assert.ok(!flags.match(/ROTAS_DO_CONECTOR = \[[^\]]*"\/meu-agente"/));
});
