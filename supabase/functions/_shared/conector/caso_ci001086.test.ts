// Caso real do teste do site: CI001086 (bomba de óleo). O Bling devolve a marca como " MARCA: TRIM GO" (espaço e prefixo no valor).
// Sem rede e sem banco: roda o executor de produção contra o Bling SIMULADO, semeado SÓ com campos públicos lidos do Bling em 2026-10-31
// (nada de custo, fornecedor ou fiscal entra no repositório). Prova o contrato da edição real: só a marca muda, o resto fica intacto,
// a leitura de confirmação decide, e o valor antigo permite desfazer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escreverEConfirmarNoBling, reconciliar, type ItemExecucao, type Rpc } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";

const ID = "16719530080";
const NOME = "BOMBA OLEO HR/K2500 2.5 16V 13/ D4CB EURO V 26 DTS ALUMINIO - MARCA: TRIM GO";
const MARCA_ANTIGA = " MARCA: TRIM GO";
const semear = () => new BlingMock().semear(ID, { codigo: "CI001086", nome: NOME, marca: MARCA_ANTIGA, preco: 939.466667, categoria: { id: 14676549 }, situacao: "A", pesoBruto: 5 });
const item = (depois: Record<string, unknown>, antes: Record<string, unknown> = { marca: MARCA_ANTIGA }, campos = Object.keys(depois)): ItemExecucao =>
  ({ item_id: "i1", produto_id: "p1", operacao: "bling.produtos.alterar", alvo: ID, campos, antes, depois, idempotency_key: "ci001086-marca-1" });

test("CI001086: troca só a marca, confirma lendo o Bling e deixa nome, preço, categoria, código, situação e peso intactos", async () => {
  const b = semear();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "TRIM GO" }));
  assert.equal(v.estado, "confirmada");
  assert.deepEqual(b.recebidos.map((r) => r.corpo), [{ marca: "TRIM GO" }], "o corpo enviado tem UM campo");
  const p = b.produtos.get(ID)!;
  assert.equal(p.marca, "TRIM GO");
  assert.equal(p.nome, NOME, "o nome (que também traz o texto MARCA:) não é tocado nesta edição");
  assert.equal(p.preco, 939.466667); assert.equal(p.categoria.id, 14676549); assert.equal(p.codigo, "CI001086");
  assert.equal(p.situacao, "A"); assert.equal(p.pesoBruto, 5);
  assert.ok(b.leituras >= 1, "houve leitura de confirmação");
});

test("CI001086: o desfazer restaura exatamente o valor anterior guardado em `antes`", async () => {
  const b = semear();
  await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "TRIM GO" }));
  const volta = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: MARCA_ANTIGA }, { marca: "TRIM GO" }));
  assert.equal(volta.estado, "confirmada");
  assert.equal(b.produtos.get(ID)!.marca, MARCA_ANTIGA);
});

test("CI001086: preço, custo, fornecedor, estoque, NCM e SKU junto com a marca recusam o item inteiro, sem enviar nada", async () => {
  for (const campo of ["preco", "custo", "fornecedor", "estoque", "ncm", "sku"]) {
    const b = semear();
    const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "TRIM GO", [campo]: 1 }));
    assert.equal(v.estado, "falhou", campo);
    assert.match(v.motivo ?? "", /campo_nao_liberado/, campo);
    assert.equal(b.recebidos.length, 0, `${campo}: nada enviado`);
    assert.equal(b.produtos.get(ID)!.marca, MARCA_ANTIGA, `${campo}: produto simulado não mudou`);
  }
});

test("CI001086: marca vazia é recusada (não apaga a marca no Bling)", async () => {
  const b = semear();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "   " }));
  assert.equal(v.estado, "falhou"); assert.match(v.motivo ?? "", /corpo_invalido/); assert.equal(b.recebidos.length, 0);
});

test("CI001086: timeout depois de gravar vira 'desconhecida' e a reconciliação prova que gravou, sem repetir a escrita", async () => {
  const b = semear(); b.falhas = ["timeout_gravou"];
  const it = item({ marca: "TRIM GO" });
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", it);
  assert.equal(v.estado, "desconhecida");
  assert.equal(b.recebidos.length, 1, "uma única tentativa de escrita");
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async (fn, args) => { chamadas.push({ fn, args }); return { data: null, error: null }; };
  const r = await reconciliar({ rpc, bling: b, lojaId: "L", operacaoId: "op1", userId: "u1", item: it });
  assert.equal(r, "gravado");
  assert.equal(b.recebidos.length, 1, "reconciliar só lê");
  assert.equal(chamadas[0].fn, "agente_operacao_reconciliar");
  assert.equal(chamadas[0].args.p_resultado, "gravado");
});

test("CI001086: Bling devolve outra marca na leitura de confirmação => 'falhou' com a divergência (nunca sucesso sem prova)", async () => {
  const b = semear(); b.falhas = ["leitura_diverge"];
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "TRIM GO" }));
  assert.notEqual(v.estado, "confirmada");
});
