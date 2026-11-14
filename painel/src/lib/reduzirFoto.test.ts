import { test } from "node:test";
import assert from "node:assert/strict";
import { planejarReducao, prepararFotoParaEnvio, type Ambiente } from "./reduzirFoto.ts";

const arq = (tipo: string, tam: number, nome = "IMG 001.jpg") => new File([new Uint8Array(tam)], nome, { type: tipo });
function amb(w: number, h: number, opc: { blob?: Blob | null; falhaAbrir?: boolean } = {}) {
  const chamadas: { l: number; a: number; tipo: string }[] = []; let fechou = false;
  const a: Ambiente = {
    async criarBitmap() { if (opc.falhaAbrir) throw new Error("x"); return { width: w, height: h, close: () => { fechou = true; } }; },
    async reduzir(_b, l, al, tipo) { chamadas.push({ l, a: al, tipo }); return opc.blob === undefined ? new Blob([new Uint8Array(1000)], { type: tipo }) : opc.blob; },
  };
  return { a, chamadas, get fechou() { return fechou; } };
}

test("planejar: foto de celular 12 MP vira ≤1600 de lado e ≤2 MP, mantendo a proporção", () => {
  const p = planejarReducao(4000, 3000);
  assert.equal(p.reduzir, true);
  assert.ok(Math.max(p.largura, p.altura) <= 1600 && p.largura * p.altura <= 2_000_000);
  assert.ok(Math.abs(p.largura / p.altura - 4 / 3) < 0.01);
});

test("planejar: foto que já cabe NÃO é reduzida nem ampliada", () => {
  assert.deepEqual(planejarReducao(1040, 520), { reduzir: false, largura: 1040, altura: 520 });
  assert.deepEqual(planejarReducao(1600, 1200), { reduzir: false, largura: 1600, altura: 1200 });
  assert.equal(planejarReducao(100, 100).reduzir, false);
});

test("planejar: panorâmica e retrato; nunca zero; entrada inválida falha", () => {
  assert.deepEqual(planejarReducao(6000, 1000), { reduzir: true, largura: 1600, altura: 266 });
  const r = planejarReducao(3000, 4000); assert.ok(r.altura <= 1600 && r.largura < r.altura);
  assert.equal(planejarReducao(1, 9000).largura, 1);
  assert.throws(() => planejarReducao(0, 10)); assert.throws(() => planejarReducao(NaN, 10));
});

test("preparar: foto pequena segue INTACTA (mesmo arquivo, sem recompressão)", async () => {
  const f = arq("image/jpeg", 30000); const h = amb(1040, 520);
  const r = await prepararFotoParaEnvio(f, h.a);
  assert.equal(r.reduzida, false); assert.equal(r.arquivo, f); assert.equal(h.chamadas.length, 0); assert.equal(h.fechou, true);
});

test("preparar: foto grande vira cópia reduzida em JPEG; nome seguro; libera o bitmap", async () => {
  const f = arq("image/jpeg", 4_000_000, "Foto do Motor (1)!.JPG"); const h = amb(4000, 3000);
  const r = await prepararFotoParaEnvio(f, h.a);
  assert.equal(r.reduzida, true); assert.equal(r.tipo, "image/jpeg"); assert.equal(r.nome, "Foto-do-Motor-1-reduzida.jpg");
  assert.deepEqual([r.larguraOriginal, r.alturaOriginal], [4000, 3000]); assert.ok(r.largura <= 1600);
  assert.equal(h.chamadas[0].tipo, "image/jpeg"); assert.equal(h.fechou, true);
  assert.notEqual(r.arquivo, f, "a original não é tocada");
});

test("preparar: PNG grande segue PNG (pode ter transparência); WebP vira JPEG", async () => {
  assert.equal((await prepararFotoParaEnvio(arq("image/png", 5_000_000, "a.png"), amb(3000, 3000).a)).tipo, "image/png");
  assert.equal((await prepararFotoParaEnvio(arq("image/webp", 5_000_000, "a.webp"), amb(3000, 3000).a)).tipo, "image/jpeg");
});

test("preparar: recusas com mensagem clara", async () => {
  await assert.rejects(prepararFotoParaEnvio(arq("image/gif", 10), amb(10, 10).a), /JPG, PNG ou WebP/);
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 0), amb(10, 10).a), /vazio/);
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 16 * 1024 * 1024), amb(10, 10).a), /15 MB/);
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 100), amb(10, 10, { falhaAbrir: true }).a), /corrompida/);
  const h = amb(20000, 10000);
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 100), h.a), /resolução alta/);
  assert.equal(h.fechou, true, "libera o bitmap mesmo na recusa");
});

test("preparar: canvas sem resultado, ou redução que não compensa, não devolve lixo", async () => {
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 4_000_000), amb(4000, 3000, { blob: null }).a), /Não foi possível reduzir/);
  await assert.rejects(prepararFotoParaEnvio(arq("image/jpeg", 500), amb(4000, 3000).a), /sem aumentar/);
});
