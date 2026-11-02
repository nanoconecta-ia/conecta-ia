import { test } from "node:test";
import assert from "node:assert/strict";
import { montarConexoes, type EntradaConexoes } from "./conexoesAgente.ts";

const vazio: EntradaConexoes = { chavesIa: [], chavesMcp: [], plugins: [], agora: Date.parse("2026-11-02T12:00:00Z") };
const por = (e: EntradaConexoes, id: string) => montarConexoes(e).find((c) => c.id === id)!;

test("sem nada configurado: nativo e API pedem atenção, MCP e plugins ficam não configurados", () => {
  assert.equal(por(vazio, "nativo").estado, "atencao"); assert.equal(por(vazio, "api").estado, "atencao");
  assert.equal(por(vazio, "mcp").estado, "inativo"); assert.equal(por(vazio, "plugins").estado, "inativo");
});
test("um só provedor é atenção (sem alternativa); dois é ok", () => {
  const um = { ...vazio, chavesIa: [{ provedor: "p1", ativa: true, principal: true }] };
  assert.equal(por(um, "api").estado, "atencao"); assert.match(por(um, "api").detalhe, /não há alternativa/); assert.equal(por(um, "nativo").estado, "ok");
  const dois = { ...vazio, chavesIa: [...um.chavesIa, { provedor: "p2", ativa: true, principal: false }] };
  assert.equal(por(dois, "api").estado, "ok");
});
test("chave inativa não conta", () => assert.equal(por({ ...vazio, chavesIa: [{ provedor: "p1", ativa: false, principal: true }] }, "nativo").estado, "atencao"));
test("MCP: revogada e expirada não contam; uso mais recente aparece", () => {
  const e = { ...vazio, chavesMcp: [
    { revogada_em: "2026-11-01T00:00:00Z", expira_em: null, ultimo_uso_em: null },
    { revogada_em: null, expira_em: "2026-10-01T00:00:00Z", ultimo_uso_em: null },
    { revogada_em: null, expira_em: "2026-12-01T00:00:00Z", ultimo_uso_em: "2026-11-02T10:00:00Z" }] };
  const c = por(e, "mcp"); assert.equal(c.estado, "ok"); assert.match(c.resumo, /1 chave ativa/); assert.match(c.detalhe, /não verificado/);
});
test("plugins: falha no último teste é atenção", () => {
  assert.equal(por({ ...vazio, plugins: [{ ativo: true, ultimo_teste_ok: false }] }, "plugins").estado, "atencao");
  assert.equal(por({ ...vazio, plugins: [{ ativo: true, ultimo_teste_ok: true }, { ativo: false, ultimo_teste_ok: false }] }, "plugins").estado, "ok");
});
test("contingência é sempre não verificada", () => assert.equal(por(vazio, "contingencia").estado, "nao_verificado"));
test("nenhum texto nomeia provedor de IA (regra 5)", () => {
  const e = { ...vazio, chavesIa: [{ provedor: "gemini", ativa: true, principal: true }] };
  for (const c of montarConexoes(e)) assert.doesNotMatch(`${c.titulo} ${c.resumo} ${c.detalhe}`, /gemini|claude|openai|deepseek|openrouter|anthropic/i);
});
