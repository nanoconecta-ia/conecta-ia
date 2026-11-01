import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarFidelidadeVisual, type Documento } from "./fidelidadeVisual.ts";
import { agruparBloqueios, rotuloBloqueio } from "./fidelidadeBloqueios.ts";

// A regra do editor e a do servidor são UMA SÓ: o arquivo do painel é cópia idêntica do do servidor. Se alguém mudar só um lado, este teste falha.
test("o validador do painel é idêntico ao do servidor", () => {
  const painel = readFileSync(new URL("./fidelidadeVisual.ts", import.meta.url), "utf8");
  const servidor = readFileSync(new URL("../../../supabase/functions/_shared/imagens/fidelidade_visual.ts", import.meta.url), "utf8");
  assert.equal(painel, servidor);
});

test("todo código de bloqueio que o validador pode emitir tem rótulo em português para a tela", () => {
  const fonte = readFileSync(new URL("./fidelidadeVisual.ts", import.meta.url), "utf8");
  const codigos = new Set<string>();
  for (const m of fonte.matchAll(/no\("([a-z_]+)"/g)) codigos.add(m[1]);
  for (const m of fonte.matchAll(/codigo: "([a-z_]+)"/g)) codigos.add(m[1]);
  assert.ok(codigos.size >= 25, `esperava ao menos 25 códigos, achei ${codigos.size}`);
  for (const c of codigos) assert.notEqual(rotuloBloqueio(c), c, `código sem rótulo: ${c}`);
});

test("agruparBloqueios separa o que a pessoa pode corrigir do que depende de prova externa", () => {
  const doc = { loja_id: "l", sku: "S", status: "rascunho", formato: { w: 1, h: 1 }, area_segura: { x: 0, y: 0, w: 1, h: 1 }, camadas: [], foto: { asset_id: "a", sha256: "x", natural: { w: 1, h: 1 }, posicao: { x: 0, y: 0 }, transform: { scaleX: 2, scaleY: 1, flipX: true }, apresentada_como: "real" } } as unknown as Documento;
  const r = validarFidelidadeVisual(doc, { asset_id: "a", loja_id: "l", sha256_original: "", tipo: "real", origem: null, licenca_confirmada: false, identidade: { codigo_fabricante: null, oem: null, evidencias: [] } }, { loja_id: "l", sku: "S", fatos: {} }, { identidade_aprovada: false, direitos_aprovados: false }, { acao: "autorizar", ator: "usuario" });
  const g = agruparBloqueios(r.bloqueios);
  assert.ok(g.imagem.length > 0 && g.provas.length > 0);
  assert.equal(g.imagem.length + g.provas.length + g.permissao.length + g.dados.length, r.bloqueios.length);
});
