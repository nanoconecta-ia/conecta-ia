// Adaptador dos codecs reais (@jsquash: mozjpeg, libwebp, resize em WASM). NÃO é importado por nenhuma função publicada ainda.
// Testado só em Node 22 (carrega o .wasm do disco). No Edge Function (Deno) o carregamento do WASM ainda precisa ser validado.
import type { Bitmap, Codecs } from "./pixels.ts";

export interface ModulosWasm { jpegDec: WebAssembly.Module; jpegEnc: WebAssembly.Module; pngDec: WebAssembly.Module; webpDec: WebAssembly.Module; webpEnc: WebAssembly.Module; resize: WebAssembly.Module }

// deno-lint-ignore no-explicit-any
const dados = (b: Bitmap): any => ({ width: b.width, height: b.height, data: b.data, colorSpace: "srgb" });

/** `modulos`: WebAssembly.Module já compilados (quem chama sabe de onde ler o .wasm). */
export async function codecsJsquash(m: ModulosWasm): Promise<Codecs> {
  const [jd, je, pd, wd, we, rs] = await Promise.all([
    import("@jsquash/jpeg/decode.js"), import("@jsquash/jpeg/encode.js"), import("@jsquash/png/decode.js"),
    import("@jsquash/webp/decode.js"), import("@jsquash/webp/encode.js"), import("@jsquash/resize"),
  ]);
  await Promise.all([jd.init(m.jpegDec), je.init(m.jpegEnc), pd.init(m.pngDec), wd.init(m.webpDec), we.init(m.webpEnc), rs.initResize(m.resize)]);
  const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
  return {
    async decodificar(bytes, tipo) { return (tipo === "jpeg" ? await jd.default(buf(bytes)) : tipo === "png" ? await pd.default(buf(bytes)) : await wd.default(buf(bytes))) as Bitmap; },
    async redimensionar(b, largura, altura) { return (await rs.default(dados(b), { width: largura, height: altura })) as Bitmap; },
    async codificar(b, formato) { return new Uint8Array(formato === "webp" ? await we.default(dados(b), { quality: 80 }) : await je.default(dados(b), { quality: 85 })); },
  };
}
