// Loja virtual / site ligado ao Bling: tags, SEO, especificações técnicas (campos customizados) e URL de imagem aprovada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCampos, slugCampo, type CampoBruto } from "../src/leitura.ts";
import { reconhecer } from "../src/reconhecer.ts";
import { MAPA_PRODUTO_BLING } from "../src/mapa-produto.ts";
import { descricaoSeo, sugerir, tituloSeo } from "../src/sugestoes.ts";
import { montarProposta } from "../src/espelho.ts";
import { planejarPreenchimento } from "../src/preenchimento.ts";

const c = (rotulo: string, valor = "", id?: string): CampoBruto => ({ rotulo, tipo: "text", valor, visivel: true, ...(id ? { id } : {}) });
const tela = [c("Nome", "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas"), c("Código (SKU)", "CI000016"), c("GTIN/EAN"), c("Marca", "TRIM GO AUTOPARTS"), c("Categoria", "Arrefecimento"),
  c("Tags"), c("Título SEO"), c("Descrição SEO"), c("URL da imagem"), c("Diâmetro externo (mm)", "", "cc1"), c("Material", "Alumínio", "cc2"), c("Preço de compra", "41,90")];
const r = reconhecer(lerCampos(tela), MAPA_PRODUTO_BLING);

test("mapa: SEO e URL da imagem reconhecidos; campos customizados ficam como não mapeados (viram especificações)", () => {
  const can = r.casados.map((x) => x.mapa.canonico);
  for (const k of ["seoTitulo", "seoDescricao", "imagemUrl", "tags"]) assert.ok(can.includes(k), k);
  assert.deepEqual(r.naoMapeados.filter((l) => !l.mascarado).map((l) => slugCampo(l.rotulo)), ["diametro_externo_mm", "material"]);
});

test("SEO só com dados da tela: título até 70, descrição 50–160, sem inventar", () => {
  const t = tituloSeo("Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas", "TRIM GO AUTOPARTS");
  assert.ok(t.length <= 70 && t.startsWith("Bomba d'água"));
  const d = descricaoSeo("Bomba d'água HR 2.5", "TRIM GO", "CI000016");
  assert.equal(d, "Bomba d'água HR 2.5. Marca TRIM GO. Código CI000016.");
  const { sugestoes } = sugerir(r);
  assert.deepEqual(sugestoes.map((s) => s.campo).sort(), ["seoDescricao", "seoTitulo", "tags"]);
  assert.ok(sugestoes.every((s) => s.aplicavel === false));
});

test("propostas: tags/SEO/espec com limites; espec usa o nome do campo customizado", () => {
  assert.deepEqual(montarProposta("espec:diametro_externo_mm", "CI000016", "62", "https://fab.exemplo").args, { sku: "CI000016", campo: "espec:diametro_externo_mm", valor: "62", fonte: "https://fab.exemplo" });
  assert.equal(montarProposta("seoTitulo", "CI000016", "Bomba d'água HR 2.5 | TRIM GO", "Cadastro do ERP").args.campo, "seo_titulo");
  assert.throws(() => montarProposta("seoDescricao", "CI000016", "curta", "Cadastro do ERP"), /50 a 160/);
  assert.throws(() => montarProposta("espec:Com Espaco", "CI000016", "x", "https://x.y"), /não aceita/);
});

test("preencher: espec casa com o campo customizado pelo nome; imagem aprovada vai para URL da imagem; inexistente bloqueia", () => {
  const ap = (campo: string, valor: string) => ({ id: campo, campo, valor, fonte: "https://fab.exemplo", aprovado_em: null });
  const p = planejarPreenchimento(r, [ap("espec:diametro_externo_mm", "62"), ap("espec:material", "Alumínio"), ap("espec:rosca", "M10"), ap("imagem", "https://cdn.exemplo/ci000016.jpg"), ap("tags", "bomba, agua"), ap("seo_titulo", "Bomba d'água HR 2.5 | TRIM GO")]);
  const por = Object.fromEntries(p.map((i) => [i.canonico, i]));
  assert.equal(por["espec:diametro_externo_mm"].acao, "preencher"); assert.equal(por["espec:diametro_externo_mm"].alvo.id, "cc1");
  assert.equal(por["espec:material"].acao, "igual");
  assert.equal(por["espec:rosca"].acao, "bloqueado");
  assert.equal(por.imagemUrl.acao, "preencher");
  assert.equal(por.tags.acao, "preencher"); assert.equal(por.seoTitulo.acao, "preencher");
});
