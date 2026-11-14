import { test } from "node:test";
import assert from "node:assert/strict";
import { achatarSobreBranco, detectarTipo, processarVariantes, tamanhoFinal, MAX_BYTES_ORIGEM, type Bitmap, type Codecs } from "./pixels.ts";
import { VARIANTES } from "./variantes.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);

function bmp(w: number, h: number, rgba = [10, 20, 30, 255]): Bitmap {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d.set(rgba, i);
  return { width: w, height: h, data: d };
}
/** Codecs falsos: decodifica para o tamanho pedido, redimensiona de verdade em dimensões, "codifica" para bytes marcados. */
function falsos(src: Bitmap, opcoes: { falhaDecode?: boolean; amplia?: boolean } = {}) {
  const chamadas: string[] = [];
  const c: Codecs = {
    async decodificar() { chamadas.push("dec"); if (opcoes.falhaDecode) throw new Error("x"); return src; },
    async redimensionar(b, l, a) { chamadas.push(`red ${l}x${a}`); return opcoes.amplia ? bmp(b.width + 1, b.height + 1) : bmp(l, a); },
    async codificar(b, f) { chamadas.push(`cod ${f}`); return new Uint8Array([f === "webp" ? 1 : 2, b.data[3]]); },
  };
  return { c, chamadas };
}

test("detectar tipo: pela assinatura, não pela extensão", () => {
  assert.equal(detectarTipo(JPEG), "jpeg"); assert.equal(detectarTipo(PNG), "png"); assert.equal(detectarTipo(WEBP), "webp");
  assert.equal(detectarTipo(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(detectarTipo(new Uint8Array([])), null);
});

test("tamanho final: contém na caixa, mantém proporção e NUNCA amplia", () => {
  assert.deepEqual(tamanhoFinal(1040, 520, { largura: 400, altura: 400 }), { largura: 400, altura: 200 });
  assert.deepEqual(tamanhoFinal(1040, 520, { largura: 1200, altura: 1200 }), { largura: 1040, altura: 520 }, "origem menor que a caixa: fica como está");
  assert.deepEqual(tamanhoFinal(520, 1040, { largura: 800, altura: 800 }), { largura: 400, altura: 800 });
  assert.deepEqual(tamanhoFinal(1, 3000, { largura: 400, altura: 400 }), { largura: 1, altura: 400 }, "nunca zero");
  assert.throws(() => tamanhoFinal(0, 10, { largura: 1, altura: 1 }));
});

test("achatar: transparência vira branco, opaco não muda, entrada intacta", () => {
  const e = bmp(1, 2); e.data.set([0, 0, 0, 0], 0); e.data.set([100, 150, 200, 255], 4);
  const s = achatarSobreBranco(e);
  assert.deepEqual([...s.data.slice(0, 4)], [255, 255, 255, 255]);
  assert.deepEqual([...s.data.slice(4, 8)], [100, 150, 200, 255]);
  assert.equal(e.data[0], 0, "não altera a entrada");
  const meio = achatarSobreBranco({ width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 128]) });
  assert.ok(meio.data[0] > 120 && meio.data[0] < 135);
});

test("processar: decodifica uma vez, gera as 4 variantes, sem ampliar", async () => {
  const { c, chamadas } = falsos(bmp(1040, 520));
  const r = await processarVariantes(JPEG, VARIANTES, c);
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(chamadas.filter((x) => x === "dec").length, 1);
  assert.deepEqual(r.origem, { largura: 1040, altura: 520, tipo: "jpeg" });
  assert.deepEqual(r.variantes.map((v) => [v.spec, v.largura, v.altura]), [["site_lista", 400, 200], ["site_detalhe", 1040, 520], ["merchant", 800, 400], ["og", 1040, 520]]);
  assert.ok(r.variantes.every((v) => v.largura <= 1040 && v.altura <= 520));
  assert.equal(chamadas.filter((x) => x.startsWith("red")).length, 2, "variante do tamanho original não redimensiona (sem perda extra)");
});

test("processar: JPG sempre com fundo branco aplicado; WebP do site mantém transparência", async () => {
  const { c } = falsos(bmp(100, 100, [0, 0, 0, 0]));
  const r = await processarVariantes(PNG, VARIANTES, c);
  assert.ok(r.ok); if (!r.ok) return;
  const por = Object.fromEntries(r.variantes.map((v) => [v.spec, v]));
  assert.equal(por.merchant.fundoBrancoAplicado, true); assert.equal(por.og.fundoBrancoAplicado, true);
  assert.equal(por.site_lista.fundoBrancoAplicado, false);
  assert.equal(por.merchant.bytes[1], 255, "alfa 255 no JPG");
  assert.equal(por.site_lista.bytes[1], 0, "alfa 0 preservado no WebP");
});

test("processar: recusa sem lançar — vazio, grande, tipo desconhecido, corrompido, resolução absurda", async () => {
  const { c } = falsos(bmp(10, 10));
  assert.deepEqual(await processarVariantes(new Uint8Array(), VARIANTES, c), { ok: false, motivo: "arquivo vazio" });
  const grande = new Uint8Array(MAX_BYTES_ORIGEM + 1); grande.set(JPEG);
  assert.match((await processarVariantes(grande, VARIANTES, c) as { motivo: string }).motivo, /15 MB/);
  assert.match((await processarVariantes(new TextEncoder().encode("GIF89a"), VARIANTES, c) as { motivo: string }).motivo, /não suportado/);
  assert.match((await processarVariantes(JPEG, VARIANTES, falsos(bmp(1, 1), { falhaDecode: true }).c) as { motivo: string }).motivo, /corrompida/);
  const enorme: Bitmap = { width: 8000, height: 6000, data: new Uint8ClampedArray(8000 * 6000 * 4) };
  assert.match((await processarVariantes(JPEG, VARIANTES, falsos(enorme).c) as { motivo: string }).motivo, /limite de processamento/);
});

test("processar: se o redimensionador ampliar, falha alto (upscaling proibido)", async () => {
  await assert.rejects(processarVariantes(JPEG, VARIANTES, falsos(bmp(1040, 520), { amplia: true }).c), /upscaling/);
});
