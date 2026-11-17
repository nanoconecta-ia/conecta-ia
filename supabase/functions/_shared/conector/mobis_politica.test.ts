import assert from "node:assert/strict";
import {test} from "node:test";
import {MOBIS_LOJA_ID, blingEscritaNegadaPorPolitica, MENSAGEM_MOBIS_BLING_SOMENTE_LEITURA} from "./mobis_politica.ts";

test("Mobis bloqueia toda escrita Bling, mesmo após aprovação e ativação futura",()=>{
  for(const op of ["bling.produtos.criar","bling.produtos.alterar","bling.produtos.alterar_preco","bling.categorias.criar","bling.nota.excluir","bling.estoque.gravar"])
    assert.equal(blingEscritaNegadaPorPolitica(MOBIS_LOJA_ID,op),true,op);
  assert.match(MENSAGEM_MOBIS_BLING_SOMENTE_LEITURA,/somente leitura/);
});
test("não bloqueia operações internas Conecta.IA nem outros tenants",()=>{
  for(const op of ["conecta.enriquecimento.definir","conecta.publicacao.publicar","conecta.proposta.criar"])
    assert.equal(blingEscritaNegadaPorPolitica(MOBIS_LOJA_ID,op),false,op);
  assert.equal(blingEscritaNegadaPorPolitica("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","bling.produtos.criar"),false);
});

