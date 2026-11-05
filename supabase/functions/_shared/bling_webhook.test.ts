import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { agruparPorProduto, aplicarEvento, assinaturaValida, disjuntorAberto, eventoParaFila, lerEvento, MAX_TENTATIVAS, proximaTentativaEm, type EventoPendente, type PortasWebhook } from "./bling_webhook.ts";
import type { Existente, LinhaProduto } from "./bling_sync.ts";

const SEGREDO = "segredo-de-teste-do-app";
const corpo = (o: Record<string, unknown> = {}) => JSON.stringify({ eventId: "01945027-150e-72b4-e7cf-4943a042cd9c", date: "2026-11-03T12:18:46Z", version: "v1", event: "product.updated", companyId: "d4475854366a36c86a37e792f9634a51", data: { id: 12345678, nome: "Copo", codigo: "COD-1", situacao: "A", preco: 4.99 }, ...o });
const assinar = (c: string, s = SEGREDO) => "sha256=" + createHmac("sha256", s).update(c).digest("hex");

test("assinatura: válida passa; corpo alterado, segredo errado, sem prefixo e vazio falham", async () => {
  const c = corpo();
  assert.equal(await assinaturaValida(c, assinar(c), SEGREDO), true);
  assert.equal(await assinaturaValida(c + " ", assinar(c), SEGREDO), false, "corpo alterado");
  assert.equal(await assinaturaValida(c, assinar(c, "outro"), SEGREDO), false, "segredo errado");
  assert.equal(await assinaturaValida(c, assinar(c).replace("sha256=", ""), SEGREDO), false, "sem prefixo");
  assert.equal(await assinaturaValida(c, null, SEGREDO), false);
  assert.equal(await assinaturaValida(c, assinar(c), ""), false);
});

test("lerEvento: aceita o formato da documentação; recusa o resto", () => {
  assert.equal(lerEvento(corpo()).ok, true);
  for (const ruim of [corpo({ eventId: "x" }), corpo({ date: "ontem" }), corpo({ companyId: "!!" }), corpo({ event: "order.created" }), corpo({ data: [] }), "{", "[]", "x".repeat(70_000)])
    assert.equal(lerEvento(ruim).ok, false, ruim.slice(0, 40));
});

test("fila: produto, estoque e apagado viram o tipo certo; chave de idempotência é o eventId; sem preço/custo no payload", () => {
  const p = lerEvento(corpo());
  assert.ok(p.ok); const f = eventoParaFila(p.evento)!;
  assert.deepEqual([f.tipo, f.bling_id, f.chave_idempotencia, f.versao_origem], ["produto", "12345678", "01945027-150e-72b4-e7cf-4943a042cd9c", "2026-11-03T12:18:46.000Z"]);
  assert.deepEqual(f.payload, { evento: "product.updated", situacao: "A" });
  assert.ok(!JSON.stringify(f).includes("4.99"));
  const e = lerEvento(corpo({ event: "stock.updated", data: { produto: { id: 77 }, saldoFisicoTotal: 3 } })); assert.ok(e.ok);
  assert.deepEqual([eventoParaFila(e.evento)!.tipo, eventoParaFila(e.evento)!.bling_id], ["estoque", "77"]);
  const d = lerEvento(corpo({ event: "product.deleted", data: { id: 5 } })); assert.ok(d.ok);
  assert.equal(eventoParaFila(d.evento)!.tipo, "inativacao");
  const sem = lerEvento(corpo({ event: "stock.updated", data: {} })); assert.ok(sem.ok);
  assert.equal(eventoParaFila(sem.evento), null);
});

