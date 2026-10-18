import { test } from "node:test";
import assert from "node:assert/strict";
import { dadosPublicos, previaSeo, prontidao, ROTULO_IMAGEM } from "./studio.ts";
import type { DadosStudio } from "./conectorDados.ts";

const base = (): DadosStudio => ({
  produto: { id: "p", sku: "80692", nome: "Jogo de Juntas Completo do Motor HR / K2500 2.5 16V D4CB Euro 5 c/ Retentores Sabó", preco: 100, estoque: 2, marca: "Sabó", gtin: null, peso_kg: 2.4, descricao_curta: "Jogo completo.", categoria_bling_id: "1", situacao: "A", publicado: false, descricao_complementar: null, largura_cm: null, altura_cm: null, profundidade_cm: null, unidade: "JG" },
  imagens: [{ id: "1", url: "https://cdn/a.png", tipo: "real", aprovada: true, principal: true, alt_texto: null, licenca_tipo: "propria" }, { id: "2", url: "https://cdn/b.png", tipo: "ilustrativa", aprovada: false, principal: false, alt_texto: null, licenca_tipo: "publica_web" }],
  codigos: [{ tipo: "oem", valor: "21111-27A00", status: "aprovado", fonte: "catalogo" }, { tipo: "oem", valor: "99999", status: "a_confirmar", fonte: null }],
  aplicacoes: [{ modelo: "HR", motorizacao: "2.5", ano_inicial: 2013, ano_final: null, status: "aprovado", fonte: "x" }, { modelo: "Porter", motorizacao: null, ano_inicial: null, ano_final: null, status: "a_confirmar", fonte: null }],
  enriquecimento: [{ campo: "descricao_longa", valor: "Texto longo aprovado.", status: "aprovado", fonte: "x" }, { campo: "descricao_longa", valor: "rascunho", status: "a_confirmar", fonte: null }],
  categoriaBling: "Motor", taxonomia: "Motor",
});

test("studio: a página pública só recebe dado aprovado", () => {
  const p = dadosPublicos(base());
  assert.equal(p.imagens.length, 1); assert.equal(p.principal?.id, "1");
  assert.deepEqual(p.codigos, [{ tipo: "oem", valor: "21111-27A00" }]);
  assert.equal(p.aplicacoes.length, 1); assert.equal(p.aplicacoes[0].modelo, "HR");
  assert.equal(p.descricaoLonga, "Texto longo aprovado.");
});

test("studio: sem imagem aprovada não há principal e a prontidão acusa", () => {
  const s = base(); s.imagens[0].aprovada = false;
  assert.equal(dadosPublicos(s).principal, null);
  assert.equal(prontidao(s).find((c) => c.chave === "imagem")?.ok, false);
  assert.equal(prontidao(base()).every((c) => c.ok), true);
});

test("studio: SEO é derivado dos dados, com avisos honestos", () => {
  const seo = previaSeo(base());
  assert.ok(seo.titulo.length <= 60 && seo.titulo.endsWith("…"));
  assert.ok(seo.avisos.some((a) => a.includes("60")));
  const vazio = base(); vazio.produto.descricao_curta = null;
  assert.ok(previaSeo(vazio).avisos.some((a) => a.includes("Sem descrição curta")));
});

test("studio: imagem sintética/ilustrativa nunca é rotulada como foto real", () => {
  assert.match(ROTULO_IMAGEM.gerada_ia, /não é foto real/); assert.match(ROTULO_IMAGEM.ilustrativa, /não é a foto/);
  assert.equal(ROTULO_IMAGEM.real, "Foto real do produto");
});
