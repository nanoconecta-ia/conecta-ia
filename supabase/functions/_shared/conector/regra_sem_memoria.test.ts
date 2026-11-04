// Resposta real do modelo gratuito (04/11/2026): sobre o motor 4D56 ele listou, DE MEMÓRIA, códigos OEM que não se confirmaram (o filtro de óleo é MD069782) e
// variantes sem fonte. A regra do prompt passa a proibir isso, no chat comum e no modo gratuito. Teste do TEXTO do prompt: o comportamento do modelo é verificado
// em teste real (colar a pergunta do 4D56 e conferir que ele recusa o código e pede a fonte).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SISTEMA } from "../ia/ferramentas.ts";
import { SISTEMA_FREE } from "../assistente/free_automatico.ts";

test("o prompt proíbe especificação, código OEM e aplicação de memória e diz o que fazer sem fonte", () => {
  assert.match(SISTEMA, /DADO TÉCNICO NUNCA DE MEMÓRIA/);
  assert.match(SISTEMA, /códigos OEM ou de fabricante, referências cruzadas e aplicação veicular só podem vir do que uma ferramenta trouxe/);
  assert.match(SISTEMA, /NÃO responda o dado nem liste "códigos frequentes"/);
  assert.match(SISTEMA, /não tem fonte verificada/);
  assert.match(SISTEMA, /o agente externo pesquisa e propõe com fonte/);
});
test("o modo gratuito carrega a mesma restrição", () => {
  assert.match(SISTEMA_FREE, /Especificação técnica, código OEM e aplicação veicular só com o que uma ferramenta trouxe, com fonte/);
  assert.match(SISTEMA_FREE, /não liste códigos de memória/);
});
