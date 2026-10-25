import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirParaFala, escolherVoz, MENSAGENS_ERRO, notaDaVoz, textoParaFala, textoParaFalaNatural } from "./voz.ts";

test("textoParaFala tira links, marcação e emoji; limita o tamanho", () => {
  assert.equal(textoParaFala("**Olá!** Veja https://x.com/abc?y=1 agora 🚗"), "Olá! Veja link agora");
  assert.equal(textoParaFala("- item um\n- item dois"), "item um item dois");
  assert.equal(textoParaFala("a".repeat(3000)).length, 1200);
  assert.equal(textoParaFala("   "), "");
});

test("mensagens de erro do microfone estão em português e 'aborted' é silencioso", () => {
  assert.match(MENSAGENS_ERRO["not-allowed"], /microfone/i); assert.equal(MENSAGENS_ERRO.aborted, "");
});

test("fala natural: valores, unidades e siglas são lidos como uma pessoa leria", () => {
  assert.equal(textoParaFalaNatural("Preço R$ 1.950,00 e 10% de desconto"), "Preço 1.950 reais e 10 por cento de desconto");
  assert.equal(textoParaFalaNatural("R$ 12,50"), "12 reais e 50 centavos");
  assert.match(textoParaFalaNatural("SKU 5112 com 254 mm"), /S K U 5112 com 254 milímetros/);
});

test("frases curtas para a síntese respirar; nada passa do limite", () => {
  assert.deepEqual(dividirParaFala("Achei três. Dois estão excluídos! Quer ver?"), ["Achei três.", "Dois estão excluídos!", "Quer ver?"]);
  const longa = dividirParaFala("palavra ".repeat(80));
  assert.ok(longa.length > 1 && longa.every((f) => f.length <= 180));
  assert.deepEqual(dividirParaFala(""), []);
});

test("escolha de voz: neural/online pt-BR ganha da compacta; fora do português nunca; preferência válida vale", () => {
  const v = [
    { name: "eSpeak Portuguese (Brazil)", lang: "pt-BR", voiceURI: "a" },
    { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR", voiceURI: "b" },
    { name: "Google português do Brasil", lang: "pt-BR", voiceURI: "c" },
    { name: "Microsoft Helena - Portuguese (Portugal)", lang: "pt-PT", voiceURI: "d" },
    { name: "Samantha", lang: "en-US", voiceURI: "e" },
  ];
  assert.equal(escolherVoz(v)?.voiceURI, "b");
  assert.equal(escolherVoz(v, "c")?.voiceURI, "c");
  assert.equal(escolherVoz(v, "e")?.voiceURI, "b", "preferência fora do português é ignorada");
  assert.equal(escolherVoz([{ name: "Samantha", lang: "en-US" }]), undefined);
  assert.ok(notaDaVoz(v[0]) < notaDaVoz(v[2]));
});
