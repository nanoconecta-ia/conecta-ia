import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarValor, normalizar, rotaDoFiltro } from "./indicadores.ts";

test("indicadores: null e não numérico ficam 'não medido', zero real continua zero", () => {
  const r = normalizar({ produtos_sincronizados: { valor: 4, filtro: "produtos" }, qualidade_seo: { valor: null, filtro: "seo", observacao: "ainda não medido" }, produtos_bloqueados: { valor: 0, filtro: "produtos:bloqueados" }, imagens_pendentes: { valor: "7" } })!;
  const por = Object.fromEntries(r.indicadores.map((i) => [i.chave, i]));
  assert.equal(por.produtos_sincronizados.valor, 4);
  assert.equal(formatarValor(por.qualidade_seo.valor), "não medido");
  assert.equal(formatarValor(por.produtos_bloqueados.valor), "0");
  assert.equal(por.imagens_pendentes.valor, null);        // string não vira número
  assert.equal(por.divergencias.valor, null);             // ausente = não medido
  assert.equal(r.indicadores.length, 12);
});

test("indicadores: resposta inválida devolve null (a tela mostra erro, não zeros)", () => {
  assert.equal(normalizar(null), null); assert.equal(normalizar("x"), null);
});

test("indicadores: custo por agente é lido do mês", () => {
  const r = normalizar({ custo_por_agente_mes: [{ provedor: "claude", modelo: "m", tokens: 120, custo_estimado: 0.002 }, { provedor: "gemini", modelo: "g", tokens: 5, custo_estimado: null }] })!;
  assert.equal(r.custo.length, 2); assert.equal(r.custo[1].custo_estimado, null);
});

test("indicadores: rota do filtro é validada", () => {
  assert.equal(rotaDoFiltro("produtos:incompletos"), "/indicadores/produtos:incompletos");
  assert.equal(rotaDoFiltro("aprovacoes"), "/central?estado=pendente");
  assert.equal(rotaDoFiltro("../x"), null); assert.equal(rotaDoFiltro("a b"), null);
});
