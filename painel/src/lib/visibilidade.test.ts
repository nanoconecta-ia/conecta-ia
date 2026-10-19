import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemVisibilidade, montarMenu } from "./visibilidade.ts";

test("mensagem: produto incompleto diz o que falta, com nomes legíveis", () => {
  const m = mensagemVisibilidade({ ok: false, faltando: ["imagem_principal", "bula_tecnica", "xyz"] }, true);
  assert.equal(m.ok, false);
  assert.match(m.texto, /imagem principal aprovada, bula técnica aprovada, xyz/);
});
test("mensagem: sucesso e erro de rede", () => {
  assert.deepEqual(mensagemVisibilidade({ ok: true }, true), { ok: true, texto: "Produto visível no site." });
  assert.deepEqual(mensagemVisibilidade({ ok: true }, false), { ok: true, texto: "Produto oculto do site." });
  assert.equal(mensagemVisibilidade(null, true).ok, false);
});
test("menu: itens que dependem do conector somem enquanto o backend não está publicado", () => {
  const itens: [string, string][] = [["/", "Visão geral"], ["/conector", "Conector IA"], ["/catalogo", "Catálogo"], ["/studio", "Studio"]];
  const pair: [string, string][] = [["/aprovacoes", "Aprovações"]];
  const dep = ["/conector", "/studio"];
  assert.deepEqual(montarMenu(itens, pair, { pairAtivo: false, conectorAtivo: false }, dep).map(([c]) => c), ["/", "/catalogo"]);
  assert.deepEqual(montarMenu(itens, pair, { pairAtivo: true, conectorAtivo: false }, dep).map(([c]) => c), ["/", "/aprovacoes", "/catalogo"]);
  assert.equal(montarMenu(itens, pair, { pairAtivo: false, conectorAtivo: true }, dep).length, 4);
});
