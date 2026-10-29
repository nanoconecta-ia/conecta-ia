// Porta de escrita real do Bling: lista fechada, desligada por padrão, sem repetição, sem enviar a chave de idempotência. Sem rede: fetch injetado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cifrar } from "../cripto.ts";
import type { Armazem, CredCifrada } from "../bling_token.ts";
import { BlingEscritaReal, BlingLeituraReal, FERRAMENTAS_ESCRITA_REAL, INTERVALO_ESCRITA_MS } from "./porta_bling.ts";
import { escreverEConfirmarNoBling, type ItemExecucao } from "./executor.ts";

const chave = randomBytes(32).toString("base64");
const AGORA = Date.parse("2026-10-28T12:00:00Z");
async function armazem(): Promise<Armazem> {
  const cred: CredCifrada = { access_token_cifrado: await cifrar("ACC-SINTETICO", chave), refresh_token_cifrado: await cifrar("REF-SINTETICO", chave), expira_em: new Date(AGORA + 120 * 60_000).toISOString() };
  return { ler: async () => cred, reservar: async () => true, liberar: async () => {}, salvar: async () => {}, marcar: async () => {}, lerApp: async () => null };
}
interface Chamada { url: string; metodo: string; corpo?: string; cabecalhos: Record<string, string> }
const resp = (status: number, corpo: unknown = {}) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
async function porta(ligada: boolean, responder: (c: Chamada) => Response | Promise<Response>, esperas: number[] = []) {
  const chamadas: Chamada[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const c: Chamada = { url, metodo: String(init.method), corpo: init.body as string | undefined, cabecalhos: init.headers as Record<string, string> };
    chamadas.push(c); return responder(c);
  }) as unknown as typeof fetch;
  const p = new BlingEscritaReal(await armazem(), "L", { chaveCifra: chave, fetch: f, agora: () => AGORA, espera: async (ms: number) => { esperas.push(ms); } }, ligada);
  return { p, chamadas, esperas };
}

test("desligada (padrão): recusa antes de qualquer chamada de rede", async () => {
  const { p, chamadas } = await porta(false, () => resp(201));
  assert.equal(p.escritaLigada, false);
  await assert.rejects(() => p.chamar("bling.categorias.criar", { corpo: { descricao: "X" } }, "k"), /escrita_real_desligada/);
  assert.equal(chamadas.length, 0);
});

test("leitura real nunca escreve e se declara sem escrita", async () => {
  const l = new BlingLeituraReal(await armazem(), "L", { chaveCifra: chave });
  assert.equal(l.escritaLigada, false);
  assert.throws(() => l.chamar(), /escrita_real_desligada/);
});

test("lista fechada: só produtos.alterar e categorias.criar; o resto (inclui estoque, pedido, contato, produtos.criar) é recusado", async () => {
  assert.deepEqual([...FERRAMENTAS_ESCRITA_REAL].sort(), ["bling.categorias.criar", "bling.produtos.alterar"]);
  const { p, chamadas } = await porta(true, () => resp(201));
  for (const f of ["bling.estoque.lancar", "bling.pedidos_venda.criar", "bling.contatos.criar", "bling.produtos.criar", "bling.nfe.listar", "qualquer"]) {
    await assert.rejects(() => p.chamar(f, { corpo: { a: 1 } }, "k"), /escrita_nao_suportada/, f);
  }
  assert.equal(chamadas.length, 0);
});

test("categoria: POST /categorias/produtos com Bearer, enable-jwt e corpo JSON; a chave de idempotência NÃO vai ao Bling", async () => {
  const { p, chamadas } = await porta(true, () => resp(201, { data: { id: 77 } }));
  const r = await p.chamar("bling.categorias.criar", { corpo: { descricao: "Injeção diesel" } }, "chave-idem-123");
  assert.equal(r.status, 201); assert.deepEqual(r.corpo, { data: { id: 77 } });
  const c = chamadas[0];
  assert.equal(c.metodo, "POST"); assert.equal(c.url, "https://api.bling.com.br/Api/v3/categorias/produtos");
  assert.equal(c.cabecalhos["enable-jwt"], "1"); assert.match(c.cabecalhos.Authorization, /^Bearer ACC-SINTETICO$/);
  assert.deepEqual(JSON.parse(c.corpo!), { descricao: "Injeção diesel" });
  assert.ok(!JSON.stringify(c).includes("chave-idem-123"), "a chave de idempotência não sai do Conecta.IA");
});

test("produto: PATCH /produtos/{id} só com id numérico", async () => {
  const { p, chamadas } = await porta(true, () => resp(200, {}));
  await p.chamar("bling.produtos.alterar", { id: "701", corpo: { categoria: { id: 14676577 } } }, "k");
  assert.equal(chamadas[0].metodo, "PATCH"); assert.equal(chamadas[0].url, "https://api.bling.com.br/Api/v3/produtos/701");
  for (const id of [undefined, "", "70a", "../1", "701/estoques", "1;drop"]) {
    await assert.rejects(() => p.chamar("bling.produtos.alterar", { id, corpo: { categoria: { id: 1 } } }, "k"), /alvo_invalido/, String(id));
  }
  assert.equal(chamadas.length, 1);
});

