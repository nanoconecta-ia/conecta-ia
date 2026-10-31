import { test } from "node:test";
import assert from "node:assert/strict";
import { gravarConversaAtiva, lerConversaAtiva } from "./conversaAtiva.ts";

const A = "11111111-2222-4333-8444-555555555555";
const B = "66666666-7777-4888-9999-aaaaaaaaaaaa";

test("dock e tela leem a mesma conversa ativa da loja (memória da aba, sem sessionStorage no Node)", () => {
  assert.equal(lerConversaAtiva("loja-1"), null);
  gravarConversaAtiva("loja-1", A);
  assert.equal(lerConversaAtiva("loja-1"), A);
});

test("isolamento por loja: a conversa de uma loja nunca aparece em outra", () => {
  gravarConversaAtiva("loja-x", A);
  gravarConversaAtiva("loja-y", B);
  assert.equal(lerConversaAtiva("loja-x"), A);
  assert.equal(lerConversaAtiva("loja-y"), B);
});

test("nova conversa / exclusão limpam; id fora do formato UUID é ignorado", () => {
  gravarConversaAtiva("loja-z", A);
  gravarConversaAtiva("loja-z", "nao-e-uuid");
  assert.equal(lerConversaAtiva("loja-z"), A);
  gravarConversaAtiva("loja-z", null);
  assert.equal(lerConversaAtiva("loja-z"), null);
});

test("usa sessionStorage quando existe, e sobrevive a sessionStorage que lança erro", () => {
  const dados = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v), removeItem: (k: string) => void dados.delete(k) };
  gravarConversaAtiva("loja-s", B);
  assert.equal(dados.get("nano:conversa-ativa:loja-s"), B);
  (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } };
  gravarConversaAtiva("loja-t", A);
  assert.equal(lerConversaAtiva("loja-t"), A);
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});
