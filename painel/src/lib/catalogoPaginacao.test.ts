import { test } from "node:test";
import assert from "node:assert/strict";
import { TAMANHO_LOTE_CATALOGO, expressaoBuscaCatalogo, juntarProdutosPorId, existemMaisProdutos } from "./catalogoPaginacao.ts";

test("busca executada no servidor ignora sintaxe PostgREST injetada", () => {
  assert.equal(expressaoBuscaCatalogo("854008"), "sku.ilike.%854008%,nome.ilike.%854008%,marca.ilike.%854008%,gtin.ilike.%854008%");
  assert.equal(expressaoBuscaCatalogo(""), null);
  const filtro = expressaoBuscaCatalogo('854008,publicado.eq.true))%');
  assert.ok(filtro);
  assert.equal(filtro?.includes("publicado.eq.true"), false);
  assert.equal(filtro?.includes(")"), false);
  assert.equal(filtro?.includes(","), true); // separadores fixos das quatro colunas
});
test("lotes não duplicam itens por ID, ainda que o nome/SKU repita", () => {
  const a=[{id:"1",sku:"854008"},{id:"2",sku:"CI000016"}];
  assert.deepEqual(juntarProdutosPorId(a,[{id:"2",sku:"CI000016"},{id:"3",sku:"854008"}]).map(p=>p.id),["1","2","3"]);
});
test("não declara finalização com lote cheio e contagem disponível", () => {
  assert.equal(TAMANHO_LOTE_CATALOGO,100);
  assert.equal(existemMaisProdutos(100,235,100),true);
  assert.equal(existemMaisProdutos(235,235,35),false);
  assert.equal(existemMaisProdutos(100,null,100),true);
  assert.equal(existemMaisProdutos(100,null,15),false);
  assert.equal(existemMaisProdutos(100,1000,0),false);
});
