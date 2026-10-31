import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparMenu, areasAoNavegar, filtrarComandos, grupoDaRota, type Item } from "./navegacao.ts";

const itens: Item[] = [["/", "Visão geral"], ["/catalogo", "Catálogo"], ["/bling", "Bling"], ["/backup", "Backup do Bling"], ["/nova", "Tela nova"]];

test("agrupa por área, na ordem do menu, e omite grupo vazio", () => {
  const g = agruparMenu(itens);
  assert.deepEqual(g.map((x) => x.id), ["inicio", "catalogo", "ajustes", "outros"]);
  assert.deepEqual(g[2].itens.map((i) => i[0]), ["/bling", "/backup"]);
});

test("rota fora dos grupos cai em Outros (nada some)", () => {
  assert.deepEqual(agruparMenu(itens).at(-1)?.itens, [["/nova", "Tela nova"]]);
});

test("agrupar não perde nem duplica itens", () => {
  assert.equal(agruparMenu(itens).flatMap((g) => g.itens).length, itens.length);
});

test("filtro ignora acento e caixa; começa-com vem antes de contém", () => {
  assert.deepEqual(filtrarComandos(itens, "catalogo").map((i) => i[0]), ["/catalogo"]);
  assert.deepEqual(filtrarComandos(itens, "bling").map((i) => i[0]), ["/bling", "/backup"]);
});

test("consulta vazia devolve tudo; sem acerto devolve vazio", () => {
  assert.equal(filtrarComandos(itens, "  ").length, itens.length);
  assert.equal(filtrarComandos(itens, "zzz").length, 0);
});

test("cinco áreas de trabalho com rotas legadas preservadas", () => {
  const rotas: Item[] = [
    ["/", "Visão geral"], ["/catalogo", "Catálogo"], ["/assistente", "Assistente"],
    ["/conector", "Nano.IA"], ["/fila", "Fila"], ["/aprovacoes", "Aprovações"],
    ["/gateway", "Gateway MCP/API"], ["/integracoes", "Integrações"], ["/design", "Design System"],
  ];
  const grupos = agruparMenu(rotas);
  assert.deepEqual(grupos.map((g) => g.titulo), ["Início", "Catálogo inteligente", "Nano.IA", "Operações", "Configurações"]);
  assert.deepEqual(new Set(grupos.flatMap((g) => g.itens.map(([r]) => r))), new Set(rotas.map(([r]) => r)));
});

test("grupoDaRota acha a área inclusive em subcaminhos e não casa '/' por prefixo", () => {
  const g = agruparMenu([["/", "Visão geral"], ["/indicadores", "Indicadores"], ["/catalogo", "Catálogo"], ["/fila", "Fila"]]);
  assert.equal(grupoDaRota(g, "/"), "inicio");
  assert.equal(grupoDaRota(g, "/indicadores/vendas"), "inicio");
  assert.equal(grupoDaRota(g, "/catalogo"), "catalogo");
  assert.equal(grupoDaRota(g, "/fila"), "fila");
  assert.equal(grupoDaRota(g, "/desconhecida"), null);
});

test("areasAoNavegar: trocar de área deixa só a nova; mesma área preserva o que o usuário abriu", () => {
  const vazio: ReadonlySet<string> = new Set();
  const a = areasAoNavegar(vazio, null, "catalogo");
  assert.deepEqual([...a], ["catalogo"]);
  const manual = new Set([...a, "ajustes"]);                       // usuário abriu Configurações à mão
  assert.deepEqual([...areasAoNavegar(manual, "catalogo", "catalogo")].sort(), ["ajustes", "catalogo"]);
  assert.deepEqual([...areasAoNavegar(manual, "catalogo", "fila")], ["fila"]);
  const fechada: ReadonlySet<string> = new Set(["ajustes"]);         // recolheu a área atual e navegou dentro dela
  assert.deepEqual([...areasAoNavegar(fechada, "catalogo", "catalogo")].sort(), ["ajustes", "catalogo"]);
  assert.equal(areasAoNavegar(a, "catalogo", "catalogo"), a);       // mesma referência: nada a re-renderizar
  assert.equal(areasAoNavegar(a, "catalogo", null), a);
});
