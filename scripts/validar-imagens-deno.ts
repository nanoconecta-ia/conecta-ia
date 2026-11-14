// Validação MANUAL do processador de imagens no runtime Deno (o mesmo das Edge Functions do Supabase).
// Uso: deno run -A scripts/validar-imagens-deno.ts <foto.jpg|png|webp>
// Mede tempo e memória; não grava nada. Não roda no CI (depende de baixar pacotes npm).
import decodeJpeg from "npm:@jsquash/jpeg@1.6.0/decode.js";
import encodeJpeg from "npm:@jsquash/jpeg@1.6.0/encode.js";
import decodePng from "npm:@jsquash/png@3.1.1/decode.js";
import decodeWebp from "npm:@jsquash/webp@1.5.0/decode.js";
import encodeWebp from "npm:@jsquash/webp@1.5.0/encode.js";
import resize from "npm:@jsquash/resize@2.1.1";
import { processarVariantes, type Bitmap, type Codecs } from "../supabase/functions/_shared/imagens/pixels.ts";
import { VARIANTES } from "../supabase/functions/_shared/imagens/variantes.ts";

const arq = Deno.args[0];
if (!arq) { console.error("informe a foto"); Deno.exit(2); }
const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
// deno-lint-ignore no-explicit-any
const dados = (b: Bitmap): any => ({ width: b.width, height: b.height, data: b.data, colorSpace: "srgb" });
const codecs: Codecs = {
  async decodificar(bytes, tipo) { return (tipo === "jpeg" ? await decodeJpeg(buf(bytes)) : tipo === "png" ? await decodePng(buf(bytes)) : await decodeWebp(buf(bytes))) as Bitmap; },
  async redimensionar(b, l, a) { return (await resize(dados(b), { width: l, height: a })) as Bitmap; },
  async codificar(b, f) { return new Uint8Array(f === "webp" ? await encodeWebp(dados(b), { quality: 80 }) : await encodeJpeg(dados(b), { quality: 85 })); },
};
const bytes = await Deno.readFile(arq);
for (const rodada of ["fria (inclui carregar WASM)", "quente"]) {
  const t = performance.now();
  const r = await processarVariantes(bytes, VARIANTES, codecs);
  const ms = Math.round(performance.now() - t);
  if (!r.ok) { console.log(rodada, "RECUSADA:", r.motivo); Deno.exit(1); }
  console.log(`${rodada}: ${ms} ms | origem ${r.origem.largura}x${r.origem.altura} ${r.origem.tipo} | ` + r.variantes.map((v) => `${v.spec} ${v.largura}x${v.altura} ${v.bytes.length}B`).join(", "));
}
console.log("memória (rss) MB:", Math.round(Deno.memoryUsage().rss / 1048576));
