import { test } from "node:test";
import assert from "node:assert/strict";
import { contraste, escurecer, FONTES, PERFIS, textoSobre, tipoImagem, validarCores, variaveisCss } from "./tema.ts";

test("contraste: preto/branco = 21; igual = 1", () => {
  assert.ok(Math.abs(contraste("#000000", "#ffffff") - 21) < 0.01); assert.ok(Math.abs(contraste("#0864a0", "#0864a0") - 1) < 0.001);
});

test("todo perfil pronto passa no AA (texto branco na primária e no bloco; texto automático no destaque)", () => {
  for (const [id, p] of Object.entries(PERFIS)) {
    const r = validarCores({ primaria: p.primaria, destaque: p.destaque, bloco: p.bloco });
    assert.ok(r.ok, `${id}: ${r.ok ? "" : r.erro}`);
    assert.ok(contraste(textoSobre(p.destaque), p.destaque) >= 4.5, id);
  }
});

test("validarCores recusa formato inválido e cor clara demais", () => {
  for (const ruim of [{ primaria: "red", destaque: "#04a88d", bloco: "#102335" }, { primaria: "#0864a0", destaque: "#04a88d", bloco: "#12345" }, { primaria: "#0864a0", destaque: "url(x)", bloco: "#102335" }, {}]) assert.ok(!validarCores(ruim as never).ok);
  assert.ok(!validarCores({ primaria: "#f5d60a", destaque: "#04a88d", bloco: "#102335" }).ok, "amarelo claro com texto branco");
  assert.ok(!validarCores({ primaria: "#0864a0", destaque: "#04a88d", bloco: "#cccccc" }).ok, "bloco claro");
  const r = validarCores({ primaria: "#0864A0", destaque: "#04A88D", bloco: "#102335" });
  assert.ok(r.ok && r.cores.primaria === "#0864a0", "normaliza para minúsculas");
});

test("textoSobre escolhe o melhor contraste e escurecer fica válido", () => {
  assert.equal(textoSobre("#0864a0"), "#ffffff"); assert.equal(textoSobre("#04a88d"), "#102335"); assert.equal(textoSobre("#f2b01e"), "#102335");
  assert.match(escurecer("#0864a0"), /^#[0-9a-f]{6}$/); assert.ok(contraste("#ffffff", escurecer("#0864a0")) > contraste("#ffffff", "#0864a0"));
});

test("tipoImagem pelos bytes: PNG, WebP e JPEG; recusa SVG, GIF, HTML e lixo", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  assert.equal(tipoImagem(png), "png"); assert.equal(tipoImagem(webp), "webp"); assert.equal(tipoImagem(jpg), "jpeg");
  const enc = (s: string) => new TextEncoder().encode(s);
  for (const r of [enc("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>"), enc("GIF89a......"), enc("<html><script>x</script></html>"), new Uint8Array(0), new Uint8Array([1, 2, 3])]) assert.equal(tipoImagem(r), null);
});

test("variaveisCss: só valores calculados e seguros; fonte restrita à lista", () => {
  const v = variaveisCss(PERFIS.vinho, "serifada");
  assert.equal(v["--marca"], "#8e1b3a"); assert.equal(v["--marca-texto"], "#ffffff"); assert.match(v["--fonte"], /Georgia/);
  for (const [k, val] of Object.entries(v)) assert.ok(!/[;{}<>]|url\(/i.test(val), k);
  assert.deepEqual([...FONTES], ["inter", "sistema", "serifada"]);
});
