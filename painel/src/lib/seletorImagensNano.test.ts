import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FOTOS_SELECAO, alterarSelecao, selecaoAtual, avaliarPreviaPrincipal } from "./seletorImagensNano.ts";

const ids = Array.from({ length: 9 }, (_, i) => `foto-${i + 1}`);

test("seleção de até oito fotos, nona recusada; sem modificações externas", () => {
  let atual: string[] = [];
  for (const id of ids.slice(0, 8)) atual = alterarSelecao(atual, id, ids).selecionadas;
  assert.equal(atual.length, MAX_FOTOS_SELECAO);
  const nona = alterarSelecao(atual, ids[8], ids);
  assert.deepEqual(nona.selecionadas, atual);
  assert.match(nona.erro ?? "", /máximo/i);
});
test("seleção não aceita imagem fora da galeria, e clicar novamente desmarca", () => {
  assert.match(alterarSelecao([], "falsa", ids).erro ?? "", /não pertence/);
  assert.deepEqual(alterarSelecao(["foto-1"], "foto-1", ids).selecionadas, []);
});
test("retém somente IDs ainda presentes e remove duplicatas", () => {
  assert.deepEqual(selecaoAtual(["foto-1","foto-1","falsa","foto-2"], ids), ["foto-1","foto-2"]);
});
test("a escolha de principal nunca aprova imagem e exige foto real, direitos e revisão", () => {
  assert.equal(avaliarPreviaPrincipal(null).ok,false);
  assert.equal(avaliarPreviaPrincipal({id:"1",tipo:"gerada_ia",aprovada:true,direitos:true,publicavel:true}).ok,false);
  assert.equal(avaliarPreviaPrincipal({id:"1",tipo:"real",aprovada:false,direitos:true,publicavel:false}).ok,false);
  assert.equal(avaliarPreviaPrincipal({id:"1",tipo:"real",aprovada:true,direitos:false,publicavel:false}).ok,false);
  assert.equal(avaliarPreviaPrincipal({id:"1",tipo:"real",aprovada:true,direitos:true,publicavel:true}).ok,true);
  assert.match(avaliarPreviaPrincipal({id:"1",tipo:"real",aprovada:true,direitos:true,publicavel:true}).mensagem, /prévia não altera/);
});
