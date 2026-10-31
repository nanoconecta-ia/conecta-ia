// Loja virtual / site ligado ao Bling (issue #166): tags, SEO e especificações técnicas entram como enriquecimento com fonte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { campoEnriquecimentoValido, problemaNoValor, proporEnriquecimento } from "./escrita.ts";

test("campos: tags, seo_titulo, seo_descricao e espec:<campo> aceitos; resto da lista fechada continua; lixo recusado", () => {
  for (const c of ["tags", "seo_titulo", "seo_descricao", "espec:diametro_externo_mm", "espec:material", "marca_peca"]) assert.equal(campoEnriquecimentoValido(c), true, c);
  for (const c of ["preco", "estoque", "espec:", "espec:X", "espec:com espaco", "espec:" + "a".repeat(31), "seo"]) assert.equal(campoEnriquecimentoValido(c), false, c);
});

test("limites: tags (até 20, 40 car.), título SEO 10–70, descrição SEO 50–160, especificação 1–200", () => {
  assert.equal(problemaNoValor("tags", "bomba, agua, hr"), null);
  assert.match(problemaNoValor("tags", Array.from({ length: 21 }, (_, i) => `t${i}`).join(","))!, /20/);
  assert.match(problemaNoValor("seo_titulo", "curto")!, /10 a 70/);
  assert.equal(problemaNoValor("seo_titulo", "Bomba d'água HR 2.5 8V | TRIM GO"), null);
  assert.match(problemaNoValor("seo_descricao", "pequena")!, /50 a 160/);
  assert.equal(problemaNoValor("espec:material", "Alumínio"), null);
  assert.match(problemaNoValor("espec:material", "x".repeat(201))!, /200/);
  assert.equal(problemaNoValor("marca_peca", "qualquer"), null, "campos antigos sem limite novo");
});

test("proporEnriquecimento: espec vai para o banco como a_confirmar com fonte; valor fora do limite não chega ao banco", async () => {
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const admin = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "p1" } }) }) }) }) }), rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return { data: null, error: null }; } };
  const ok = await proporEnriquecimento(admin as never, "L", { sku: "CI000016", campo: "espec:diametro_externo_mm", valor: "62", fonte: "https://fab.exemplo/ci000016" }) as { ok?: boolean };
  assert.equal(ok.ok, true);
  assert.equal(rpcs[0].args.p_campo, "espec:diametro_externo_mm");
  const ruim = await proporEnriquecimento(admin as never, "L", { sku: "CI000016", campo: "seo_titulo", valor: "curto", fonte: "https://x.y" }) as { erro?: string };
  assert.match(ruim.erro!, /10 a 70/);
  assert.equal(rpcs.length, 1);
});
