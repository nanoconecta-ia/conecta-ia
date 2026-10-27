import { test } from "node:test";
import assert from "node:assert/strict";
import { montarItensCategoria, resolverDestino, type Entrada, type Ponte } from "./categoria_bling.ts";
import { chaveProibida } from "./bling_campos.ts";

const pontes: Ponte[] = [
  { bling_categoria_id: "14668464", nome: "Embreagens viscosas", taxonomia_no_id: "n-visc" },
  { bling_categoria_id: "14676575", nome: "Pivôs", taxonomia_no_id: "n-pivo" },
  { bling_categoria_id: "14676577", nome: "Terminais de direção", taxonomia_no_id: "n-pivo" },
  { bling_categoria_id: "14676579", nome: "Filtros de óleo", taxonomia_no_id: "n-filtro" },
];
const existentes = new Set(["14668464", "14676575", "14676577", "14676579", "14676553"]);
const base: Entrada = {
  produto_id: "p1", sku: "CI000054", nome: "Embreagem viscosa", bling_id: "16721657873", situacao: "A", categoria_atual: "1072643",
  taxonomia_no_id: "n-visc", no_nome: "Arrefecimento › Embreagens viscosas", confianca: 0.9, fonte: "Bling: nome do produto",
};

test("resolverDestino: uma categoria vira destino; várias pedem escolha; nenhuma bloqueia", () => {
  assert.deepEqual(resolverDestino("n-visc", pontes), { tipo: "unico", categoria_id: "14668464", nome: "Embreagens viscosas" });
  const d = resolverDestino("n-pivo", pontes);
  assert.equal(d.tipo, "escolha");
  if (d.tipo === "escolha") assert.deepEqual(d.candidatas.map((c) => c.id), ["14676575", "14676577"]);
  assert.deepEqual(resolverDestino("n-injecao", pontes), { tipo: "sem_equivalente" });
});

test("monta o item: antes/depois só com a categoria, operação e alvo corretos, risco MEDIUM", () => {
  const r = montarItensCategoria([base], pontes, { categoriasExistentes: existentes });
  assert.equal(r.pendencias.length, 0);
  assert.equal(r.itens.length, 1);
  const i = r.itens[0];
  assert.equal(i.operacao, "bling.produtos.alterar");
  assert.equal(i.alvo, "16721657873");
  assert.deepEqual(i.campos, ["categoria_bling_id"]);
  assert.deepEqual(i.antes, { categoria_bling_id: "1072643" });
  assert.deepEqual(i.depois, { categoria_bling_id: "14668464" });
  assert.equal(i.risco, "MEDIUM");
  assert.equal(chaveProibida(i.depois), null, "nada fiscal, de preço, custo ou estoque");
  assert.ok(i.validacoes.some((v) => v.includes("relê o produto no Bling")));
  assert.match(i.fontes[0].documento, /Decisão do lojista/, "toda fonte precisa de url ou documento (regra do banco)");
});

test("caso ambíguo: sem escolha vai para pendência com as candidatas; com escolha válida entra; escolha fora das candidatas é recusada", () => {
  const e: Entrada = { ...base, produto_id: "p2", sku: "3975", taxonomia_no_id: "n-pivo", no_nome: "Suspensão e direção › Pivôs e terminais" };
  const sem = montarItensCategoria([e], pontes, { categoriasExistentes: existentes });
  assert.equal(sem.itens.length, 0);
  assert.equal(sem.pendencias[0].motivo, "escolha_pendente");
  assert.equal(sem.pendencias[0].candidatas?.length, 2);
  const com = montarItensCategoria([e], pontes, { categoriasExistentes: existentes, escolhas: { p2: "14676577" } });
  assert.equal(com.itens[0].depois.categoria_bling_id, "14676577");
  const ruim = montarItensCategoria([e], pontes, { categoriasExistentes: existentes, escolhas: { p2: "14668464" } });
  assert.equal(ruim.pendencias[0].motivo, "escolha_invalida");
});

test("sem equivalente no Bling não entra na proposta", () => {
  const e: Entrada = { ...base, produto_id: "p3", taxonomia_no_id: "n-injecao", no_nome: "Alimentação e injeção › Bicos injetores" };
  const r = montarItensCategoria([e], pontes, { categoriasExistentes: existentes });
  assert.equal(r.itens.length, 0);
  assert.equal(r.pendencias[0].motivo, "sem_equivalente");
});

test("fora do lote: inativo, confiança baixa, excluído por motivo, já na categoria e destino inexistente no espelho", () => {
  const entradas: Entrada[] = [
    { ...base, produto_id: "a", situacao: "I" },
    { ...base, produto_id: "b", confianca: 0.35 },
    { ...base, produto_id: "c", confianca: null },
    { ...base, produto_id: "d" },
    { ...base, produto_id: "e", categoria_atual: "14668464" },
    { ...base, produto_id: "f", taxonomia_no_id: "n-filtro", no_nome: "Filtros › Filtros de óleo" },
  ];
  const r = montarItensCategoria(entradas, pontes, {
    categoriasExistentes: new Set(["14668464"]), // 14676579 (filtro) não existe no espelho
    excluir: new Map([["d", "cadastro provisório sem NF-e"]]),
  });
  assert.deepEqual(r.itens.map((i) => i.produto_id), []);
  const por = Object.fromEntries(r.pendencias.map((p) => [p.produto_id, p.motivo]));
  assert.deepEqual(por, { a: "inativo", b: "confianca_baixa", c: "confianca_baixa", d: "excluido", e: "ja_na_categoria", f: "categoria_inexistente" });
});

test("o risco sobe para HIGH quando o lote passa do limite e a opção de inativos pode ser ligada", () => {
  const mk = (n: number): Entrada => ({ ...base, produto_id: `p${n}`, sku: `S${n}`, bling_id: `${n}` });
  const seis = montarItensCategoria([1, 2, 3, 4, 5, 6].map(mk), pontes, { categoriasExistentes: existentes });
  assert.ok(seis.itens.every((i) => i.risco === "HIGH"));
  const cinco = montarItensCategoria([1, 2, 3, 4, 5].map(mk), pontes, { categoriasExistentes: existentes });
  assert.ok(cinco.itens.every((i) => i.risco === "MEDIUM"));
  const inativo = montarItensCategoria([{ ...base, situacao: "I" }], pontes, { categoriasExistentes: existentes, apenasAtivos: false });
  assert.equal(inativo.itens.length, 1);
});

test("o destino precisa ser id numérico: id inválido é recusado pela lista fechada de campos", () => {
  const pontesRuins: Ponte[] = [{ bling_categoria_id: "abc", nome: "Ruim", taxonomia_no_id: "n-visc" }];
  const r = montarItensCategoria([base], pontesRuins, { categoriasExistentes: new Set(["abc"]) });
  assert.equal(r.itens.length, 0);
  assert.equal(r.pendencias[0].motivo, "corpo_recusado");
});
