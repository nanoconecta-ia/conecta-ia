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
function contexto(bling: BlingMock, extra: Record<string, unknown> = {}) {
  const itens: Record<string, unknown>[] = [];
  const rpc: Rpc = async (fn, args) => {
    if (fn === "agente_proposta_item_adicionar") itens.push(args);
    const dados: Record<string, unknown> = { agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } };
    return { data: dados[fn] ?? null, error: null };
  };
  return { ctx: { lojaId: "L", userId: "u1", bling, rpc, dados: { produtoPorSku: async () => null }, agente: { nome: "Nano.ia" }, ...extra } as any, itens };
}

test("a ferramenta é ativa só no chat, MEDIUM, e a criação de produto não tem nenhum campo liberado", () => {
  const d = buscarDefinicao("bling.produtos.preparar_cadastro")!;
  assert.equal(d.estado, "ativa"); assert.equal(d.risco, "MEDIUM"); assert.deepEqual(d.exposicao, { chat: true, mcp: false });
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.criar"], undefined);
});
test("propõe produto novo, sem gravar no Bling, com pendências e fiscal 'a confirmar'", async () => {
  const b = new BlingMock(); const { ctx, itens } = contexto(b);
  const r = await HANDLERS["bling.produtos.preparar_cadastro"]({ rascunho, fontes: URL_F }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.equal(b.recebidos.length, 0, "propor não escreve");
  assert.equal(itens[0].p_operacao, "bling.produtos.criar");
  assert.deepEqual(itens[0].p_antes, null);
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
