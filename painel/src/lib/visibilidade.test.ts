import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemVisibilidade, montarMenu, rotaBloqueada, semRotasSemAceite } from "./visibilidade.ts";

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
  const itens: [string, string][] = [["/", "Visão geral"], ["/conector", "Nano.ia"], ["/catalogo", "Catálogo"], ["/studio", "Studio"]];
  const pair: [string, string][] = [["/aprovacoes", "Aprovações"]];
  const dep = ["/conector", "/studio"];
  assert.deepEqual(montarMenu(itens, pair, { pairAtivo: false, conectorAtivo: false }, dep).map(([c]) => c), ["/", "/catalogo"]);
  assert.deepEqual(montarMenu(itens, pair, { pairAtivo: true, conectorAtivo: false }, dep).map(([c]) => c), ["/", "/aprovacoes", "/catalogo"]);
  assert.equal(montarMenu(itens, pair, { pairAtivo: false, conectorAtivo: true }, dep).length, 4);
});

test("Central oculta sem aceite específico, mesmo com o conector ligado (issue #166)", () => {
  const dep = ["/conector", "/central", "/indicadores", "/studio", "/gateway"];
  const central = ["/central", "/agentes"];
  const itens: [string, string][] = [["/", "Início"], ["/central", "Central"], ["/fila", "Fila"]];
  assert.deepEqual(semRotasSemAceite(itens, false, central).map(([c]) => c), ["/", "/fila"]);
  assert.deepEqual(semRotasSemAceite(itens, true, central).map(([c]) => c), ["/", "/central", "/fila"]);
  const conectorSemCentral = { conectorAtivo: true, centralAtiva: false };
  assert.equal(rotaBloqueada("/central", conectorSemCentral, dep, central), true);
  assert.equal(rotaBloqueada("/agentes", conectorSemCentral, dep, central), true);
  assert.equal(rotaBloqueada("/conector", conectorSemCentral, dep, central), false);
  assert.equal(rotaBloqueada("/central", { conectorAtivo: true, centralAtiva: true }, dep, central), false);
  // sem conector continua tudo como antes
  const nada = { conectorAtivo: false, centralAtiva: true };
  assert.equal(rotaBloqueada("/central", nada, dep, central), true);
  assert.equal(rotaBloqueada("/indicadores/vendas", nada, dep, central), true);
  assert.equal(rotaBloqueada("/catalogo", nada, dep, central), false);
});
