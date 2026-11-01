import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORMATOS, ajustarContain, camada, definirEscala, definirTexto, deslocarFoto, documentoInicial, escalaContain, escalar, faixasDe, gravarRascunho,
  lerRascunho, aplicarTransformacaoFoto, moverCamada, moverFoto, serializarRascunho, ESCALA_MAX, ESCALA_MIN, chaveRascunho,
} from "./editorBanner.ts";
import { validarFidelidadeVisual, caixaDaFoto, type Ativo, type Autorizacoes, type Contexto, type Documento, type Produto } from "./fidelidadeVisual.ts";

const SHA = "c".repeat(64), LOJA = "aaaaaaaa-0000-0000-0000-000000000001";
const entrada = (w: number, h: number, f = FORMATOS[0]) => ({ lojaId: LOJA, sku: "FIX-001", formato: f, foto: { assetId: "a1", sha256: SHA, w, h }, titulo: "Bomba de óleo", lojaNome: "Loja Teste" });
const ativo = (): Ativo => ({ asset_id: "a1", loja_id: LOJA, sha256_original: SHA, tipo: "real", origem: "foto_propria", licenca_confirmada: false, identidade: { codigo_fabricante: null, oem: null, evidencias: [] } });
const produto = (): Produto => ({ loja_id: LOJA, sku: "FIX-001", fatos: {} });
const aut = (): Autorizacoes => ({ identidade_aprovada: false, direitos_aprovados: false });
const ctx: Contexto = { acao: "salvar", ator: "usuario" };
const valida = (d: Documento) => validarFidelidadeVisual(d, ativo(), produto(), aut(), ctx);
const codigos = (d: Documento) => valida(d).bloqueios.map((b) => b.codigo);

test("documento inicial passa no validador em todos os formatos e para fotos largas, altas, pequenas e enormes", () => {
  for (const f of FORMATOS) for (const [w, h] of [[600, 600], [4000, 1000], [800, 3000], [120, 90], [6000, 6000], [1, 1]]) {
    const d = documentoInicial(entrada(w, h, f));
    assert.deepEqual(codigos(d), [], `${f.id} ${w}x${h}`);
    assert.equal(d.foto.transform.scaleX, d.foto.transform.scaleY);
    assert.ok(d.foto.transform.scaleX <= 1, "nunca amplia a foto além de 100 %");
  }
});
test("a camada da peça é bloqueada e idêntica à caixa da foto; o fundo e o texto ficam fora da peça", () => {
  const d = documentoInicial(entrada(800, 600));
  const p = camada(d, "foto")!;
  assert.equal(p.bloqueada, true);
  assert.deepEqual(p.retangulo, { x: d.foto.posicao.x, y: d.foto.posicao.y, ...{ w: caixaDaFoto(d).w, h: caixaDaFoto(d).h } });
});
test("não inventa dados: o documento inicial não tem preço, garantia nem medida", () => {
  const d = documentoInicial(entrada(800, 600));
  const textos = d.camadas.map((c) => c.texto ?? "").join(" ");
  assert.doesNotMatch(textos, /R\$|garantia|dentes|\bmm\b/i);
  assert.ok(d.camadas.every((c) => c.tipo !== "preco"));
});

test("escalar mantém a proporção, o centro e fica dentro dos limites", () => {
  const d = documentoInicial(entrada(800, 600));
  const antes = caixaDaFoto(d), cx = antes.x + antes.w / 2, cy = antes.y + antes.h / 2;
  const e = escalar(d, 0.8), caixa = caixaDaFoto(e);
  assert.equal(e.foto.transform.scaleX, e.foto.transform.scaleY);
  assert.ok(Math.abs(caixa.x + caixa.w / 2 - cx) < 1e-6 && Math.abs(caixa.y + caixa.h / 2 - cy) < 1e-6);
  assert.equal(escalar(d, 1e9).foto.transform.scaleX, ESCALA_MAX);
  assert.equal(escalar(d, 1e-9).foto.transform.scaleX, ESCALA_MIN);
  for (const ruim of [0, -2, Number.NaN, Infinity]) assert.equal(escalar(d, ruim), d);
  assert.equal(definirEscala(d, -1), d);
});
test("a camada da peça acompanha a foto depois de escalar e mover (o validador não acusa inconsistência)", () => {
  let d = documentoInicial(entrada(800, 600));
  d = escalar(d, 0.7); d = deslocarFoto(d, 15, -10);
  assert.ok(!codigos(d).includes("camada_produto_inconsistente"));
  assert.deepEqual(camada(d, "foto")!.retangulo, caixaDaFoto(d));
});
test("ampliar até sair da área segura é bloqueado e a tela recebe o motivo; ajustar 'contain' resolve", () => {
  let d = documentoInicial(entrada(800, 600));
  d = definirEscala(d, 3);
  assert.ok(codigos(d).includes("peca_fora_da_area_segura"));
  d = ajustarContain(d, FORMATOS[0]);
  assert.deepEqual(codigos(d), []);
});
test("mover a peça para fora do banner é bloqueado; coordenadas inválidas são ignoradas", () => {
  const d = documentoInicial(entrada(800, 600));
  assert.ok(codigos(moverFoto(d, 5000, 5000)).includes("peca_fora_da_area_segura"));
  assert.equal(moverFoto(d, Number.NaN, 1), d);
});
test("arrastar o título ou a chamada para cima da peça é bloqueado", () => {
  const d = documentoInicial(entrada(800, 600));
  const c = caixaDaFoto(d);
  for (const id of ["titulo", "loja", "cta"]) assert.ok(codigos(moverCamada(d, id, c.x + 10, c.y + 10)).includes("camada_sobre_a_peca"), id);
});
test("não é possível mover nem editar o texto da camada da peça ou do fundo", () => {
  const d = documentoInicial(entrada(800, 600));
  assert.deepEqual(moverCamada(d, "foto", 0, 0).camadas, d.camadas);
  assert.deepEqual(moverCamada(d, "fundo", 9, 9).camadas, d.camadas);
  assert.deepEqual(definirTexto(d, "foto", "x").camadas, d.camadas);
});
test("texto com preço, garantia, dentes ou medida sem origem é bloqueado pelo validador, e o campo é limitado a 80 caracteres", () => {
  const d = documentoInicial(entrada(800, 600));
  for (const t of ["R$ 99,90", "Garantia de 12 meses", "26 dentes", "52 mm"]) assert.ok(codigos(definirTexto(d, "titulo", t)).length > 0, t);
  assert.equal(camada(definirTexto(d, "titulo", "x".repeat(200)), "titulo")!.texto!.length, 80);
});

