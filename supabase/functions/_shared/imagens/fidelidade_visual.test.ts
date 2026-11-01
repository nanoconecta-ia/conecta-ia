import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarFidelidadeVisual, exigirFidelidade, FidelidadeBloqueio, hashComposicao, aposEdicao, transicaoPermitida, caixaDaFoto,
  type Ativo, type Autorizacoes, type Contexto, type Documento, type Produto,
} from "./fidelidade_visual.ts";

// Fixture SINTÉTICA: "engrenagem de 26 dentes" é só um retângulo de 600x600 num banner 1200x1200 (não é foto de peça real, não é produto da Mobis).
const SHA = "a".repeat(64);
const LOJA = "aaaaaaaa-0000-0000-0000-000000000001";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const docBase = (): Documento => ({
  loja_id: LOJA, sku: "FIX-001", status: "rascunho", formato: { w: 1200, h: 1200 }, area_segura: { x: 40, y: 40, w: 1120, h: 1120 },
  camadas: [
    { id: "fundo", tipo: "fundo", retangulo: { x: 0, y: 0, w: 1200, h: 1200 } },
    { id: "foto", tipo: "produto", retangulo: { x: 300, y: 300, w: 600, h: 600 }, bloqueada: true },
    { id: "titulo", tipo: "texto", retangulo: { x: 40, y: 40, w: 1120, h: 200 }, texto: "Bomba de óleo", campo: "nome" },
    { id: "preco", tipo: "preco", retangulo: { x: 40, y: 960, w: 500, h: 160 }, texto: "R$ 99,90", campo: "preco" },
  ],
  foto: { asset_id: "asset-1", sha256: SHA, natural: { w: 600, h: 600 }, posicao: { x: 300, y: 300 }, transform: { scaleX: 1, scaleY: 1 }, recorte: null, apresentada_como: "real" },
  hash_aprovado: null,
});
const ativoBase = (): Ativo => ({
  asset_id: "asset-1", loja_id: LOJA, sha256_original: SHA, tipo: "real", origem: "foto_propria", licenca_confirmada: true, url_terceiro: null,
  identidade: { codigo_fabricante: "FAB-123", oem: null, evidencias: [{ documento: "catalogo-fabricante.pdf p.12", data: "2026-11-01" }] },
});
const produtoBase = (): Produto => ({
  loja_id: LOJA, sku: "FIX-001",
  fatos: { nome: { valor: "Bomba de óleo", confirmado: true, fonte: "bling" }, preco: { valor: "R$ 99,90", confirmado: true, fonte: "bling" } },
});
const autBase = (): Autorizacoes => ({ identidade_aprovada: true, direitos_aprovados: true });
const ctxRascunho = (): Contexto => ({ acao: "salvar", ator: "usuario" });
const ctxFinal = (over: Partial<Contexto> = {}): Contexto => ({ acao: "autorizar", ator: "usuario", checagens_humanas: [true, true, true], ...over });
const codigos = (r: ReturnType<typeof validarFidelidadeVisual>) => r.bloqueios.map((x) => x.codigo);

test("passa: banner 'contain' sem deformação, camadas fora da peça, dados confirmados", () => {
  const r = validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), autBase(), ctxRascunho());
  assert.deepEqual(codigos(r), []);
  assert.equal(r.ok, true);
  assert.match(r.manuais.join(" "), /não detecta alteração de pixels/);
});
test("passa também para autorizar quando identidade, direitos e as três checagens existem", () => {
  assert.equal(validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), autBase(), ctxFinal()).ok, true);
});

// ── Transformações proibidas
test("bloqueia escala não uniforme (scaleX 1.2, scaleY 1)", () => {
  const d = docBase(); d.foto.transform = { scaleX: 1.2, scaleY: 1 };
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("escala_nao_uniforme"));
});
test("aceita escala uniforme com arredondamento; recusa escala zero, negativa ou NaN", () => {
  const d = docBase(); d.foto.transform = { scaleX: 0.5, scaleY: 0.5001 }; d.camadas[1].retangulo = { ...caixaDaFoto(d) }; d.foto.posicao = { x: 300, y: 300 };
  assert.ok(!codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("escala_nao_uniforme"));
  for (const v of [0, -1, Number.NaN]) {
    const e = docBase(); e.foto.transform = { scaleX: v, scaleY: v };
    assert.ok(codigos(validarFidelidadeVisual(e, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("escala_invalida"));
  }
});
test("bloqueia espelhamento, inclinação, rotação, perspectiva e máscara", () => {
  const casos: [Partial<Documento["foto"]["transform"]>, string][] = [
    [{ flipX: true }, "espelhamento"], [{ flipY: true }, "espelhamento"], [{ skewX: 5 }, "inclinacao"], [{ skewY: 1 }, "inclinacao"],
    [{ rotacao: 3 }, "rotacao_nao_permitida"], [{ perspectiva: true }, "perspectiva"], [{ mascara: true }, "mascara"],
  ];
  for (const [t, cod] of casos) {
    const d = docBase(); d.foto.transform = { scaleX: 1, scaleY: 1, ...t };
    assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes(cod), cod);
  }
});
test("bloqueia reparo/inpainting/edição generativa da peça (troca de dentes, furos, inscrições)", () => {
  for (const f of ["inpainting", "generativa"] as const) {
    const d = docBase(); d.foto.transform = { scaleX: 1, scaleY: 1, [f]: true };
    assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("edicao_generativa"));
  }
});

