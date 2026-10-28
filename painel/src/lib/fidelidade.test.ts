import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG_PADRAO, FILTRO_MELHORADA, bannerLigado, comparadorLigado, gravarConfig, lerConfig, limitarZoom, podeAprovar, pontoDoClique, sha256Hex, validarArquivo } from "./fidelidade.ts";

const armazem = (v: string | null) => ({ getItem: () => v });

test("aprovação só com as 3 checagens humanas marcadas", () => {
  assert.equal(podeAprovar([true, true, false]), false);
  assert.equal(podeAprovar([true, true]), false);
  assert.equal(podeAprovar([]), false);
  assert.equal(podeAprovar([true, true, true]), true);
});

test("o filtro da melhorada só mexe em luz e cor (nada que altere a geometria)", () => {
  assert.doesNotMatch(FILTRO_MELHORADA, /blur|drop-shadow|url\(|hue/);
  assert.match(FILTRO_MELHORADA, /brightness.*contrast.*saturate/);
});

test("configuração: padrão manual; lixo e modo/recursos indisponíveis voltam ao padrão", () => {
  assert.deepEqual(lerConfig(null), CONFIG_PADRAO);
  assert.deepEqual(lerConfig(armazem("{não é json")), CONFIG_PADRAO);
  const c = lerConfig(armazem(JSON.stringify({ modo: "automatico_restrito", recursos: { veiculos: true, sugestoes_site: true, fotos: false } })));
  assert.equal(c.modo, "manual", "automático restrito ainda não existe");
  assert.equal(c.recursos.veiculos, false);
  assert.equal(c.recursos.sugestoes_site, false);
  assert.equal(c.recursos.fotos, false, "recurso disponível respeita a escolha");
});

test("desligado ou recurso desligado esconde a transformação", () => {
  assert.equal(comparadorLigado(CONFIG_PADRAO), true);
  assert.equal(comparadorLigado({ ...CONFIG_PADRAO, modo: "desligado" }), false);
  assert.equal(bannerLigado({ ...CONFIG_PADRAO, recursos: { ...CONFIG_PADRAO.recursos, banners: false } }), false);
});

test("gravar e ler a configuração neste aparelho", () => {
  let guardado = "";
  gravarConfig({ setItem: (_k, v) => { guardado = v; } }, { ...CONFIG_PADRAO, modo: "desligado" });
  assert.equal(lerConfig(armazem(guardado)).modo, "desligado");
  assert.doesNotThrow(() => gravarConfig({ setItem: () => { throw new Error("cheio"); } }, CONFIG_PADRAO));
});

test("ponto de interesse e zoom ficam dentro dos limites", () => {
  assert.deepEqual(pontoDoClique(50, 25, 200, 100), { x: 25, y: 25 });
  assert.deepEqual(pontoDoClique(-5, 999, 200, 100), { x: 0, y: 100 });
  assert.deepEqual(pontoDoClique(1, 1, 0, 0), { x: 50, y: 50 });
  assert.equal(limitarZoom(0.2), 1);
  assert.equal(limitarZoom(9), 4);
  assert.equal(limitarZoom(Number.NaN), 1);
});

test("arquivo: só foto, até 15 MB, não vazio", () => {
  assert.equal(validarArquivo({ type: "image/jpeg", size: 1000 }), null);
  assert.match(validarArquivo({ type: "application/pdf", size: 1000 }) ?? "", /JPG/);
  assert.match(validarArquivo({ type: "image/png", size: 16 * 1024 * 1024 }) ?? "", /15 MB/);
  assert.match(validarArquivo({ type: "image/png", size: 0 }) ?? "", /vazio/);
});

test("SHA-256 conhecido", async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