test("corpo: precisa ser objeto e não pode ter campo proibido (preço, fiscal, estoque, SKU...) em nenhum nível", async () => {
  const { p, chamadas } = await porta(true, () => resp(200));
  for (const corpo of [null, "texto", [1], 5]) await assert.rejects(() => p.chamar("bling.categorias.criar", { corpo }, "k"), /corpo_invalido/);
  for (const corpo of [{ preco: 1 }, { descricao: "x", estoque: { minimo: 1 } }, { categoria: { id: 1 }, tributacao: { ncm: "1" } }, { codigo: "SKU" }]) {
    await assert.rejects(() => p.chamar("bling.produtos.alterar", { id: "1", corpo }, "k"), /campo_proibido/);
  }
  assert.equal(chamadas.length, 0);
});

test("ritmo: no máximo ~3 escritas por segundo (espera entre duas escritas seguidas)", async () => {
  const esperas: number[] = [];
  const { p } = await porta(true, () => resp(201), esperas);
  await p.chamar("bling.categorias.criar", { corpo: { descricao: "A" } }, "k1");
  await p.chamar("bling.categorias.criar", { corpo: { descricao: "B" } }, "k2");
  assert.ok(esperas.length >= 1 && esperas[0] > 0 && esperas[0] <= INTERVALO_ESCRITA_MS, JSON.stringify(esperas));
});

test("nunca repete escrita às cegas: 500 e 429 voltam uma vez só (quem decide é o executor)", async () => {
  for (const status of [500, 429, 502]) {
    const { p, chamadas } = await porta(true, () => resp(status));
    const r = await p.chamar("bling.categorias.criar", { corpo: { descricao: "X" } }, "k");
    assert.equal(r.status, status); assert.equal(chamadas.length, 1, `status ${status}`);
  }
});

test("timeout/erro de rede sobe como exceção (o executor marca DESCONHECIDO, nunca 'falhou')", async () => {
  const { p } = await porta(true, () => { throw new TypeError("fetch failed"); });
  await assert.rejects(() => p.chamar("bling.categorias.criar", { corpo: { descricao: "X" } }, "k"), /fetch failed/);
});

const item = (operacao: string, depois: Record<string, unknown>, alvo: string | null = "701"): ItemExecucao => ({ item_id: "i1", produto_id: "p1", operacao, alvo, campos: Object.keys(depois), antes: {}, depois, idempotency_key: "k1" });

test("executor: porta com escrita desligada falha ANTES de marcar 'enviada' (a aprovação e a tentativa não se gastam)", async () => {
  const { p, chamadas } = await porta(false, () => resp(201));
  let marcouEnviada = false;
  const v = await escreverEConfirmarNoBling(p, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "Injeção diesel" }, null), async () => { marcouEnviada = true; });
  assert.equal(v.estado, "falhou"); assert.match(v.motivo ?? "", /escrita_real_desligada/);
  assert.equal(marcouEnviada, false); assert.equal(chamadas.length, 0);
});

test("executor + porta real ligada (fetch injetado): categoria é criada e CONFIRMADA pela leitura; sem a leitura não há sucesso", async () => {
  const lista: { id: number; descricao: string }[] = [];
  const { p, chamadas } = await porta(true, (c) => {
    if (c.metodo === "POST") { lista.push({ id: 5, descricao: JSON.parse(c.corpo!).descricao }); return resp(201, { data: { id: 5 } }); }
    return resp(200, { data: lista });
  });
  const v = await escreverEConfirmarNoBling(p, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "Injeção diesel" }, null));
  assert.equal(v.estado, "confirmada"); assert.deepEqual(chamadas.map((c) => c.metodo), ["POST", "GET"]);
  // gravou, mas a leitura não mostra a categoria => DESCONHECIDO (nunca sucesso)
  const { p: p2 } = await porta(true, (c) => (c.metodo === "POST" ? resp(201, { data: { id: 6 } }) : resp(200, { data: [] })));
  const v2 = await escreverEConfirmarNoBling(p2, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "Outra" }, null));
  assert.equal(v2.estado, "desconhecida");
});

test("executor + porta real: timeout na escrita => desconhecida; 5xx => desconhecida; 422 => falhou; campo não liberado nem chega à rede", async () => {
  const t = await porta(true, () => { throw new Error("timeout"); });
  assert.equal((await escreverEConfirmarNoBling(t.p, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "A" }, null))).estado, "desconhecida");
  const e5 = await porta(true, () => resp(503));
  assert.equal((await escreverEConfirmarNoBling(e5.p, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "A" }, null))).estado, "desconhecida");
  const e422 = await porta(true, () => resp(422, { error: "x" }));
  assert.equal((await escreverEConfirmarNoBling(e422.p, "bling.categorias.criar", item("bling.categorias.criar", { descricao: "A" }, null))).estado, "falhou");
  const fora = await porta(true, () => resp(200));
  const v = await escreverEConfirmarNoBling(fora.p, "bling.produtos.alterar", item("bling.produtos.alterar", { preco: 1 }));
  assert.equal(v.estado, "falhou"); assert.match(v.motivo ?? "", /campo_nao_liberado/); assert.equal(fora.chamadas.length, 0);
});
