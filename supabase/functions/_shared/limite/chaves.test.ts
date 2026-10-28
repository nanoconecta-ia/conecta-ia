// Guarda o FORMATO das chaves gravadas em private.limite_chamadas. A limpeza proposta no PR #116 (docs/conector-ia/limite-limpeza-emenda-retencao.md)
// apaga as chaves de janela de 60 s com 10 min e o resto com 2 h, reconhecendo as curtas por este padrão. Se o formato mudar, este teste falha.
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardarPublico, LIMITES_PADRAO } from "./publico.ts";

const CURTAS = /^pub:[a-z-]+:(ip:rajada:|semip:|loja:)/; // mesmo padrão da limpeza do #116

async function chaves(endpoint: "loja-publica" | "vitrine-assistente", ip: string | null) {
  const vistas: { chave: string; janelaS: number }[] = [];
  const h = new Map<string, string>(); if (ip) h.set("cf-connecting-ip", ip);
  await guardarPublico({
    endpoint, segredo: "teste", lojaDe: () => "loja-x",
    req: { headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null }, body: null },
    porta: async (chave, _max, janelaS) => { vistas.push({ chave, janelaS }); return true; },
  });
  return vistas;
}

for (const endpoint of ["loja-publica", "vitrine-assistente"] as const) {
  test(`${endpoint}: com IP, as chaves de 60 s casam com o padrão da limpeza e a de 1 h não`, async () => {
    const v = await chaves(endpoint, "203.0.113.7");
    assert.equal(v.length, 3, "loja + rajada + sustentado");
    for (const { chave, janelaS } of v) {
      assert.equal(CURTAS.test(chave), janelaS <= 60, `${chave} (janela ${janelaS}s)`);
    }
    assert.ok(v.some((x) => x.chave.includes(":ip:sustentado:") && x.janelaS === 3600 && !CURTAS.test(x.chave)), "sustentado fica na regra de 2 h");
  });
  test(`${endpoint}: sem IP, as chaves de 60 s casam com o padrão da limpeza`, async () => {
    const v = await chaves(endpoint, null);
    assert.equal(v.length, 2, "loja + sem-ip");
    for (const { chave, janelaS } of v) assert.ok(janelaS <= 60 && CURTAS.test(chave), `${chave} (janela ${janelaS}s)`);
  });
}

test("toda regra de janela curta dos limites padrão tem 60 s ou menos (a retenção de 10 min depende disso)", () => {
  for (const cfg of Object.values(LIMITES_PADRAO)) for (const r of [cfg.loja, cfg.semIp, cfg.ip[0]]) assert.ok(r.janelaS <= 60, r.nome);
});

test("as chaves não carregam IP nem identificador da loja em claro", async () => {
  const v = await chaves("loja-publica", "203.0.113.7");
  for (const { chave } of v) { assert.ok(!chave.includes("203.0.113.7")); assert.ok(!chave.includes("loja-x")); }
});
