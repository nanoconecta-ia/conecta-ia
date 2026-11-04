// Caminho de ESCRITA do cadastro de produto novo, SOMENTE contra o Bling SIMULADO (decisão do dono, 04/11/2026: implementar e testar com mock).
// Prova: duplicidade reconferida antes de enviar, falha fechada, timeout com e sem gravação, reconciliação por SKU, idempotência e que nada
// chega ao Bling sem campo liberado. A escrita REAL continua desligada: nenhum campo é liberado em produção por este arquivo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escreverEConfirmarNoBling, reconciliar, type ItemExecucao, type Rpc } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "./bling_campos.ts";
import type { PortaBling } from "./porta_bling.ts";

const LIBERADOS = { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.criar": ["codigo", "nome", "marca", "gtin", "preco_venda"] };
const item = (depois: Record<string, unknown> = {}): ItemExecucao => {
  const d = { codigo: "CI001087", nome: "Bomba de óleo HR 2.5 16V", marca: "Sabó", gtin: "7891000100103", preco_venda: 899.9, ...depois };
  return { item_id: "i1", produto_id: null as never, operacao: "bling.produtos.criar", alvo: null, campos: Object.keys(d), antes: null, depois: d, idempotency_key: "cadastro:L:CI001087" };
};

test("criação sem campo liberado (estado real de hoje): nada chega ao Bling", async () => {
  const b = new BlingMock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item());
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /campo_nao_liberado/);
  assert.equal(b.recebidos.length, 0); assert.equal(b.leituras, 0, "nem leitura: recusa antes de qualquer chamada");
  assert.equal(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.criar"], undefined, "a lista de produção continua sem liberar criação");
});

test("liberado só no teste: cria, confirma lendo de volta, envia a idempotency_key e só os campos permitidos", async () => {
  const b = new BlingMock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
  assert.equal(v.estado, "confirmada", JSON.stringify(v));
  assert.equal(b.recebidos.length, 1); assert.equal(b.recebidos[0].idem, "cadastro:L:CI001087");
  const corpo = b.recebidos[0].corpo as Record<string, unknown>;
  assert.deepEqual([corpo.tipo, corpo.formato, corpo.situacao, corpo.codigo, corpo.preco], ["P", "S", "A", "CI001087", 899.9]);
  for (const proibido of ["ncm", "tributacao", "precoCusto", "fornecedor", "estoque"]) assert.ok(!(proibido in corpo), proibido);
});

test("duplicidade por CÓDIGO criada no Bling depois da aprovação: recusa antes de enviar", async () => {
  const b = new BlingMock().semear("77", { codigo: "CI001087", nome: "Cadastrado à mão no balcão", situacao: "A" });
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /duplicidade: já existe produto ativo com o mesmo código.*id 77.*nada foi enviado/);
  assert.equal(b.recebidos.length, 0); assert.equal(b.produtos.size, 1, "nenhum duplicado criado");
});

test("duplicidade por GTIN: recusa antes de enviar", async () => {
  const b = new BlingMock().semear("78", { codigo: "OUTRO-1", nome: "Mesmo GTIN", gtin: "7891000100103", situacao: "A" });
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /mesmo GTIN/); assert.equal(b.recebidos.length, 0);
});

test("não consegue conferir duplicidade (erro ou timeout na leitura): falha FECHADO, nada enviado, tentativa não gasta", async () => {
  for (const modo of ["status", "timeout"] as const) {
    const b = new BlingMock(); let enviou = 0;
    const porta: PortaBling = Object.assign(Object.create(b), {
      simulado: true, escritaLigada: true,
      ler: async () => { if (modo === "timeout") throw new Error("t"); return { status: 503 }; },
      chamar: async (...a: Parameters<BlingMock["chamar"]>) => b.chamar(...a),
    });
    const v = await escreverEConfirmarNoBling(porta, "bling.produtos.criar", item(), async () => { enviou++; }, LIBERADOS);
    assert.equal(v.estado, "falhou", modo); assert.match(String(v.motivo), /não consegui conferir duplicidade/, modo);
    assert.equal(enviou, 0, `${modo}: a tentativa (aoEnviar) não foi consumida`); assert.equal(b.recebidos.length, 0, modo);
  }
});

test("timeout que GRAVOU: resultado 'desconhecida'; a reconciliação por SKU prova que gravou e não há segundo produto", async () => {
  const b = new BlingMock(); b.falhas.push("timeout_gravou");
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
  assert.equal(v.estado, "desconhecida"); assert.match(String(v.motivo), /timeout/);
  assert.equal(b.produtos.size, 1);
  const chamadas: unknown[] = []; const rpc: Rpc = async (fn, args) => { chamadas.push([fn, args]); return { data: null, error: null }; };
  const r = await reconciliar({ rpc, bling: b, lojaId: "L", operacaoId: "op1", userId: "u1", item: item() });
  assert.equal(r, "gravado"); assert.equal(b.produtos.size, 1, "reconciliar só LÊ: não cria nada");
  assert.ok(JSON.stringify(chamadas).includes("agente_operacao_reconciliar"));
});

test("timeout que NÃO gravou: a reconciliação prova que não gravou (nada no Bling)", async () => {
  const b = new BlingMock(); b.falhas.push("timeout_nao_gravou");
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
  assert.equal(v.estado, "desconhecida"); assert.equal(b.produtos.size, 0);
  const rpc: Rpc = async () => ({ data: null, error: null });
  assert.equal(await reconciliar({ rpc, bling: b, lojaId: "L", operacaoId: "op1", userId: "u1", item: item() }), "nao_gravado");
});

test("Bling recusa (422), limite (429), token expirado (401), 500 e leitura divergente: nunca vira confirmada", async () => {
  const casos: [Parameters<BlingMock["falhas"]["push"]>[0], string][] = [["http_422", "falhou"], ["http_429", "falhou"], ["http_401", "falhou"], ["http_500_gravou", "desconhecida"], ["leitura_diverge", "falhou"]];
  for (const [falha, esperado] of casos) {
    const b = new BlingMock(); b.falhas.push(falha);
    const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item(), undefined, LIBERADOS);
    assert.equal(v.estado, esperado, falha); assert.notEqual(v.estado, "confirmada", falha);
  }
});

test("porta com escrita desligada (BLING_ESCRITA_REAL ausente): recusa ANTES de gastar a tentativa e antes de ler", async () => {
  const b = new BlingMock(); let enviou = 0;
  const porta = Object.assign(Object.create(b), { simulado: false, escritaLigada: false, ler: b.ler.bind(b), chamar: b.chamar.bind(b) }) as PortaBling;
  const v = await escreverEConfirmarNoBling(porta, "bling.produtos.criar", item(), async () => { enviou++; }, LIBERADOS);
  assert.equal(v.estado, "falhou"); assert.match(String(v.motivo), /escrita_real_desligada/); assert.equal(enviou, 0); assert.equal(b.recebidos.length, 0);
});

test("campos proibidos no rascunho aprovado (fiscal, custo, fornecedor, estoque) são recusados mesmo se alguém os liberar na lista", async () => {
  for (const campo of ["ncm", "custo", "fornecedor", "estoque"]) {
    const b = new BlingMock();
    const liberaTudo = { ...LIBERADOS, "bling.produtos.criar": [...LIBERADOS["bling.produtos.criar"], campo] };
    const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item({ [campo]: "x" }), undefined, liberaTudo);
    assert.equal(v.estado, "falhou", campo); assert.equal(b.recebidos.length, 0, `${campo}: nada enviado`);
  }
});