test("rascunho local guarda só a composição e é descartado se a loja, o SKU ou a foto (SHA) mudarem", () => {
  const d = escalar(documentoInicial(entrada(800, 600)), 0.9);
  const bruto = serializarRascunho({ ...d, status: "aprovado_para_destino", hash_aprovado: "x" });
  const lido = lerRascunho(bruto, { loja_id: LOJA, sku: "FIX-001", sha256: SHA })!;
  assert.equal(lido.status, "rascunho"); assert.equal(lido.hash_aprovado, null);
  assert.equal(lido.foto.transform.scaleX, d.foto.transform.scaleX);
  assert.equal(lerRascunho(bruto, { loja_id: "outra", sku: "FIX-001", sha256: SHA }), null);
  assert.equal(lerRascunho(bruto, { loja_id: LOJA, sku: "OUTRO", sha256: SHA }), null);
  assert.equal(lerRascunho(bruto, { loja_id: LOJA, sku: "FIX-001", sha256: "d".repeat(64) }), null);
  assert.equal(lerRascunho("{quebrado", { loja_id: LOJA, sku: "FIX-001", sha256: SHA }), null);
  assert.equal(lerRascunho(null, { loja_id: LOJA, sku: "FIX-001", sha256: SHA }), null);
  assert.doesNotMatch(bruto, /data:image|base64|blob:/, "nenhum byte de imagem no rascunho");
});
test("gravarRascunho usa chave por loja e SKU e não quebra sem armazenamento", () => {
  const m = new Map<string, string>();
  const d = documentoInicial(entrada(800, 600));
  gravarRascunho({ setItem: (k, v) => void m.set(k, v) }, d);
  assert.deepEqual([...m.keys()], [chaveRascunho(LOJA, "FIX-001")]);
  assert.doesNotThrow(() => gravarRascunho(null, d));
  assert.doesNotThrow(() => gravarRascunho({ setItem: () => { throw new Error("cheio"); } }, d));
});
test("escalaContain nunca estoura a região e faixas não se sobrepõem", () => {
  for (const f of FORMATOS) {
    const { topo, base, meio } = faixasDe(f);
    assert.ok(topo.y + topo.h <= meio.y && meio.y + meio.h <= base.y, f.id);
    for (const [w, h] of [[3333, 777], [10, 10], [777, 3333]]) {
      const s = escalaContain({ w, h }, meio);
      assert.ok(w * s <= meio.w && h * s <= meio.h);
    }
  }
});

test("o resultado do Transformer é aplicado sem correção: escala torta aparece e é bloqueada", () => {
  const d = documentoInicial(entrada(800, 600));
  const torto = aplicarTransformacaoFoto(d, d.foto.posicao.x, d.foto.posicao.y, 0.6, 0.4);
  assert.notEqual(torto.foto.transform.scaleX, torto.foto.transform.scaleY);
  assert.ok(codigos(torto).includes("escala_nao_uniforme"));
  assert.equal(aplicarTransformacaoFoto(d, Number.NaN, 0, 1, 1), d);
  const ok = aplicarTransformacaoFoto(d, 100, 150, 0.5, 0.5);
  assert.ok(!codigos(ok).includes("escala_nao_uniforme"));
  assert.deepEqual(camada(ok, "foto")!.retangulo, caixaDaFoto(ok));
});
