import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoIdade, nomeArquivoCsv, resumoContagens, ultimoUtil, type Snapshot } from "./backup.ts";

const s = (id: string, criado_em: string, status: Snapshot["status"]): Snapshot => ({ id, criado_em, concluido_em: criado_em, origem: "manual", status, contagens: { produtos: 10, categorias: 13, contatos: 1 }, erro: null });

test("resumo das contagens com singular e plural", () => {
  assert.equal(resumoContagens({ produtos: 1, categorias: 13, contatos: 2 }), "1 produto, 13 categorias, 2 fornecedores");
  assert.equal(resumoContagens(null), "0 produtos, 0 categorias, 0 fornecedores");
});

test("a cópia útil é a completa mais recente; na falta, a parcial; falha nunca serve", () => {
  const lista = [s("a", "2026-10-17T10:00:00Z", "completo"), s("b", "2026-10-19T10:00:00Z", "falhou"), s("c", "2026-10-18T10:00:00Z", "parcial")];
  assert.equal(ultimoUtil(lista)?.id, "a");
  assert.equal(ultimoUtil([s("c", "2026-10-18T10:00:00Z", "parcial"), s("b", "2026-10-19T10:00:00Z", "falhou")])?.id, "c");
  assert.equal(ultimoUtil([s("b", "2026-10-19T10:00:00Z", "falhou")]), null);
  assert.equal(ultimoUtil([]), null);
});

test("aviso de idade: sem cópia, cópia velha ou parcial não passam por ok", () => {
  const agora = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(avisoIdade(null, agora).ok, false);
  assert.deepEqual(avisoIdade(s("a", "2026-10-20T11:30:00Z", "completo"), agora), { ok: true, texto: "Última cópia há menos de 1 hora." });
  assert.equal(avisoIdade(s("a", "2026-10-17T12:00:00Z", "completo"), agora).ok, false);
  assert.match(avisoIdade(s("a", "2026-10-17T12:00:00Z", "completo"), agora).texto, /3 dias/);
  const p = avisoIdade(s("a", "2026-10-20T10:00:00Z", "parcial"), agora);
  assert.equal(p.ok, false); assert.match(p.texto, /parcial/);
});

test("nome do arquivo CSV leva a data e o começo do id, sem caracteres estranhos", () => {
  assert.equal(nomeArquivoCsv("12345678-aaaa-bbbb", "2026-10-19T22:00:00Z"), "bling-produtos-2026-10-19-12345678.csv");
});
