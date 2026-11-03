import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarEvento, contextoVazio, lerContexto, SELECAO_MAX, TTL_MS, type EventoCliente } from "./contexto.ts";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const agora = new Date("2026-11-03T12:00:00Z");
const loja = U(1000);
const base = () => contextoVazio(loja, "pair-1", "conecta-ui", agora);
const ev = (o: Partial<EventoCliente> = {}): EventoCliente => ({ eventoId: U(9000), acao: "produto.selecionado", origem: "conecta-ui", produtoAtivoId: null, produtosSelecionados: [U(1)], versaoBase: 0, ...o });
const loja_ids = new Set([U(1), U(2), U(3)]);

test("seleção de 1 e de N produtos incrementa a versão no servidor", () => {
  const a = aplicarEvento(base(), ev(), loja_ids, agora); assert.ok(a.ok); assert.equal(a.contexto.versao, 1);
  const b = aplicarEvento(a.contexto, ev({ eventoId: U(9001), produtosSelecionados: [U(1), U(2), U(3)], versaoBase: 1 }), loja_ids, agora);
  assert.ok(b.ok); assert.deepEqual(b.contexto.produtosSelecionados, [U(1), U(2), U(3)]); assert.equal(b.contexto.versao, 2);
});
test("evento duplicado é ignorado sem mudar versão", () => {
  const a = aplicarEvento(base(), ev(), loja_ids, agora); assert.ok(a.ok);
  const d = aplicarEvento(a.contexto, ev(), loja_ids, agora); assert.ok(d.ok && d.duplicado); assert.equal(d.contexto.versao, 1);
});
test("versão antiga (fora de ordem) é conflito explícito e não regride o estado", () => {
  const a = aplicarEvento(base(), ev(), loja_ids, agora); assert.ok(a.ok);
  const r = aplicarEvento(a.contexto, ev({ eventoId: U(9002), versaoBase: 0 }), loja_ids, agora);
  assert.deepEqual(r, { ok: false, erro: "versao_conflito" });
});
test("produto de outra loja é recusado (id vem do servidor, não do cliente)", () => {
  assert.deepEqual(aplicarEvento(base(), ev({ produtosSelecionados: [U(77)] }), loja_ids, agora), { ok: false, erro: "produto_fora_da_loja" });
});
test("limites: excesso, duplicidade, aberto sem produto, evento malformado", () => {
  const muitos = Array.from({ length: SELECAO_MAX + 1 }, (_, i) => U(i + 1));
  assert.deepEqual(aplicarEvento(base(), ev({ produtosSelecionados: muitos }), new Set(muitos), agora), { ok: false, erro: "selecao_excessiva" });
  assert.deepEqual(aplicarEvento(base(), ev({ produtosSelecionados: [U(1), U(1)] }), loja_ids, agora), { ok: false, erro: "selecao_duplicada" });
  assert.deepEqual(aplicarEvento(base(), ev({ acao: "produto.aberto", produtoAtivoId: null }), loja_ids, agora), { ok: false, erro: "produto_ativo_ausente" });
  assert.deepEqual(aplicarEvento(base(), { ...ev(), eventoId: "x" }, loja_ids, agora), { ok: false, erro: "evento_invalido" });
  assert.deepEqual(aplicarEvento(base(), { ...ev(), acao: "produto.salvo" as never }, loja_ids, agora), { ok: false, erro: "evento_invalido" });
});
test("limpar e fechar zeram o que devem", () => {
  const a = aplicarEvento(base(), ev({ acao: "produto.aberto", produtoAtivoId: U(2), produtosSelecionados: [U(2)] }), loja_ids, agora); assert.ok(a.ok); assert.equal(a.contexto.produtoAtivoId, U(2));
  const f = aplicarEvento(a.contexto, ev({ eventoId: U(9003), acao: "produto.fechado", versaoBase: 1 }), loja_ids, agora); assert.ok(f.ok); assert.equal(f.contexto.produtoAtivoId, null);
  const l = aplicarEvento(f.contexto, ev({ eventoId: U(9004), acao: "selecao.limpa", versaoBase: 2, produtosSelecionados: [] }), loja_ids, agora); assert.ok(l.ok); assert.deepEqual(l.contexto.produtosSelecionados, []);
});
test("expiração: contexto vencido não aceita evento nem é lido", () => {
  const depois = new Date(agora.getTime() + TTL_MS + 1);
  assert.deepEqual(aplicarEvento(base(), ev(), loja_ids, depois), { ok: false, erro: "contexto_expirado" });
  assert.deepEqual(lerContexto(base(), loja, "pair-1", depois), { ok: false, erro: "contexto_indisponivel" });
});
test("leitura MCP: outra loja ou outro principal = indisponível; sem contexto = indisponível", () => {
  assert.ok(lerContexto(base(), loja, "pair-1", agora).ok);
  assert.equal(lerContexto(base(), U(2000), "pair-1", agora).ok, false);
  assert.equal(lerContexto(base(), loja, "pair-2", agora).ok, false);
  assert.equal(lerContexto(null, loja, "pair-1", agora).ok, false);
});
