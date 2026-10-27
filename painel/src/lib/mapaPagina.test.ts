import { test } from "node:test";
import assert from "node:assert/strict";
import { higienizar, layoutArvore, mapaDoCatalogo, mapaParaTexto, resumoDoMapa, rotuloPermitido, type Contagens, type MapaNo } from "./mapaPagina.ts";

const c: Contagens = {
  total: 42, publicados: 3, inativos: 7, semCategoria: 5, semLugarNaTaxonomia: 2, incompletos: 30, faltando: { GTIN: 28, imagem: 40, peso: 0 },
  porNo: [
    { id: "a", pai_id: null, nome: "Motor", produtos: 1 }, { id: "b", pai_id: "a", nome: "Pistões e anéis", produtos: 4 },
    { id: "c", pai_id: null, nome: "Filtros", produtos: 6 }, { id: "loop", pai_id: "loop", nome: "Ciclo", produtos: 1 },
  ],
};

test("mapaDoCatalogo: números, tons e taxonomia somada por nó + descendentes", () => {
  const m = mapaDoCatalogo(c);
  assert.equal(m.valor, 42);
  const por = (id: string, no: MapaNo = m): MapaNo | undefined => no.id === id ? no : no.filhos?.map((f) => por(id, f)).find(Boolean);
  assert.equal(por("publicados")!.tom, "ok");
  assert.equal(por("sem-categoria")!.valor, 5);
  assert.equal(por("sem-categoria")!.tom, "atencao");
  assert.equal(por("tx:a")!.valor, 5, "Motor = 1 + 4 do filho");
  assert.equal(por("tx:b")!.valor, 4);
  assert.equal(por("falta:peso"), undefined, "campo com 0 faltando não vira nó");
  assert.deepEqual(por("incompletos")!.filhos!.map((f) => f.rotulo), ["Sem imagem", "Sem GTIN"], "mais faltando primeiro");
  assert.ok(por("tx:loop"), "nó que aponta para si mesmo vira raiz, sem laço infinito");
});

test("higienizar: custo, fiscal, fornecedor e segredos nunca entram no mapa", () => {
  for (const ruim of ["Preço de compra", "Custo médio", "NCM", "CFOP", "Fornecedor X", "Margem", "token", "Importador"]) assert.equal(rotuloPermitido(ruim), false, ruim);
  assert.equal(rotuloPermitido("Filtros de óleo"), true);
  const m = higienizar({ id: "r", rotulo: "Raiz", filhos: [{ id: "1", rotulo: "Sem NCM", valor: 3 }, { id: "2", rotulo: "Sem GTIN", valor: 4, filhos: [{ id: "3", rotulo: "Fornecedor", valor: 1 }] }] })!;
  assert.deepEqual(m.filhos!.map((f) => f.id), ["2"]);
  assert.deepEqual(m.filhos![0].filhos, []);
  assert.equal(higienizar({ id: "x", rotulo: "Custo total" }), null);
  assert.ok(!mapaParaTexto({ id: "r", rotulo: "Raiz", filhos: [{ id: "1", rotulo: "Preço de compra", valor: 9 }] }).includes("compra"));
});

test("layoutArvore: um nível por coluna, pai no meio dos filhos e recolher esconde a subárvore", () => {
  const raiz: MapaNo = { id: "r", rotulo: "R", filhos: [{ id: "a", rotulo: "A", filhos: [{ id: "a1", rotulo: "A1" }, { id: "a2", rotulo: "A2" }] }, { id: "b", rotulo: "B" }] };
  const l = layoutArvore(raiz, { colunaLargura: 100, linhaAltura: 10, margem: 0 });
  const no = (id: string) => l.nos.find((n) => n.id === id)!;
  assert.equal(no("r").x, 0); assert.equal(no("a").x, 100); assert.equal(no("a1").x, 200);
  assert.equal(no("a1").y, 0); assert.equal(no("a2").y, 10); assert.equal(no("a").y, 5, "pai no meio de a1 e a2");
  assert.equal(no("b").y, 20);
  assert.equal(l.arestas.length, 4);
  const r = layoutArvore(raiz, { colunaLargura: 100, linhaAltura: 10, margem: 0, recolhidos: new Set(["a"]) });
  assert.equal(r.nos.length, 3, "a1 e a2 somem");
  assert.equal(r.nos.find((n) => n.id === "a")!.recolhido, true);
  assert.ok(r.altura < l.altura);
});

test("resumoDoMapa: frases com o total, o que está em ordem e os pontos de atenção", () => {
  const linhas = resumoDoMapa(mapaDoCatalogo(c));
  assert.equal(linhas[0], "Catálogo: 42.");
  assert.ok(linhas.some((x) => x.startsWith("Em ordem") && x.includes("Mostrando no site: 3")));
  const atencao = linhas.find((x) => x.startsWith("Atenção"))!;
  assert.ok(atencao.includes("Sem categoria no Bling: 5") && atencao.includes("Inativos no Bling: 7") && !atencao.includes("Sem GTIN"));
  assert.deepEqual(resumoDoMapa({ id: "r", rotulo: "Vazio", valor: 0 }), ["Vazio: 0.", "Nenhum ponto de atenção nesta tela."]);
});
