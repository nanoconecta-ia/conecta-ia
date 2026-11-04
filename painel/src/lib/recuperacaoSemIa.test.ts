import { test } from "node:test";
import assert from "node:assert/strict";
import { falhaDoProvedor, skuEmFoco, deveRecuperarSemIa, erroDoChat, mensagemFalhaFicha } from "./recuperacaoSemIa.ts";

test("reconhece falha do provedor e não confunde com outros erros", () => {
  assert.ok(falhaDoProvedor("O provedor de IA está sobrecarregado ou o limite da chave foi atingido. Tente em instantes."));
  assert.ok(falhaDoProvedor("Limite mensal do provedor atingido."));
  assert.ok(falhaDoProvedor("Provedor indisponível no servidor."));
  assert.ok(!falhaDoProvedor("Sua sessão expirou. Entre de novo."));
  assert.ok(!falhaDoProvedor("Sem permissão para esta loja."));
});
test("acha o SKU no texto novo, senão no mais recente das mensagens anteriores", () => {
  assert.equal(skuEmFoco("o que é o CI001086?", []), "CI001086");
  assert.equal(skuEmFoco("que produto é este", ["Olá", "/ficha 82892", "Ficha do SKU CI000016: bomba"]), "CI000016");
  assert.equal(skuEmFoco("Oi", ["Olá! Posso resumir a loja"]), null);
});
test("ano de veículo não é SKU; SKU numérico sim", () => {
  assert.equal(skuEmFoco("serve no HR 2013?", []), null);
  assert.equal(skuEmFoco("serve no HR 2013? SKU 82892", []), "82892");
});
test("bloqueia comparação ambígua", () => {
  assert.equal(skuEmFoco("compare CI000016 com CI001086", []), null);
});

test("SKU explícito inteiro prevalece sobre aplicação, ano e referências", () => {
  assert.equal(skuEmFoco("Consulte o SKU ENG-1645-05", []), "ENG-1645-05");
  assert.equal(skuEmFoco("Enriqueça o SKU ENG-1645-05: Turbina Mando HR/K2500 8V 4D56/D4BH para HR 2016", []), "ENG-1645-05");
  assert.equal(skuEmFoco("/ficha ENG-1645-05", []), "ENG-1645-05");
  assert.equal(skuEmFoco("SKU ENG-1645-05 e SKU CI000016", ["SKU ANTIGO-123"]), null);
  assert.equal(skuEmFoco("Compare ENG-1645-05 e CI000016", ["SKU ANTIGO-123"]), null);
  assert.equal(skuEmFoco("SKU ENG-1645-05, SKU ENG-1645-05", []), "ENG-1645-05");
});
test("categorias estruturadas comandam a recuperação e distinguem mensagens", () => {
  assert.equal(deveRecuperarSemIa(erroDoChat({categoria_erro:"limite", origem_erro:"provedor", resposta:"Falha 429"})), true);
  assert.equal(deveRecuperarSemIa(erroDoChat({categoria_erro:"ferramenta", erro:"Limite temporário"})), false);
  assert.equal(deveRecuperarSemIa(erroDoChat({categoria_erro:"limite", origem_erro:"ferramenta"})), false);
  assert.equal(deveRecuperarSemIa(erroDoChat({categoria_erro:"sku_nao_encontrado"})), false);
  assert.match(mensagemFalhaFicha(erroDoChat({categoria_erro:"sku_nao_encontrado"})), /SKU não encontrado/);
  assert.match(mensagemFalhaFicha(new Error("conexão")), /Erro de ferramenta/);
});

test("mensagem de cota mostra renovação estimada e falha da reserva sem prometer envio inexistente",()=>{
 const e=erroDoChat({resposta:"Cota diária esgotada.",motivo_ia:"cota_diaria",tentar_novamente_em:"2026-11-05T00:00:00Z",renovacao_estimada:true,reserva_indisponivel:true});
 assert.match(e.message,/Renovação estimada/);assert.match(e.message,/reserva Groq também não concluiu/);
 assert.ok(!e.message.includes("Nada foi enviado"));
});
