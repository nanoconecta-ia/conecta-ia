import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearProduto, precisaDetalhe, resumirExcluido, sincronizar, type Existente, type ItemLista, type LinhaProduto, type PortasSync } from "./bling_sync.ts";

const AGORA = Date.parse("2026-10-18T12:00:00Z");
// Forma real do getProduct da Mobis (valores do detalhe lido pelo MCP, só leitura).
const detalheReal = { id: 16719530080, codigo: "CI001086", nome: "BOMBA OLEO HR/K2500 …", preco: 939.466667, situacao: "A", formato: "S", marca: " MARCA: TRIM GO",
  gtin: "", categoria: { id: 1072643 }, estoque: { saldoVirtualTotal: 1 }, pesoBruto: 5, pesoLiquido: 0, dimensoes: { altura: 0, largura: 0, profundidade: 0 },
  unidade: "UN", condicao: 1, volumes: 1, descricaoCurta: "", descricaoComplementar: "",
  fornecedor: { precoCompra: 460.17, precoCusto: 469.7333333, contato: { nome: "FORNECEDOR X" } }, precoCusto: 1, tributacao: { ncm: "8413.30.30" } };

test("mapear: só campos permitidos; custo e fornecedor jamais entram; zero vira vazio", () => {
  const l = mapearProduto("L", { id: 16719530080 }, detalheReal, "2026-10-18T12:00:00Z");
  assert.equal(l.sku, "CI001086"); assert.equal(l.marca, "MARCA: TRIM GO"); assert.equal(l.gtin, null);
  assert.equal(l.peso_kg, 5); assert.equal(l.altura_cm, null, "0 = não informado, nunca vira dado");
  assert.equal(l.categoria_bling_id, "1072643"); assert.equal(l.estoque, 1);
  const json = JSON.stringify(l);
  for (const proibido of ["precoCusto", "precoCompra", "fornecedor", "FORNECEDOR X", "469.73", "460.17"]) assert.ok(!json.includes(proibido), proibido);
});

test("mapear: SKU vazio do Bling fica nulo (produto incompleto não publica)", () => {
  assert.equal(mapearProduto("L", { id: 1, codigo: "" }, { codigo: "", nome: "RADIADOR", preco: 10 }, "x").sku, null);
});

test("detalhe só quando novo, mudou ou está velho", () => {
  const e: Existente = { bling_id: "1", sku: "A", nome: "N", preco: 10, estoque: 2, situacao: "A", sincronizado_em: new Date(AGORA - 3600_000).toISOString() };
  const it: ItemLista = { id: 1, codigo: "A", nome: "N", preco: 10, situacao: "A", estoque: { saldoVirtualTotal: 2 } };
  assert.equal(precisaDetalhe(it, e, AGORA), false);
  assert.equal(precisaDetalhe(it, undefined, AGORA), true);
  assert.equal(precisaDetalhe({ ...it, preco: 11 }, e, AGORA), true);
  assert.equal(precisaDetalhe({ ...it, estoque: { saldoVirtualTotal: 0 } }, e, AGORA), true);
  assert.equal(precisaDetalhe(it, { ...e, sincronizado_em: new Date(AGORA - 25 * 3600_000).toISOString() }, AGORA), true);
});

function portas(itens: ItemLista[], ex: Existente[] = [], falhaNaPagina?: number, inativos: ItemLista[] = [], excluidos: ItemLista[] = [], semDetalhe: number[] = []) {
  const gravados: LinhaProduto[][] = []; const erros: string[] = []; let ausentes: string[] = []; let t = AGORA; let detalhes = 0;
  const p: PortasSync = {
    listarPagina: async (pg, lim, grupo = "ativos") => (falhaNaPagina === pg && grupo === "ativos" ? { erro: "Bling 503" } : { itens: (grupo === "excluidos" ? excluidos : grupo === "inativos" ? inativos : itens).slice((pg - 1) * lim, pg * lim) }),
    detalhe: async (id) => { detalhes++; if (semDetalhe.includes(id)) return null; return { ...detalheReal, id, codigo: `S${id}`, nome: `N${id}`, situacao: excluidos.some((i) => i.id === id) ? "E" : inativos.some((i) => i.id === id) ? "I" : "A" }; },
    existentes: async () => ex, gravar: async (l) => { gravados.push(l); },
    marcarAusentes: async (ids) => { ausentes = ids; }, registrarErro: async (m) => { erros.push(m); },
    espera: async (ms) => { t += ms; }, agora: () => t,
  };
  return { p, gravados, erros, get ausentes() { return ausentes; }, get detalhes() { return detalhes; } };
}

