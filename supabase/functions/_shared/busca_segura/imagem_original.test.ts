import { test } from "node:test";
import assert from "node:assert/strict";
import { baixarImagemOriginal, inspecionarBytes, sha256Hex, urlImagemSegura } from "./imagem_original.ts";

const png = (w: number, h: number) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
const jpeg = (w: number, h: number) => { const b = new Uint8Array(40); b.set([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0]); return b; };
const webpX = (w: number, h: number) => { const b = new Uint8Array(40); b.set([...("RIFF").split("").map((c) => c.charCodeAt(0)), 0, 0, 0, 0, ...("WEBPVP8X").split("").map((c) => c.charCodeAt(0)), 10, 0, 0, 0, 0, 0, 0, 0]); const w1 = w - 1, h1 = h - 1; b[24] = w1 & 255; b[25] = (w1 >> 8) & 255; b[26] = (w1 >> 16) & 255; b[27] = h1 & 255; b[28] = (h1 >> 8) & 255; b[29] = (h1 >> 16) & 255; return b; };
const resp = (corpo: Uint8Array | string, init: ResponseInit = { status: 200 }) => new Response(corpo as BodyInit, init);

test("URL: só https público; recusa credencial, porta, IP, interno, IPv6", () => {
  assert.equal(urlImagemSegura("https://www.fabricante.com.br/p/1.jpg").ok, true);
  for (const u of ["http://x.com/a.jpg", "https://u:p@x.com/a.jpg", "https://x.com:8443/a.jpg", "https://127.0.0.1/a.jpg", "https://169.254.169.254/latest", "https://10.0.0.5/a", "https://192.168.1.1/a", "https://2130706433/a", "https://0x7f.1/a", "https://localhost/a", "https://intranet/a", "https://x.internal/a", "https://metadata.google.internal/a", "https://a.local/a", "https://[::1]/a", "https://8.8.8.8/a", "javascript:alert(1)", "não é url"]) assert.equal(urlImagemSegura(u).ok, false, u);
});
test("bytes: PNG, JPEG e WebP com dimensões; SVG/GIF/HTML recusados", () => {
  assert.deepEqual(inspecionarBytes(png(1200, 900)), { mime: "image/png", largura_px: 1200, altura_px: 900 });
  assert.deepEqual(inspecionarBytes(jpeg(800, 600)), { mime: "image/jpeg", largura_px: 800, altura_px: 600 });
  assert.deepEqual(inspecionarBytes(webpX(1024, 768)), { mime: "image/webp", largura_px: 1024, altura_px: 768 });
  const txt = (s: string) => new TextEncoder().encode(s.padEnd(40, " "));
  for (const s of ["<svg xmlns='http://www.w3.org/2000/svg'/>", "GIF89a", "<html><script>x()</script></html>"]) assert.equal(inspecionarBytes(txt(s)), null);
});
test("baixa a original sem alterar: SHA-256, tipo real, dimensões e aviso de resolução baixa", async () => {
  const bytes = png(500, 400);
  const r = await baixarImagemOriginal("https://cdn.fabricante.com.br/a.png", { fetchFn: async () => resp(bytes) });
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.imagem.sha256, await sha256Hex(bytes)); assert.equal(r.imagem.bytes, 33); assert.equal(r.imagem.mime, "image/png"); assert.equal(r.imagem.largura_px, 500); assert.ok(r.imagem.avisos[0].includes("Resolução baixa")); }
});
test("tipo vem dos bytes, não do cabeçalho: HTML com content-type image/png é recusado", async () => {
  const r = await baixarImagemOriginal("https://x.com.br/a.png", { fetchFn: async () => resp("<html></html>".padEnd(40, " "), { status: 200, headers: { "content-type": "image/png" } }) });
  assert.equal(r.ok, false);
});
test("redirecionamento é revalidado: para IP interno é recusado; dentro do limite é seguido", async () => {
  const mau = await baixarImagemOriginal("https://x.com.br/a", { fetchFn: async () => resp("", { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }) });
  assert.equal(mau.ok, false);
  let n = 0;
  const bom = await baixarImagemOriginal("https://x.com.br/a", { fetchFn: async () => (n++ === 0 ? resp("", { status: 301, headers: { location: "/b.jpg" } }) : resp(jpeg(1000, 800))) });
  assert.equal(bom.ok, true);
  const laco = await baixarImagemOriginal("https://x.com.br/a", { fetchFn: async () => resp("", { status: 302, headers: { location: "https://x.com.br/a" } }) });
  assert.equal(laco.ok, false);
});
test("tamanho acima do máximo, status de erro e falha de rede recusam", async () => {
  assert.equal((await baixarImagemOriginal("https://x.com.br/a", { maxBytes: 20, fetchFn: async () => resp(png(900, 900)) })).ok, false);
  assert.equal((await baixarImagemOriginal("https://x.com.br/a", { fetchFn: async () => resp("", { status: 404 }) })).ok, false);
  assert.equal((await baixarImagemOriginal("https://x.com.br/a", { fetchFn: async () => { throw new Error("x"); } })).ok, false);
});
test("resolvedor: nome que aponta para rede interna é recusado antes de baixar", async () => {
  let chamou = false;
  const r = await baixarImagemOriginal("https://rebind.exemplo.com.br/a", { resolver: async () => ["10.0.0.7"], fetchFn: async () => { chamou = true; return resp(png(900, 900)); } });
  assert.equal(r.ok, false); assert.equal(chamou, false);
  for (const ip of ["::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "169.254.169.254"]) assert.equal((await baixarImagemOriginal("https://r.exemplo.com.br/a", { resolver: async () => [ip], fetchFn: async () => resp(png(900, 900)) })).ok, false, ip);
  assert.equal((await baixarImagemOriginal("https://cdn.exemplo.com.br/a", { resolver: async () => ["93.184.216.34", "2606:2800:220:1::1"], fetchFn: async () => resp(png(900, 900)) })).ok, true);
  assert.equal((await baixarImagemOriginal("https://ok.exemplo.com.br/a", { resolver: async () => ["93.184.216.34"], fetchFn: async () => resp(png(900, 900)) })).ok, true);
});