// ── Recorte e geometria
test("bloqueia recorte que corta parte da peça (cortar dentes); aceita 'recorte' que cobre a imagem inteira", () => {
  const d = docBase(); d.foto.recorte = { x: 0, y: 0, w: 450, h: 600 };
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("crop_proibido"));
  const ok = docBase(); ok.foto.recorte = { x: 0, y: 0, w: 600, h: 600 };
  assert.ok(!codigos(validarFidelidadeVisual(ok, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("crop_proibido"));
});
test("bloqueia peça que não cabe inteira na área segura (sai do banner)", () => {
  const d = docBase(); d.foto.posicao = { x: 700, y: 300 }; d.camadas[1].retangulo = { x: 700, y: 300, w: 600, h: 600 };
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("peca_fora_da_area_segura"));
});
test("bloqueia camada da peça desbloqueada, duplicada ou que não bate com a foto", () => {
  const a = docBase(); a.camadas[1].bloqueada = false;
  assert.ok(codigos(validarFidelidadeVisual(a, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("camada_produto_desbloqueada"));
  const b = docBase(); b.camadas.push({ ...b.camadas[1], id: "foto2" });
  assert.ok(codigos(validarFidelidadeVisual(b, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("camada_produto_invalida"));
  const c = docBase(); c.camadas[1].retangulo = { x: 300, y: 300, w: 700, h: 600 };
  assert.ok(codigos(validarFidelidadeVisual(c, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("camada_produto_inconsistente"));
});
test("bloqueia texto, logotipo e selo sobre a peça", () => {
  for (const tipo of ["texto", "logo", "selo", "cta", "preco"] as const) {
    const d = docBase(); d.camadas.push({ id: "x", tipo, retangulo: { x: 500, y: 500, w: 100, h: 50 }, texto: tipo === "logo" ? undefined : "Oferta" });
    assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("camada_sobre_a_peca"), tipo);
  }
});

// ── Original, loja e SKU
test("bloqueia SHA divergente ou ausente do original", () => {
  const d = docBase(); d.foto.sha256 = "b".repeat(64);
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("sha_divergente"));
  const at = ativoBase(); at.sha256_original = "";
  assert.ok(codigos(validarFidelidadeVisual(docBase(), at, produtoBase(), autBase(), ctxRascunho())).includes("sha_original_ausente"));
});
test("bloqueia ativo de outra loja (loja B usando imagem da loja A) e produto de outro SKU", () => {
  const at = ativoBase(); at.loja_id = "bbbbbbbb-0000-0000-0000-000000000002";
  assert.ok(codigos(validarFidelidadeVisual(docBase(), at, produtoBase(), autBase(), ctxRascunho())).includes("loja_diferente"));
  const p = produtoBase(); p.sku = "OUTRO-9";
  assert.ok(codigos(validarFidelidadeVisual(docBase(), ativoBase(), p, autBase(), ctxRascunho())).includes("sku_diferente"));
  const at2 = ativoBase(); at2.asset_id = "asset-2";
  assert.ok(codigos(validarFidelidadeVisual(docBase(), at2, produtoBase(), autBase(), ctxRascunho())).includes("ativo_diferente"));
});

// ── Dados técnicos, preço e garantia
test("preço, garantia, dentes e medidas sem origem confirmada são bloqueados", () => {
  const casos: [string, string][] = [["R$ 89,90", "preco_sem_origem"], ["Garantia de 12 meses", "garantia_sem_origem"], ["26 dentes", "tecnico_sem_origem"], ["Ø 52 mm", "tecnico_sem_origem"]];
  for (const [texto, cod] of casos) {
    const d = docBase(); d.camadas.push({ id: "t", tipo: "texto", retangulo: { x: 40, y: 250, w: 600, h: 40 }, texto });
    assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes(cod), texto);
  }
});
test("pedido de pesquisa 'TRIM GO CI001086 bomba 26 dentes' NÃO vira dado: texto sem campo confirmado é bloqueado", () => {
  const d = docBase(); d.camadas.push({ id: "t", tipo: "texto", retangulo: { x: 40, y: 250, w: 600, h: 40 }, texto: "TRIM GO CI001086 bomba 26 dentes" });
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("tecnico_sem_origem"));
});
test("campo inexistente, não confirmado ou com valor diferente é bloqueado", () => {
  const a = docBase(); a.camadas.push({ id: "g", tipo: "texto", retangulo: { x: 40, y: 250, w: 600, h: 40 }, texto: "12 meses", campo: "garantia" });
  assert.ok(codigos(validarFidelidadeVisual(a, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("dado_inventado"));
  const p = produtoBase(); p.fatos.garantia = { valor: "12 meses", confirmado: false };
  assert.ok(codigos(validarFidelidadeVisual(a, ativoBase(), p, autBase(), ctxRascunho())).includes("dado_nao_confirmado"));
  const b = docBase(); b.camadas[3].texto = "R$ 79,90";
  assert.ok(codigos(validarFidelidadeVisual(b, ativoBase(), produtoBase(), autBase(), ctxRascunho())).includes("texto_diverge_do_dado"));
});

// ── Identidade, direitos, sintética, checagens
test("autorizar exige evidência de identidade, aprovação de identidade e direitos", () => {
  const sem = ativoBase(); sem.identidade = { codigo_fabricante: null, oem: null, evidencias: [] };
  assert.ok(codigos(validarFidelidadeVisual(docBase(), sem, produtoBase(), autBase(), ctxFinal())).includes("identidade_sem_evidencia"));
  assert.ok(codigos(validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), { identidade_aprovada: false, direitos_aprovados: true }, ctxFinal())).includes("identidade_nao_aprovada"));
  const semLic = ativoBase(); semLic.licenca_confirmada = false;
  assert.ok(codigos(validarFidelidadeVisual(docBase(), semLic, produtoBase(), autBase(), ctxFinal())).includes("direitos_nao_confirmados"));
  assert.ok(codigos(validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), { identidade_aprovada: true, direitos_aprovados: false }, ctxFinal())).includes("direitos_nao_confirmados"));
});
test("rascunho sem identidade passa, mas com aviso (não pode ser autorizado depois)", () => {
  const sem = ativoBase(); sem.identidade = { codigo_fabricante: null, oem: null, evidencias: [] };
  const r = validarFidelidadeVisual(docBase(), sem, produtoBase(), autBase(), ctxRascunho());
  assert.equal(r.ok, true); assert.match(r.avisos.join(" "), /sem código do fabricante/);
});
test("imagem gerada por IA ou ilustrativa não pode ser apresentada como foto real", () => {
  for (const tipo of ["gerada_ia", "ilustrativa"] as const) {
    const at = ativoBase(); at.tipo = tipo;
    assert.ok(codigos(validarFidelidadeVisual(docBase(), at, produtoBase(), autBase(), ctxFinal())).includes("sintetica_como_real"), tipo);
  }
});
test("autorizar sem as três checagens humanas é bloqueado", () => {
  for (const c of [undefined, [true, true], [true, false, true]]) {
    assert.ok(codigos(validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), autBase(), ctxFinal({ checagens_humanas: c }))).includes("checagem_humana_pendente"));
  }
});