test("sincroniza em lotes, paginando; listagem completa => completo", async () => {
  const itens = Array.from({ length: 230 }, (_, i) => ({ id: i + 1, codigo: `S${i + 1}`, nome: `N${i + 1}`, preco: 1, situacao: "A" }));
  const h = portas(itens);
  const r = await sincronizar("L", h.p);
  assert.equal(r.paginas, 5); assert.equal(r.vistos, 230); assert.equal(r.gravados, 230); assert.equal(r.completo, true);
  assert.ok(h.gravados.every((l) => l.length <= 50), "lotes de até 50");
});

test("produtos que sumiram da lista de ativos são marcados ausentes (só com listagem completa)", async () => {
  const ex: Existente[] = [{ bling_id: "999", sku: "Z", nome: "Z", preco: 1, estoque: 0, situacao: "A", sincronizado_em: new Date(AGORA).toISOString() }];
  const h = portas([{ id: 1, codigo: "S1", nome: "N1", preco: 1, situacao: "A" }], ex);
  const r = await sincronizar("L", h.p);
  assert.deepEqual(h.ausentes, ["999"]); assert.equal(r.ausentes, 1);
  const h2 = portas([{ id: 1, codigo: "S1", nome: "N1", preco: 1, situacao: "A" }], ex, 1);
  const r2 = await sincronizar("L", h2.p);
  assert.equal(r2.completo, false); assert.deepEqual(h2.ausentes, [], "falha na listagem NÃO marca ausentes");
  assert.equal(r2.erro, "Bling 503"); assert.equal(h2.erros.length, 1);
});

test("sem mudança não regrava nem busca detalhe; orçamento de tempo interrompe sem perder o que já gravou", async () => {
  const novo = { id: 1, codigo: "S1", nome: "N1", preco: 1, situacao: "A" };
  const ex: Existente[] = [{ bling_id: "1", sku: "S1", nome: "N1", preco: 1, estoque: null, situacao: "A", sincronizado_em: new Date(AGORA).toISOString() }];
  const h = portas([novo], ex);
  const r = await sincronizar("L", h.p);
  assert.equal(r.gravados, 0); assert.equal(h.detalhes, 0);
  const grande = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, codigo: `S${i + 1}`, nome: `N${i + 1}`, preco: 1, situacao: "A" }));
  const h2 = portas(grande);
  const r2 = await sincronizar("L", h2.p, 20_000);
  assert.equal(r2.completo, false); assert.ok(r2.gravados > 0 && r2.gravados < 300);
});

test("ativos e inativos entram no espelho e não são marcados ausentes", async () => {
  const ativos = [{ id: 1, codigo: "S1", nome: "N1", preco: 1, situacao: "A" }];
  const inativos = [{ id: 2, codigo: "S2", nome: "N2", preco: 2, situacao: "I" }, { id: 3, codigo: "S3", nome: "N3", preco: 3, situacao: "I" }];
  const ex: Existente[] = [{ bling_id: "2", sku: "S2", nome: "N2", preco: 2, estoque: 0, situacao: "ausente", sincronizado_em: new Date(AGORA).toISOString() }];
  const h = portas(ativos, ex, undefined, inativos);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, true); assert.equal(r.vistos, 3); assert.equal(r.ausentes, 0);
  const ids = h.gravados.flat().map((l) => l.bling_id).sort(); assert.deepEqual(ids, ["1", "2", "3"]);
  assert.equal(h.gravados.flat().find((l) => l.bling_id === "3")!.situacao, "I");
});
test("falha ao listar ativos interrompe a rodada sem marcar ausentes", async () => {
  const h = portas([{ id: 1, codigo: "S1", nome: "N1", preco: 1, situacao: "A" }], [], 1, [{ id: 2, codigo: "S2", nome: "N2", preco: 2, situacao: "I" }]);
  const r = await sincronizar("L", h.p); assert.equal(r.completo, false); assert.equal(h.ausentes.length, 0);
});

