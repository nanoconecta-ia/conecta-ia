// F3: produto NOVO por proposta. Sem rede e sem banco: Bling SIMULADO. Prova duplicidade, evidência de marca, que nada é gravado ao propor,
// que a escrita real de criação continua DESLIGADA (nenhum campo liberado) e que, liberada só no teste, o ciclo cria e confirma lendo o Bling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escreverEConfirmarNoBling, type ItemExecucao, type Rpc } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { HANDLERS } from "./handlers.ts";
import { CAMPOS_ESCRITA_LIBERADOS, montarCorpoCriacao } from "./bling_campos.ts";
import { buscarDefinicao } from "./registro.ts";

const URL_F = [{ url: "https://www.sabo.com.br/catalogo/x" }];
const rascunho = { codigo: "CI001087", nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó", gtin: "7891000100103", preco_venda: 899.9 };
/** Banco simulado: propostas abertas, itens de cadastro novo em aberto e SKUs CI do espelho. A cadeia do Supabase é "thenable". */
export function adminFake(o: { propostas?: string[]; itens?: number; skus?: string[]; erro?: "propostas" | "itens" | "produtos" } = {}) {
  const resultado = (t: string) => {
    if (o.erro === "propostas" && t === "agente_propostas" || o.erro === "itens" && t === "agente_proposta_itens" || o.erro === "produtos" && t === "produtos") return { data: null, error: { message: "falha" } };
    if (t === "agente_propostas") return { data: (o.propostas ?? []).map((id) => ({ id })), error: null };
    if (t === "agente_proposta_itens") return { data: Array.from({ length: o.itens ?? 0 }, (_, i) => ({ id: String(i) })), error: null };
    return { data: (o.skus ?? []).map((sku) => ({ sku })), error: null };
  };
  return { from: (t: string) => { const q: any = { select: () => q, eq: () => q, in: () => q, like: () => q, then: (r: (v: unknown) => unknown) => r(resultado(t)) }; return q; } };
}
function contexto(bling: BlingMock, extra: Record<string, unknown> = {}) {
  const itens: Record<string, unknown>[] = [];
  const rpc: Rpc = async (fn, args) => {
    if (fn === "agente_proposta_item_adicionar") itens.push(args);
    const dados: Record<string, unknown> = { agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } };
    return { data: dados[fn] ?? null, error: null };
  };
  return { ctx: { lojaId: "L", userId: "u1", bling, rpc, dados: { produtoPorSku: async () => null }, admin: adminFake(), agente: { nome: "Nano.ia" }, ...extra } as any, itens };
}

