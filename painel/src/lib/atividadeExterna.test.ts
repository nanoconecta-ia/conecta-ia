import { test } from "node:test";
import assert from "node:assert/strict";
import { iconeDaAtividade, origemRotulo, rotuloAtividade, textoDoResumo } from "./atividadeExterna.ts";

test("rótulos por tipo e tipo desconhecido", () => {
  assert.equal(rotuloAtividade("proposta"), "Propôs"); assert.equal(rotuloAtividade("zzz"), "Atividade"); assert.equal(origemRotulo, "agente externo");
});
test("ícone vem da taxonomia, sem categoria é o genérico", () => {
  assert.equal(iconeDaAtividade({ categoria: { slug: "bombas-agua", nome: "Bombas d'água" } }), "arrefecimento");
  assert.equal(iconeDaAtividade({ categoria: null }), "todas");
});
test("texto do resumo sem HTML, sem controle e no limite", () => {
  assert.equal(textoDoResumo("<b>Oi</b>\n\tmundo <script>x()</script>"), "Oi mundo x()");
  assert.equal(textoDoResumo(null), ""); assert.equal(textoDoResumo("a".repeat(700)).length, 600);
});