test("excluídos entram pela terceira listagem e são identificados como E mesmo sem GET detalhe", async () => {
  const anterior: Existente = {
    bling_id: "854008", sku: "854008", nome: "Bomba água INDISA", preco: 240, estoque: 0,
    situacao: "A", sincronizado_em: null, marca: "INDISA", gtin: "7890000000000",
    descricao_curta: "Descrição conferida anteriormente", categoria_bling_id: "123",
  };
  const e: ItemLista = { id: 854008, codigo: "854008", nome: "Bomba água INDISA", preco: 250, situacao: "E" };
  const h = portas([], [anterior], undefined, [], [e], [854008]);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, true);
  assert.equal(r.resumosExcluidos, 1);
  assert.equal(r.ausentes, 0);
  const l = h.gravados.flat().find(x => x.bling_id === "854008")!;
  assert.equal(l.situacao, "E");
  assert.equal(l.nome, "Bomba água INDISA");
  assert.equal(l.preco, 250);
  assert.equal(l.marca, "INDISA", "o fallback não apaga a marca anterior");
  assert.equal(l.gtin, "7890000000000", "o fallback não apaga GTIN confirmado");
  assert.equal(l.categoria_bling_id, "123");
  assert.ok(!JSON.stringify(l).includes("precoCusto"), "sem custo no espelho");
});

test("excluído novo sem detalhe entra como resumo, nunca com preço de compra", async () => {
  const h = portas([], [], undefined, [], [{ id: 854008, codigo: "854008", nome: "INDISA", situacao: "E" }], [854008]);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, true);
  assert.equal(r.resumosExcluidos, 1);
  assert.equal(h.gravados.flat()[0].sku, "854008");
  assert.equal(h.gravados.flat()[0].situacao, "E");
  assert.equal(h.gravados.flat()[0].marca, null);
});

test("detalhe ativo indisponível impede completo e não marca produtos como ausentes", async () => {
  const ex: Existente[] = [{ bling_id: "999", sku: "X999", nome: "Antigo", preco: null, estoque: 0, situacao: "A", sincronizado_em: null }];
  const h = portas([{ id: 1, codigo: "S1", nome: "N1", situacao: "A" }], ex, undefined, [], [], [1]);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, false);
  assert.equal(r.ausentes, 0);
  assert.deepEqual(h.ausentes, []);
  assert.match(r.erro ?? "", /detalhes indisponíveis/);
});

test("listagem vazia inesperada não despublica produtos de uma loja existente", async () => {
  const ex: Existente[] = [{ bling_id: "42", sku: "S42", nome: "Original", preco: 10, estoque: 2, situacao: "A", sincronizado_em: null }];
  const h = portas([], ex);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, false);
  assert.match(r.erro ?? "", /listagem vazia/);
  assert.deepEqual(h.ausentes, []);
});

test("SKU repetido de dois IDs diferentes exige reconciliação, sem inventar cadastro duplicado", async () => {
  const ex: Existente[] = [{ bling_id: "10", sku: "854008", nome: "Original", preco: 10, estoque: 1, situacao: "A", sincronizado_em: null }];
  const h = portas([{ id: 11, codigo: "854008", nome: "Outro ID", preco: 99, situacao: "A" }], ex);
  // O mock retorna código S11 no GET; a lista real permite ver a colisão.
  const originalDetalhe = h.p.detalhe;
  h.p.detalhe = async id => ({ ...await originalDetalhe(id), codigo: "854008" });
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, false);
  assert.equal(r.gravados, 0);
  assert.deepEqual(h.ausentes, []);
  assert.match(r.erro ?? "", /conflitos de SKU/);
});

test("paginação repetida do Bling não passa por varredura completa nem marca ausentes", async () => {
  const a = Array.from({length:100}, (_,i)=>({ id:i+1, codigo:`S${i+1}`, nome:`N${i+1}`, situacao:"A" }));
  const h = portas(a);
  const original = h.p.listarPagina;
  h.p.listarPagina = async (pg, lim, grupo) => pg === 2 && grupo === "ativos" ? { itens: [a[0]] } : original(pg, lim, grupo);
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, false);
  assert.match(r.erro ?? "", /ID repetido/);
  assert.deepEqual(h.ausentes, []);
});

test("mapa do resumo excluído mantém identidade por ID, mesmo sem SKU", () => {
  const l = resumirExcluido("L", {id:100,codigo:"",nome:"Peça excluída"}, undefined, "2026-10-29T00:00:00Z");
  assert.equal(l.sku, null);
  assert.equal(l.bling_id, "100");
  assert.equal(l.situacao, "E");
});