test("a ferramenta é ativa no chat e no MCP (só propõe), MEDIUM, e a criação de produto não tem nenhum campo liberado", () => {
  const d = buscarDefinicao("bling.produtos.preparar_cadastro")!;
  assert.equal(d.estado, "ativa"); assert.equal(d.risco, "MEDIUM"); assert.deepEqual(d.exposicao, { chat: true, mcp: true }, "ordem do dono 02/11/2026: o agente externo propõe produto novo pelo MCP");
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.criar"], undefined);
});
test("propõe produto novo, sem gravar no Bling, com pendências e fiscal 'a confirmar'", async () => {
  const b = new BlingMock(); const { ctx, itens } = contexto(b);
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.equal(b.recebidos.length, 0, "propor não escreve");
  assert.equal(itens[0].p_operacao, "bling.produtos.criar");
  assert.deepEqual(itens[0].p_antes, {}, "produto novo: nada existia antes; o banco exige antes preenchido quando há campos");
  const val = itens[0].p_validacoes as string[];
  assert.ok(val.some((v) => /fiscais/.test(v)) && val.some((v) => /imagens/.test(v)) && val.some((v) => /marca: evidência url_externa/.test(v)));
});
test("duplicidade por código ou GTIN no Bling bloqueia a proposta", async () => {
  const b = new BlingMock().semear("9", { codigo: "CI001087", nome: "Já existe", situacao: "A" });
  const { ctx, itens } = contexto(b);
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.match(r.aviso, /duplicaria/); assert.equal(r.conflitos[0].por, "codigo (Bling)"); assert.equal(itens.length, 0);
  const g = new BlingMock().semear("8", { codigo: "OUTRO", gtin: "7891000100103", situacao: "A" });
  const r2 = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, contexto(g).ctx) as any;
  assert.equal(r2.conflitos[0].por, "gtin (Bling)");
});
test("duplicidade no espelho e leitura do Bling indisponível bloqueiam", async () => {
  const { ctx, itens } = contexto(new BlingMock(), { dados: { produtoPorSku: async () => ({ id: "x", nome: "Local" }) } });
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.equal(r.conflitos[0].por, "codigo (espelho)"); assert.equal(itens.length, 0);
  const b = new BlingMock(); const falha = { ...b, simulado: true, ler: async () => ({ status: 503 }) } as any;
  const r2 = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, contexto(falha).ctx) as any;
  assert.match(r2.erro, /503/);
});
test("marca inventada, fiscal e custo no rascunho recusam sem proposta", async () => {
  for (const r of [{ ...rascunho, marca: "Bosch Premium Line" }, { ...rascunho, ncm: "8413.30.00" }, { ...rascunho, custo: 10 }]) {
    const { ctx, itens } = contexto(new BlingMock());
    const res = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: r, fontes: [{ documento: "Catálogo" }] }, ctx) as any;
    assert.equal(res.erro, "Rascunho recusado"); assert.equal(itens.length, 0);
  }
});
test("corpo de criação: código e preço seguem só aqui; tipo/formato/situação fixos; extras recusados", () => {
  const m = montarCorpoCriacao({ codigo: "CI001087", nome: "Bomba de óleo HR", marca: "Sabó", preco_venda: 10, peso_kg: 1 });
  assert.deepEqual(m.erros, []);
  assert.deepEqual(m.corpo, { marca: "Sabó", pesoBruto: 1, codigo: "CI001087", nome: "Bomba de óleo HR", tipo: "P", formato: "S", situacao: "A", preco: 10 });
  assert.ok(montarCorpoCriacao({ codigo: "CI001087", nome: "Bomba de óleo HR", ncm: "1" }).erros.length > 0);
});
const itemCriar = (depois: Record<string, unknown>): ItemExecucao => ({ item_id: "i1", produto_id: null as any, operacao: "bling.produtos.criar", alvo: null, campos: Object.keys(depois), antes: null, depois, idempotency_key: "cadastro:L:CI001087" });
test("execução real de criação continua recusada (nenhum campo liberado)", async () => {
  const b = new BlingMock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", itemCriar({ codigo: "CI001087", nome: "Bomba de óleo HR" }));
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /campo_nao_liberado/); assert.equal(b.recebidos.length, 0);
});
test("ensaio com liberação SÓ no teste: cria no Bling simulado e confirma lendo de volta", async () => {
  const b = new BlingMock();
  const liberados = { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.criar": ["codigo", "nome", "marca", "preco_venda"] };
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", itemCriar({ codigo: "CI001087", nome: "Bomba de óleo HR", marca: "Sabó", preco_venda: 899.9 }), undefined, liberados);
  assert.equal(v.estado, "confirmada", JSON.stringify(v));
  assert.equal(b.recebidos.length, 1);
  assert.equal([...b.produtos.values()][0].codigo, "CI001087");
});

// ── Piloto "um por vez" e SKU automático (CI + 6 dígitos): ordem do dono, 02/11/2026
const semCodigo = { nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó" };
test("piloto: já existe um cadastro novo aguardando decisão -> não propõe outro, e diz como liberar", async () => {
  const b = new BlingMock(); const { ctx, itens } = contexto(b, { admin: adminFake({ propostas: ["p9"], itens: 1 }) });
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.match(r.aviso, /Piloto: já há 1 cadastro\(s\) novo\(s\) aguardando decisão/); assert.match(r.aviso, /subir é decisão do dono/); assert.equal(itens.length, 0);
});
test("piloto: proposta aberta que NÃO é de cadastro novo (ex.: troca de marca) não bloqueia", async () => {
  const { ctx } = contexto(new BlingMock(), { admin: adminFake({ propostas: ["p9"], itens: 0 }) });
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
});
test("piloto: se não consegue conferir o banco, falha FECHADO (nada é proposto)", async () => {
  for (const erro of ["propostas", "itens"] as const) {
    const { ctx, itens } = contexto(new BlingMock(), { admin: adminFake({ propostas: ["p9"], itens: 0, erro }) });
    const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
    assert.match(r.erro, /por segurança nada foi proposto/, erro); assert.equal(itens.length, 0);
  }
});
test("SKU automático: sem código no rascunho, propõe CI + 6 dígitos depois do maior do espelho e avisa que a aprovação é do lojista", async () => {
  const { ctx, itens } = contexto(new BlingMock(), { admin: adminFake({ skus: ["CI000016", "CI001086", "CI000500"] }) });
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: semCodigo, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.equal((itens[0].p_depois as Record<string, unknown>).codigo, "CI001087");
  assert.ok((itens[0].p_validacoes as string[]).some((v) => /SKU CI001087 proposto automaticamente.*a aprovação é sua/.test(v)));
});
test("SKU automático: se o Bling já tem o candidato (mesmo fora do espelho), pula para o próximo; nunca reutiliza", async () => {
  const b = new BlingMock().semear("9", { codigo: "CI001087", nome: "Já existe no Bling", situacao: "E" });
  const { ctx, itens } = contexto(b, { admin: adminFake({ skus: ["CI001086"] }) });
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: semCodigo, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r)); assert.equal((itens[0].p_depois as Record<string, unknown>).codigo, "CI001088");
});
test("SKU automático: Bling indisponível ou banco com erro -> nenhum SKU é inventado", async () => {
  const b = new BlingMock(); const falha = { ...b, simulado: true, ler: async () => ({ status: 503 }) } as any;
  const a = contexto(falha); const r1 = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: semCodigo, fontes: URL_F }, a.ctx) as any;
  assert.ok(r1.erro || r1.aviso, JSON.stringify(r1)); assert.equal(a.itens.length, 0);
  const c2 = contexto(new BlingMock(), { admin: adminFake({ erro: "produtos" }) });
  assert.match((await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho: semCodigo, fontes: URL_F }, c2.ctx) as any).erro, /nenhum SKU foi proposto/); assert.equal(c2.itens.length, 0);
});
test("com código informado pela pessoa, o SKU automático não entra (e nenhum aviso de SKU automático)", async () => {
  const { ctx, itens } = contexto(new BlingMock());
  await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx);
  assert.ok(!(itens[0].p_validacoes as string[]).some((v) => /proposto automaticamente/.test(v)));
});
