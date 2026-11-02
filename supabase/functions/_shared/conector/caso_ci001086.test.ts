// Caso real do teste do site: CI001086 (bomba de óleo). O Bling devolve a marca como " MARCA: TRIM GO" (espaço e prefixo no valor).
// Sem rede e sem banco: roda o executor de produção contra o Bling SIMULADO, semeado SÓ com campos públicos lidos do Bling em 2026-10-31
// (nada de custo, fornecedor ou fiscal entra no repositório). Prova o contrato da edição real: só a marca muda, o resto fica intacto,
// a leitura de confirmação decide, e o valor antigo permite desfazer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escreverEConfirmarNoBling, reconciliar, type ItemExecucao, type Rpc } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { HANDLERS } from "./handlers.ts";
import type { PortaBling } from "./porta_bling.ts";

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

// A LISTAGEM do Bling é um resumo (sem marca, descrições, peso, medidas). Antes desta correção a proposta lia o "antes" dela e
// gravava marca = null, escondendo o valor real " MARCA: TRIM GO" e perdendo o texto do desfazer.
function portaComListagemResumida(): PortaBling & { lidos: string[] } {
  const lidos: string[] = [];
  return {
    simulado: true, lidos,
    async chamar() { throw new Error("a preparação da proposta não escreve"); },
    async ler(ferramenta: string, args: { id?: string; sku?: string }) {
      lidos.push(ferramenta);
      if (ferramenta === "bling.produtos.consultar") return { status: 200, corpo: { data: [{ id: Number(ID), codigo: "CI001086", nome: NOME, situacao: "A", preco: 939.466667 }] } };
      if (ferramenta === "bling.produtos.confirmar" && args.id === ID) return { status: 200, corpo: { data: { id: Number(ID), codigo: "CI001086", nome: NOME, situacao: "A", marca: MARCA_ANTIGA } } };
      return { status: 404 };
    },
  };
}
function contextoDeProposta(bling: PortaBling) {
  const itens: Record<string, unknown>[] = [];
  const rpc: Rpc = async (fn, args) => {
    if (fn === "agente_proposta_item_adicionar") itens.push(args);
    const dados: Record<string, unknown> = { agente_tarefa_criar: "t1", agente_proposta_criar: "p1", agente_proposta_enviar: { versao: 1, hash: "h", risco: "MEDIUM" } };
    return { data: dados[fn] ?? null, error: null };
  };
  const ctx = { lojaId: "L", userId: "u1", bling, rpc, dados: { produtoPorSku: async () => ({ id: "prod-1" }) }, agente: { nome: "Nano.ia" } } as any;
  return { ctx, itens };
}

test("CI001086: a proposta registra o valor REAL anterior da marca (lido pelo id), não null", async () => {
  const bling = portaComListagemResumida();
  const { ctx, itens } = contextoDeProposta(bling);
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "TRIM GO" }, fontes: [{ documento: "cadastro do Bling" }] }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.equal(itens.length, 1);
  assert.deepEqual(itens[0].p_antes, { marca: MARCA_ANTIGA });
  assert.deepEqual(itens[0].p_depois, { marca: "TRIM GO" });
  assert.equal(itens[0].p_alvo, ID);
  assert.deepEqual(bling.lidos, ["bling.produtos.consultar", "bling.produtos.confirmar"], "lê a listagem para achar o id e a leitura completa para o antes");
});

test("CI001086: se a leitura completa falha, NÃO cria proposta (sem o antes não há desfazer)", async () => {
  const bling = portaComListagemResumida();
  const falha: PortaBling = { ...bling, ler: async (f: string, a: any) => (f === "bling.produtos.confirmar" ? { status: 503 } : bling.ler(f as any, a)) };
  const { ctx, itens } = contextoDeProposta(falha);
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "TRIM GO" }, fontes: [{ documento: "x" }] }, ctx) as any;
  assert.match(r.erro, /503/);
  assert.equal(itens.length, 0);
});

// Marca nunca inventada (ordem do dono, 02/11/2026): o agente só propõe marca com evidência.
test("CI001086: a proposta de marca registra a evidência 'declarada no cadastro' (não verificada) nas validações", async () => {
  const { ctx, itens } = contextoDeProposta(portaComListagemResumida());
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "TRIM GO" }, fontes: [{ documento: "Cadastro do próprio Bling" }] }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r));
  assert.ok((itens[0].p_validacoes as string[]).some((v) => /declarada_no_cadastro/.test(v) && /não verificada/.test(v)));
});
test("CI001086: marca fora do cadastro e sem URL (o modelo chutando) NÃO vira proposta", async () => {
  const { ctx, itens } = contextoDeProposta(portaComListagemResumida());
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Bosch Premium Line" }, fontes: [{ documento: "Catálogo do fabricante" }] }, ctx) as any;
  assert.equal(r.erro, "Marca recusada"); assert.match(String(r.detalhes), /Sem evidência/); assert.equal(itens.length, 0);
});
test("CI001086: IMPORTADO/NACIONAL como marca é recusado mesmo com URL; marca nova com URL do fabricante passa", async () => {
  for (const marca of ["IMPORTADO", "NACIONAL"]) {
    const { ctx, itens } = contextoDeProposta(portaComListagemResumida());
    const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca }, fontes: [{ url: "https://fabricante.exemplo.com.br/x" }] }, ctx) as any;
    assert.equal(r.erro, "Marca recusada", marca); assert.equal(itens.length, 0);
  }
  const { ctx, itens } = contextoDeProposta(portaComListagemResumida());
  const r = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: [{ url: "https://www.sabo.com.br/catalogo/x" }] }, ctx) as any;
  assert.equal(r.proposta_id, "p1", JSON.stringify(r)); assert.deepEqual(itens[0].p_depois, { marca: "Sabó" });
});
test("pedido de uma PESSOA (sem IA) pode citar documento descrito; o do modelo não", async () => {
  const doc = [{ documento: "Etiqueta da embalagem fotografada hoje" }];
  const pessoa = contextoDeProposta(portaComListagemResumida()); pessoa.ctx.agente = { nome: "Nano.ia (sem IA)", provedor: "nenhum" };
  const a = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: doc }, pessoa.ctx) as any;
  assert.equal(a.proposta_id, "p1", JSON.stringify(a));
  const modelo = contextoDeProposta(portaComListagemResumida());
  const b = await HANDLERS["bling.produtos.preparar_atualizacao"]({ sku: "CI001086", campos: { marca: "Sabó" }, fontes: doc }, modelo.ctx) as any;
  assert.equal(b.erro, "Marca recusada");
});
