// Integração com os codecs REAIS. Só roda onde @jsquash/* está instalado e a foto de teste existe; caso contrário é ignorado
// (o CI das funções não instala essas dependências). Para rodar localmente: npm i @jsquash/{jpeg,png,webp,resize} na raiz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { processarVariantes } from "./pixels.ts";
import { codecsJsquash } from "./codecs_jsquash.ts";
import { VARIANTES } from "./variantes.ts";

const FOTO = new URL("../../../../painel/public/produtos/ci002916/foto1.jpg", import.meta.url);
let raiz: string | null = null;
try { raiz = createRequire(import.meta.url).resolve("@jsquash/jpeg/package.json").replace(/jpeg[\\/]package\.json$/, ""); } catch { /* sem dependência */ }
const pronto = raiz !== null && existsSync(FOTO);

test("codecs reais: foto 1040x520 gera as 4 variantes decodificáveis, sem ampliar", { skip: !pronto && "sem @jsquash instalado" }, async () => {
  const wasm = (p: string) => WebAssembly.compile(readFileSync(raiz + p));
  const c = await codecsJsquash({
    jpegDec: await wasm("jpeg/codec/dec/mozjpeg_dec.wasm"), jpegEnc: await wasm("jpeg/codec/enc/mozjpeg_enc.wasm"), pngDec: await wasm("png/codec/pkg/squoosh_png_bg.wasm"),
    webpDec: await wasm("webp/codec/dec/webp_dec.wasm"), webpEnc: await wasm("webp/codec/enc/webp_enc.wasm"), resize: await wasm("resize/lib/resize/pkg/squoosh_resize_bg.wasm"),
  });
  const r = await processarVariantes(new Uint8Array(readFileSync(FOTO)), VARIANTES, c);
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.origem, { largura: 1040, altura: 520, tipo: "jpeg" });
  for (const v of r.variantes) {
    assert.ok(v.largura <= 1040 && v.altura <= 520 && v.bytes.length > 500, v.spec);
    const de = v.formato === "webp" ? [0x52, 0x49, 0x46, 0x46] : [0xff, 0xd8, 0xff];
    assert.deepEqual([...v.bytes.slice(0, de.length)], de, `${v.spec}: assinatura do formato`);
  }
  // o resultado decodifica de volta com as dimensões declaradas
  const volta = await c.decodificar(r.variantes[0].bytes, "webp");
  assert.deepEqual([volta.width, volta.height], [400, 200]);
  const lista = r.variantes[0].bytes.length, detalhe = r.variantes[1].bytes.length;
  console.log(`# bytes: lista ${lista}, detalhe ${detalhe}, merchant ${r.variantes[2].bytes.length}, og ${r.variantes[3].bytes.length}`);
});
