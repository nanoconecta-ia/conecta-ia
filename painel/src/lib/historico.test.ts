import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorProjeto, mensagensParaItens, tituloDe } from "./historico.ts";

test("histórico: texto do usuário, resposta, ferramenta e resultado casam pelo id", () => {
  const itens = mensagensParaItens([
    { id: "m1", papel: "user", conteudo: [{ type: "text", text: "organize o cabeçote" }] },
    { id: "m2", papel: "assistant", conteudo: [{ type: "text", text: "vou consultar" }, { type: "tool_use", id: "t1", name: "ver_produto", input: {} }], provedor: "claude", modelo: "m" },
    { id: "m3", papel: "user", conteudo: [{ type: "tool_result", tool_use_id: "t1", content: "{\"sku\":\"80692\"}" }] },
    { id: "m4", papel: "assistant", conteudo: "pronto", provedor: "gemini", modelo: "g" },
  ]);
  assert.deepEqual(itens.map((i) => i.k), ["user", "ia", "ferramenta", "ia"]);
  const f = itens[2]; assert.ok(f.k === "ferramenta" && f.ok === true && f.resumo?.includes("80692") && f.rodando === false);
  const ultima = itens[3]; assert.ok(ultima.k === "ia" && ultima.provedor === "gemini");   // o modelo que respondeu fica registrado
});

test("histórico: conteúdo inesperado vira nada, não quebra", () => {
  assert.deepEqual(mensagensParaItens([{ id: "x", papel: "assistant", conteudo: { qualquer: 1 } }, { id: "y", papel: "tool", conteudo: null }]), []);
});

test("histórico: erro de ferramenta aparece como não-ok; resultado longo é resumido", () => {
  const itens = mensagensParaItens([
    { id: "a", papel: "assistant", conteudo: [{ type: "tool_use", id: "t", name: "x" }] },
    { id: "b", papel: "user", conteudo: [{ type: "tool_result", tool_use_id: "t", content: "e".repeat(500), is_error: true }] },
  ]);
  const f = itens[0]; assert.ok(f.k === "ferramenta" && f.ok === false && (f.resumo?.length ?? 0) <= 160);
});

test("histórico: título e agrupamento por projeto (sem projeto primeiro)", () => {
  assert.equal(tituloDe("   Organize   o cabeçote  "), "Organize o cabeçote");
  assert.equal(tituloDe("x".repeat(100)).length, 58);
  const g = agruparPorProjeto([{ projeto: "HR", n: 1 }, { projeto: null, n: 2 }, { projeto: "Amarok", n: 3 }]);
  assert.deepEqual(g.map((x) => x.projeto), [null, "Amarok", "HR"]);
});
