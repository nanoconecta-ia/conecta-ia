import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnosticarLancamento, modoCliente, prontoParaOnline, type DadosDeLancamento } from "./publicacao.ts";
const base: DadosDeLancamento = { slug:"mobis", ativa:true, politicasAprovadas:true, dominioPrincipal:"mobisautopecas.com.br", dominioVerificado:true, produtosPublicados:4, modoVenda:"whatsapp", whatsapp:"5562991654515" };
test("Online exige todos os requisitos", () => {
  assert.equal(prontoParaOnline(diagnosticarLancamento(base)),true);
  for (const patch of [{politicasAprovadas:false},{dominioVerificado:false},{dominioPrincipal:"mobisautoparts.com.br"},{produtosPublicados:0},{whatsapp:""},{ativa:false},{modoVenda:"checkout"}]) {
    assert.equal(prontoParaOnline(diagnosticarLancamento({...base,...patch})),false,JSON.stringify(patch));
  }
});
test("Teste jamais autoriza vendas, nem para checkout", () => {
  assert.equal(modoCliente("teste","whatsapp").venda_habilitada,false);
  assert.equal(modoCliente("teste","checkout").venda_habilitada,false);
  assert.equal(modoCliente("teste","whatsapp").modo_venda,"catalogo");
  assert.match(modoCliente("teste","whatsapp").aviso_teste??"", /TESTE/);
});
test("Domínio de outra loja não copia exigência específica Mobis", () => {
  const outra={...base,slug:"outra-loja",dominioPrincipal:"outraloja.com.br"};
  assert.equal(prontoParaOnline(diagnosticarLancamento(outra)),true);
});
test("Online com atendimento mantém WhatsApp", () => {
  assert.equal(modoCliente("producao","whatsapp").modo_venda,"whatsapp");
});
