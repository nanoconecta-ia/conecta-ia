import test from "node:test";
import assert from "node:assert/strict";
import { perguntaSobreModelo, respostaSobreModelo } from "./respostaModelo.ts";

test("perguntaSobreModelo reconhece perguntas sobre o motor e ignora o resto", () => {
  for (const t of ["Oi qual seu modelo de agente", "qual modelo você usa?", "Que IA é você?", "qual é o seu modelo"]) assert.equal(perguntaSobreModelo(t), true, t);
  for (const t of ["qual o modelo do Gol 2012?", "/ficha CI000016", "Oi", "qual motor serve no Corsa 1.0"]) assert.equal(perguntaSobreModelo(t), false, t);
});
test("respostaSobreModelo só cita modelo confirmado", () => {
  assert.match(respostaSobreModelo("OpenRouter Free · x/y"), /OpenRouter Free · x\/y/);
  assert.match(respostaSobreModelo(null), /Ainda não há resposta confirmada/);
});
