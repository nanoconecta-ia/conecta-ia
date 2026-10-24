import { test } from "node:test";
import assert from "node:assert/strict";
import { mapearProduto, precisaDetalhe, sincronizar, type Existente, type ItemLista, type LinhaProduto, type PortasSync } from "./bling_sync.ts";

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

function portas(itens: ItemLista[], ex: Existente[] = [], falhaNaPagina?: number) {
  const gravados: LinhaProduto[][] = []; const erros: string[] = []; let ausentes: string[] = []; let t = AGORA; let detalhes = 0;
  const p: PortasSync = {
    listarPagina: async (pg, lim) => (falhaNaPagina === pg ? { erro: "Bling 503" } : { itens: itens.slice((pg - 1) * lim, pg * lim) }),
    detalhe: async (id) => { detalhes++; return { ...detalheReal, id, codigo: `S${id}`, nome: `N${id}` }; },
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
  assert.equal(r.paginas, 3); assert.equal(r.vistos, 230); assert.equal(r.gravados, 230); assert.equal(r.completo, true);
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

// --- Identidade do produto: ID do Bling dentro da loja; SKU repetido/vazio nunca trava a sincronização ---
function portasIdentidade(itens: ItemLista[], opc: { falhaSeContem?: string; ex?: Existente[]; falhaReconciliar?: boolean } = {}) {
  const gravadas: LinhaProduto[] = []; const erros: { m: string; d?: Record<string, unknown> }[] = []; let reconciliou = 0; let t = AGORA;
  const p: PortasSync = {
    listarPagina: async (pg, lim) => ({ itens: itens.slice((pg - 1) * lim, pg * lim) }),
    detalhe: async (id) => { const it = itens.find((i) => i.id === id)!; return { codigo: it.codigo, nome: it.nome, preco: it.preco, situacao: it.situacao }; },
    existentes: async () => opc.ex ?? [],
    gravar: async (l) => { if (opc.falhaSeContem && l.some((x) => x.bling_id === opc.falhaSeContem)) throw new Error("violação"); gravadas.push(...l); },
    marcarAusentes: async () => {}, registrarErro: async (m, d) => { erros.push({ m, d }); },
    reconciliarIdentidade: async () => { reconciliou++; if (opc.falhaReconciliar) throw new Error("rpc fora do ar"); },
    espera: async (ms) => { t += ms; }, agora: () => t,
  };
  return { p, gravadas, erros, get reconciliou() { return reconciliou; } };
}
const A = (id: number, codigo: string | undefined, extra: Partial<ItemLista> = {}): ItemLista => ({ id, codigo, nome: `N${id}`, preco: 1, situacao: "A", ...extra });

test("SKU repetido: os dois registros chegam ao espelho (cada um com seu ID do Bling) e a identidade é reconciliada", async () => {
  const h = portasIdentidade([A(1, "03044-BREF"), A(2, "03044-BREF"), A(3, "OK")]);
  const r = await sincronizar("L", h.p);
  assert.deepEqual(h.gravadas.map((l) => l.bling_id).sort(), ["1", "2", "3"]);
  assert.equal(r.gravados, 3); assert.equal(r.completo, true); assert.equal(h.reconciliou, 1);
  assert.deepEqual(h.gravadas.filter((l) => l.sku === "03044-BREF").map((l) => l.bling_id), ["1", "2"], "nenhum registro foi descartado nem fundido");
});

test("registro problemático é isolado: os demais do lote são gravados e o erro fica registrado", async () => {
  const h = portasIdentidade([A(1, "X"), A(2, "Y"), A(3, "Z")], { falhaSeContem: "2" });
  const r = await sincronizar("L", h.p);
  assert.deepEqual(h.gravadas.map((l) => l.bling_id).sort(), ["1", "3"]); assert.equal(r.gravados, 2); assert.equal(r.isolados, 1); assert.equal(r.completo, true);
  assert.ok(h.erros.some((e) => e.m.includes("isolado") && e.d?.bling_id === "2"));
  assert.equal(h.reconciliou, 1);
});

test("SKU vazio: o produto é espelhado com SKU nulo (não publica) e não quebra nada", async () => {
  const h = portasIdentidade([A(1, ""), A(2, undefined), A(3, "OK")]);
  const r = await sincronizar("L", h.p);
  assert.equal(r.gravados, 3); assert.deepEqual(h.gravadas.filter((l) => l.sku === null).map((l) => l.bling_id), ["1", "2"]);
});

test("alteração de SKU no Bling é detectada pelo ID (busca o detalhe e regrava a mesma linha)", async () => {
  const e: Existente = { bling_id: "1", sku: "ANTIGO", nome: "N1", preco: 1, estoque: null, situacao: "A", sincronizado_em: new Date(AGORA).toISOString() };
  assert.equal(precisaDetalhe(A(1, "NOVO"), e, AGORA), true);
  const h = portasIdentidade([A(1, "NOVO")], { ex: [e] });
  await sincronizar("L", h.p);
  assert.deepEqual(h.gravadas.map((l) => [l.bling_id, l.sku]), [["1", "NOVO"]]);
});

test("reprocessar sem mudança não regrava, mas continua reconciliando (idempotente)", async () => {
  const ex: Existente[] = [1, 2].map((i) => ({ bling_id: String(i), sku: "IGUAL", nome: `N${i}`, preco: 1, estoque: null, situacao: "A", sincronizado_em: new Date(AGORA).toISOString() }));
  const h = portasIdentidade([A(1, "IGUAL"), A(2, "IGUAL")], { ex });
  const r = await sincronizar("L", h.p);
  assert.equal(r.gravados, 0); assert.equal(h.gravadas.length, 0); assert.equal(h.reconciliou, 1); assert.equal(r.completo, true);
});

test("falha ao reconciliar nunca derruba a sincronização", async () => {
  const h = portasIdentidade([A(1, "X")], { falhaReconciliar: true });
  const r = await sincronizar("L", h.p);
  assert.equal(r.completo, true); assert.equal(r.gravados, 1);
  assert.ok(h.erros.some((e) => e.m.includes("identidade")));
});

test("lojas diferentes com o mesmo SKU: cada linha carrega a própria loja (isolamento)", async () => {
  const h1 = portasIdentidade([A(1, "MESMO")]); const h2 = portasIdentidade([A(1, "MESMO")]);
  await sincronizar("LOJA-1", h1.p); await sincronizar("LOJA-2", h2.p);
  assert.equal(h1.gravadas[0].loja_id, "LOJA-1"); assert.equal(h2.gravadas[0].loja_id, "LOJA-2");
  assert.equal(h1.gravadas[0].bling_id, h2.gravadas[0].bling_id);
});
