// Lista fechada de campos que a escrita no Bling pode enviar. Hoje: só a categoria do produto.
// Sem banco: roda o executor de produção contra o Bling SIMULADO. A ferramenta real continua desligada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMPOS_ESCRITA_LIBERADOS, camposNaoLiberados } from "./bling_campos.ts";
import { escreverEConfirmarNoBling, type ItemExecucao } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";

const item = (depois: Record<string, unknown>, campos = Object.keys(depois), operacao = "bling.produtos.alterar"): ItemExecucao =>
  ({ item_id: "i1", produto_id: "p1", operacao, alvo: "701", campos, antes: { categoria_bling_id: "1072643" }, depois, idempotency_key: "k1" });
const mock = () => new BlingMock().semear("701", { codigo: "CI000054", categoria: { id: 1072643 }, marca: "Trim Go" });

test("a lista liberada hoje é exatamente a categoria do produto (mudar isto exige decisão do dono e mudar este teste)", () => {
  assert.deepEqual(CAMPOS_ESCRITA_LIBERADOS, { "bling.produtos.alterar": ["categoria_bling_id"] });
});

test("categoria: grava no Bling simulado e só confirma depois de ler de volta", async () => {
  const b = mock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ categoria_bling_id: "14668464" }));
  assert.equal(v.estado, "confirmada");
  assert.deepEqual(b.recebidos[0].corpo, { categoria: { id: 14668464 } });
  assert.equal(b.produtos.get("701")!.categoria.id, 14668464);
  assert.ok(b.leituras >= 1, "houve leitura de confirmação");
});

test("qualquer outro campo é recusado ANTES de enviar: nada chega ao Bling", async () => {
  for (const campo of ["marca", "descricao_curta", "nome", "gtin", "peso_kg", "preco", "estoque", "ncm", "custo", "fornecedor"]) {
    const b = mock();
    const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ [campo]: "x" }));
    assert.equal(v.estado, "falhou", campo);
    assert.match(v.motivo ?? "", /campo_nao_liberado/, campo);
    assert.equal(b.recebidos.length, 0, `${campo}: nada enviado`);
  }
});

test("categoria misturada com outro campo: recusa o item inteiro (tudo ou nada)", async () => {
  const b = mock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ categoria_bling_id: "14668464", marca: "X" }));
  assert.equal(v.estado, "falhou");
  assert.match(v.motivo ?? "", /marca/);
  assert.equal(b.recebidos.length, 0);
  assert.equal(b.produtos.get("701")!.categoria.id, 1072643, "o produto simulado não mudou");
});

test("campo escondido só em `campos` (declarado) também é recusado", async () => {
  const b = mock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ categoria_bling_id: "14668464" }, ["categoria_bling_id", "preco"]));
  assert.equal(v.estado, "falhou");
  assert.match(v.motivo ?? "", /preco/);
  assert.equal(b.recebidos.length, 0);
});

test("operação sem campos liberados (criar produto) é recusada", async () => {
  const b = mock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.criar", item({ nome: "X" }, ["nome"], "bling.produtos.criar"));
  assert.equal(v.estado, "falhou");
  assert.match(v.motivo ?? "", /campo_nao_liberado/);
  assert.equal(b.recebidos.length, 0);
});

test("a lista pode ser trocada só por parâmetro explícito (testes), nunca por padrão", async () => {
  const b = mock();
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ marca: "Sabó" }), undefined, { "bling.produtos.alterar": ["marca"] });
  assert.equal(v.estado, "confirmada");
  assert.deepEqual(camposNaoLiberados("bling.produtos.alterar", { marca: "x" }), ["marca"], "sem parâmetro continua fechada");
});

test("timeout na escrita da categoria continua 'desconhecida' (nunca falhou), e não repete", async () => {
  const b = mock(); b.falhas = ["timeout_gravou"];
  const v = await escreverEConfirmarNoBling(b, "bling.produtos.alterar", item({ categoria_bling_id: "14668464" }));
  assert.equal(v.estado, "desconhecida");
  assert.equal(b.recebidos.length, 1, "uma só tentativa");
});
