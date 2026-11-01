import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveIdempotenciaPreco, validarPropostaPreco } from "./regras_preco.ts";

const ctx = { lojaId: "L1", precoAtual: 100 };
const ok = { sku: "CI001086", preco_novo: 120, motivo: "Ajuste de tabela de venda do mês" };

test("proposta válida: diferença calculada pelo servidor, pendente de aprovação, MEDIUM, chave estável", () => {
  const r = validarPropostaPreco(ok, ctx);
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual([r.proposta.preco_atual, r.proposta.preco_novo, r.proposta.diferenca, r.proposta.percentual], [100, 120, 20, 20]);
  assert.equal(r.proposta.risco, "MEDIUM"); assert.equal(r.proposta.exige_aprovacao, true); assert.equal(r.proposta.campo, "preco");
  assert.equal(r.proposta.idempotency_key, chaveIdempotenciaPreco("L1", "CI001086", 100, 120));
  assert.ok(r.proposta.alertas.some((a) => /Variação alta/.test(a)) && r.proposta.alertas.some((a) => /sincronizado/.test(a)));
});
test("só preço de venda: qualquer outro campo (custo, compra, margem, fornecedor, fiscal) é recusado", () => {
  for (const extra of [{ custo: 50 }, { preco_compra: 40 }, { margem: 0.3 }, { fornecedor: "X" }, { ncm: "8413" }, { estoque: 3 }, { nome: "x" }]) {
    const r = validarPropostaPreco({ ...ok, ...extra }, ctx);
    assert.equal(r.ok, false, JSON.stringify(extra)); if (!r.ok) assert.match(r.erro, /Só o preço de venda/);
  }
});
test("o motivo não pode citar custo, margem, fornecedor, compra nem dado fiscal", () => {
  for (const m of ["Subir porque o custo aumentou", "Manter margem de 30 por cento", "Fornecedor reajustou a tabela", "Novo preço de compra maior", "Muda o NCM do produto"]) {
    const r = validarPropostaPreco({ ...ok, motivo: m }, ctx); assert.equal(r.ok, false, m);
  }
  assert.equal(validarPropostaPreco({ ...ok, motivo: "curto" }, ctx).ok, false);
});
test("valor inválido: zero, negativo, NaN, texto, 3 casas, igual ao atual, sem preço no espelho, variação absurda", () => {
  for (const v of [0, -5, NaN, Infinity, "120", null, 100.123]) assert.equal(validarPropostaPreco({ ...ok, preco_novo: v }, ctx).ok, false, String(v));
  assert.equal(validarPropostaPreco({ ...ok, preco_novo: 100 }, ctx).ok, false);
  assert.equal(validarPropostaPreco(ok, { ...ctx, precoAtual: null }).ok, false);
  assert.equal(validarPropostaPreco(ok, { ...ctx, precoAtual: 0 }).ok, false);
  assert.equal(validarPropostaPreco({ ...ok, preco_novo: 9999 }, ctx).ok, false, "+9899% é erro de digitação");
});
test("variação pequena não gera alerta de variação alta; queda também entra", () => {
  const pequena = validarPropostaPreco({ ...ok, preco_novo: 105 }, ctx);
  assert.ok(pequena.ok && !pequena.proposta.alertas.some((a) => /Variação alta/.test(a)));
  const queda = validarPropostaPreco({ ...ok, preco_novo: 70 }, ctx);
  assert.ok(queda.ok && queda.proposta.percentual === -30 && queda.proposta.alertas.some((a) => /-30%/.test(a)));
});
test("entrada que não é objeto é recusada; sem SKU é recusada", () => {
  for (const e of [null, undefined, "x", 3, []]) assert.equal(validarPropostaPreco(e, ctx).ok, false);
  assert.equal(validarPropostaPreco({ ...ok, sku: "  " }, ctx).ok, false);
});
test("MOCK (test.*): nenhuma chamada de rede acontece ao validar; o resultado é só dado para a fila de aprovação", () => {
  let chamadas = 0; const orig = globalThis.fetch; globalThis.fetch = (() => { chamadas++; throw new Error("rede proibida"); }) as typeof fetch;
  try { validarPropostaPreco(ok, ctx); } finally { globalThis.fetch = orig; }
  assert.equal(chamadas, 0);
});