// ── O agente nunca autoriza nem publica
test("o agente é bloqueado ao autorizar, exportar e publicar, mesmo com tudo aprovado", async () => {
  const d = docBase(); d.status = "aprovado_para_destino"; d.hash_aprovado = await hashComposicao(d);
  for (const acao of ["autorizar", "exportar", "publicar"] as const) {
    const r = validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxFinal({ acao, ator: "agente", destino: "download", hash_atual: d.hash_aprovado }));
    const c = codigos(r); assert.ok(c.includes("agente_nao_autoriza"), acao); assert.ok(c.includes("agente_nao_define_status"), acao);
  }
  assert.throws(() => exigirFidelidade(d, ativoBase(), produtoBase(), autBase(), ctxFinal({ acao: "publicar", ator: "agente", destino: "download", hash_atual: d.hash_aprovado })), FidelidadeBloqueio);
});
test("o agente pode salvar rascunho e solicitar revisão", () => {
  for (const acao of ["salvar", "solicitar_revisao"] as const)
    assert.equal(validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), autBase(), { acao, ator: "agente" }).ok, true, acao);
});

// ── Destino e aprovação por hash
test("exportar/publicar: destino obrigatório; Drive e URL de terceiros não são URL definitiva de catálogo", async () => {
  const d = docBase(); d.status = "aprovado_para_destino"; d.hash_aprovado = await hashComposicao(d);
  const base = { acao: "publicar" as const, hash_atual: d.hash_aprovado };
  assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxFinal(base))).includes("destino_ausente"));
  for (const url of ["https://drive.google.com/file/d/abc/view", "https://lh3.googleusercontent.com/x", "http://loja.example/a.jpg", ""]) {
    assert.ok(codigos(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxFinal({ ...base, destino: "bling", url_destino: url }))).includes("url_destino_invalida"), url);
  }
  const at = ativoBase(); at.url_terceiro = "https://terceiro.example/foto.jpg";
  assert.ok(codigos(validarFidelidadeVisual(d, at, produtoBase(), autBase(), ctxFinal({ ...base, destino: "site", url_destino: "https://terceiro.example/foto.jpg" }))).includes("url_destino_invalida"));
  assert.equal(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctxFinal({ ...base, destino: "site", url_destino: "https://cdn.minhaloja.example/a.webp" })).ok, true);
});
test("hash aprovado: editar depois da aprovação invalida e exige nova revisão", async () => {
  const d = docBase(); d.status = "aprovado_para_destino"; d.hash_aprovado = await hashComposicao(d);
  const ctx = (hash: string) => ctxFinal({ acao: "exportar", destino: "download", hash_atual: hash });
  assert.equal(validarFidelidadeVisual(d, ativoBase(), produtoBase(), autBase(), ctx(d.hash_aprovado)).ok, true);
  const editado = clone(d); editado.camadas[2].texto = "Outro título"; editado.camadas[2].campo = undefined;
  const novo = await hashComposicao(editado);
  assert.notEqual(novo, d.hash_aprovado);
  assert.ok(codigos(validarFidelidadeVisual(editado, ativoBase(), produtoBase(), autBase(), ctx(novo))).includes("aprovacao_invalidada"));
  const depois = await aposEdicao(editado);
  assert.equal(depois.status, "rascunho"); assert.equal(depois.hash_aprovado, null);
  assert.equal((await aposEdicao(d)).status, "aprovado_para_destino"); // sem edição, a aprovação continua
});
test("exportar sem versão aprovada ou com status errado é bloqueado", () => {
  const r = validarFidelidadeVisual(docBase(), ativoBase(), produtoBase(), autBase(), ctxFinal({ acao: "exportar", destino: "download", hash_atual: "x" }));
  const c = codigos(r); assert.ok(c.includes("sem_aprovacao")); assert.ok(c.includes("status_invalido"));
});
test("o hash ignora status e hash aprovado, mas muda com qualquer alteração de composição", async () => {
  const d = docBase(); const h = await hashComposicao(d);
  const mesmo = clone(d); mesmo.status = "aguardando_revisao"; mesmo.hash_aprovado = "qualquer";
  assert.equal(await hashComposicao(mesmo), h);
  const outro = clone(d); outro.foto.transform = { scaleX: 0.99, scaleY: 0.99 };
  assert.notEqual(await hashComposicao(outro), h);
  assert.match(h, /^[0-9a-f]{64}$/);
});

// ── Estados
test("transições: uma etapa de cada vez; o agente só chega a aguardando_revisao; voltar a rascunho é livre", () => {
  assert.equal(transicaoPermitida("rascunho", "aguardando_revisao", "agente"), true);
  assert.equal(transicaoPermitida("aguardando_revisao", "aprovado_para_destino", "agente"), false);
  assert.equal(transicaoPermitida("aguardando_revisao", "aprovado_para_destino", "usuario"), true);
  assert.equal(transicaoPermitida("rascunho", "publicado", "usuario"), false);
  assert.equal(transicaoPermitida("rascunho", "aprovado_para_destino", "usuario"), false);
  assert.equal(transicaoPermitida("publicado", "rascunho", "agente"), true);
});

test("determinismo: o mesmo dado dá o mesmo resultado, sem alterar os objetos recebidos", () => {
  const d = docBase(), at = ativoBase(), p = produtoBase();
  const antes = JSON.stringify([d, at, p]);
  const r1 = validarFidelidadeVisual(d, at, p, autBase(), ctxRascunho()), r2 = validarFidelidadeVisual(d, at, p, autBase(), ctxRascunho());
  assert.deepEqual(r1, r2); assert.equal(JSON.stringify([d, at, p]), antes);
});