function portas(o: Partial<PortasWebhook> & { existente?: Existente } = {}) {
  const gravadas: LinhaProduto[] = []; const excluidos: string[] = [];
  const p: PortasWebhook = {
    detalhe: o.detalhe ?? (async (id) => ({ id, codigo: "COD-1", nome: "Copo", preco: 4.99, situacao: "A", estoque: { saldoVirtualTotal: 7 }, fornecedor: { precoCusto: 1 } })),
    existente: async () => o.existente,
    gravar: async (l) => { gravadas.push(l); },
    marcarExcluido: async (id) => { excluidos.push(id); },
    agora: () => Date.parse("2026-11-03T12:20:00Z"),
  };
  return { p, gravadas, excluidos };
}
const ev = (o: Partial<EventoPendente> = {}): EventoPendente => ({ id: "e1", tipo: "produto", bling_id: "12345678", versao_origem: "2026-11-03T12:18:46.000Z", tentativas: 0, payload: { evento: "product.updated", situacao: "A" }, ...o });

test("aplicar: busca o dado atual no Bling, grava no espelho e jamais copia custo/fornecedor", async () => {
  const { p, gravadas } = portas();
  const r = await aplicarEvento("L", ev(), p);
  assert.equal(r.status, "aplicado"); assert.equal(gravadas.length, 1);
  assert.equal(gravadas[0].estoque, 7); assert.equal(gravadas[0].loja_id, "L");
  assert.ok(!JSON.stringify(gravadas[0]).includes("precoCusto"));
});

test("aplicar: evento mais antigo que a última sincronização não regrava", async () => {
  const existente: Existente = { bling_id: "12345678", sku: "COD-1", nome: "Copo", preco: 4.99, estoque: 7, situacao: "A", sincronizado_em: "2026-11-03T12:19:30.000Z" };
  const { p, gravadas } = portas({ existente });
  assert.equal((await aplicarEvento("L", ev(), p)).status, "ignorado"); assert.equal(gravadas.length, 0);
});

test("aplicar: product.deleted marca excluído; excluído via updated sem detalhe preserva e força E", async () => {
  const a = portas(); assert.equal((await aplicarEvento("L", ev({ tipo: "inativacao" }), a.p)).status, "aplicado"); assert.deepEqual(a.excluidos, ["12345678"]);
  const b = portas({ detalhe: async () => null, existente: { bling_id: "12345678", sku: "COD-1", nome: "Copo", preco: 4.99, estoque: 2, situacao: "A", sincronizado_em: "2026-11-01T00:00:00Z" } });
  const r = await aplicarEvento("L", ev({ payload: { evento: "product.updated", situacao: "E" } }), b.p);
  assert.equal(r.status, "aplicado"); assert.equal(b.gravadas[0].situacao, "E"); assert.equal(b.gravadas[0].sku, "COD-1");
});

test("aplicar: Bling fora do ar/limite vira erro com nova tentativa; esgotadas as tentativas vira definitivo", async () => {
  const { p, gravadas } = portas({ detalhe: async () => "erro" });
  const r1 = await aplicarEvento("L", ev({ tentativas: 0 }), p);
  assert.deepEqual([r1.status, (r1 as { definitivo: boolean }).definitivo], ["erro", false]);
  const r2 = await aplicarEvento("L", ev({ tentativas: MAX_TENTATIVAS - 1 }), p);
  assert.equal((r2 as { definitivo: boolean }).definitivo, true); assert.equal(gravadas.length, 0);
  const r3 = await aplicarEvento("L", ev(), portas({ detalhe: async () => null }).p);
  assert.equal(r3.status, "erro", "404 sem situação E não apaga nada");
});

test("espera crescente, disjuntor e agrupamento por produto", () => {
  const t = (n: number) => Date.parse(proximaTentativaEm(n, 0));
  assert.deepEqual([t(0), t(1), t(2)], [30_000, 60_000, 120_000]); assert.equal(t(20), 3_600_000);
  assert.equal(disjuntorAberto(4), false); assert.equal(disjuntorAberto(5), true);
  const g = agruparPorProduto([{ bling_id: "1" }, { bling_id: "2" }, { bling_id: "1" }]);
  assert.deepEqual([g.get("1")!.length, g.get("2")!.length, g.size], [2, 1, 2]);
});
