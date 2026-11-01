// Renderizador local Nano.IA: nenhuma rede, sem shell, sem escrita em ERP, sem publicacao.
// node --experimental-strip-types scripts/video-local/render.mjs --manifest ... --media ... --output ... --dry-run|--approve
import { readFileSync, realpathSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validarPlanoVideo, FORMATOS_VIDEO } from "../../painel/src/lib/videoPlano.ts";

export function argumentos(argv) {
  const opts = new Map();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--dry-run" || key === "--approve") { if (opts.has(key)) throw Error("Opção duplicada: " + key); opts.set(key, true); continue; }
    if (!["--manifest", "--media", "--output", "--ffmpeg"].includes(key) || opts.has(key) || i === argv.length - 1)
      throw Error("Argumentos inválidos. Informe --manifest, --media, --output e --dry-run ou --approve.");
    const val = argv[++i]; if (!val || val.startsWith("--")) throw Error("Caminho ausente para " + key);
    opts.set(key, val);
  }
  if (!opts.has("--manifest") || !opts.has("--media") || !opts.has("--output") ||
      opts.has("--dry-run") === opts.has("--approve")) throw Error("Informe manifesto, pasta de fotos, saída e apenas um de --dry-run/--approve.");
  return { manifest: opts.get("--manifest"), media: opts.get("--media"), output: opts.get("--output"), ffmpeg: opts.get("--ffmpeg") ?? "ffmpeg", dryRun: opts.has("--dry-run") };
}
const hash = b => createHash("sha256").update(b).digest("hex");
function assinatura(buf, nome) {
  const ext = nome.toLowerCase().split(".").at(-1);
  if (ext === "jpg" || ext === "jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === "png") return buf[0] === 0x89 && buf.subarray(1, 4).equals(Buffer.from("PNG"));
  if (ext === "webp") return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}
function pastaExistente(p, tipo) {
  const n = realpathSync(resolve(p));
  if (!statSync(n).isDirectory()) throw Error(tipo + " precisa ser uma pasta.");
  return n;
}
export function prepararRenderizacao({ manifest, media, output }) {
  const manifestPath = realpathSync(resolve(manifest));
  if (!statSync(manifestPath).isFile()) throw Error("Manifesto precisa ser arquivo.");
  const raw = readFileSync(manifestPath, "utf8");
  if (Buffer.byteLength(raw, "utf8") > 24_000) throw Error("Manifesto excedeu limite.");
  const validado = validarPlanoVideo(JSON.parse(raw));
  if (!validado.ok) throw Error(validado.erro);
  const p = validado.plano;
  const raiz = pastaExistente(media, "Pasta de fotos");
  const saida = pastaExistente(output, "Pasta de saída");
  const fotos = p.fotos.map(f => {
    const caminho = join(raiz, f.nome);
    if (basename(caminho) !== f.nome) throw Error("Nome de arquivo inseguro.");
    const real = realpathSync(caminho);
    if (dirname(real) !== raiz || !statSync(real).isFile()) throw Error("Foto fora da pasta autorizada.");
    const bytes = readFileSync(real);
    if (bytes.length !== f.bytes || !assinatura(bytes, f.nome) || hash(bytes) !== f.sha256)
      throw Error("Original não confere com o plano: " + f.nome);
    return real;
  });
  const formato = FORMATOS_VIDEO.find(f => f.id === p.formato);
  if (!formato) throw Error("Formato não suportado.");
  const arquivo = join(saida, "nano-video-" + p.sku + ".mp4");
  if (existsSync(arquivo)) throw Error("A saída já existe. Não sobrescrevemos arquivos.");
  return { plano: p, fotos, arquivo, formato };
}
export function parametrosFfmpeg(o) {
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-n"];
  for (const f of o.fotos) args.push("-loop", "1", "-framerate", "25", "-t", String(o.plano.segundos_por_foto), "-i", f);
  const { largura: w, altura: h } = o.formato;
  const filtros = o.fotos.map((_, i) =>
    "[" + i + ":v]scale=" + w + ":" + h + ":force_original_aspect_ratio=decrease:flags=lanczos,pad=" + w + ":" + h + ":(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=25,trim=duration=" + o.plano.segundos_por_foto + ",setpts=PTS-STARTPTS[v" + i + "]");
  const fim = o.fotos.length === 1 ? "[v0]null[outv]" :
    o.fotos.map((_, i) => "[v" + i + "]").join("") + "concat=n=" + o.fotos.length + ":v=1:a=0[outv]";
  args.push("-filter_complex", [...filtros, fim].join(";"),
    "-map", "[outv]", "-an", "-c:v", "libx264", "-preset", "ultrafast",
    "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", o.arquivo);
  return args;
}
export async function executarRenderizacao(cfg, lancar = spawn) {
  const preparado = prepararRenderizacao(cfg);
  const args = parametrosFfmpeg(preparado);
  if (cfg.dryRun) return { modo: "simulacao_local", fotos: preparado.fotos.length,
    duracao_s: preparado.fotos.length * preparado.plano.segundos_por_foto, formato: preparado.plano.formato,
    destino: preparado.arquivo, verificado: true, gerado: false };
  if (!cfg.approve) throw Error("Renderização exige autorização --approve.");
  const binario = cfg.ffmpeg ?? "ffmpeg";
  await new Promise((ok, fail) => {
    const proc = lancar(binario, args, { shell: false, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let erro = "";
    proc.stderr?.on("data", buf => { if (erro.length < 4000) erro += String(buf).slice(0, 4000 - erro.length); });
    proc.once("error", fail);
    proc.once("close", code => code === 0 ? ok() : fail(Error("FFmpeg falhou (código " + code + "). " + erro.slice(-900))));
  });
  if (!existsSync(preparado.arquivo) || !statSync(preparado.arquivo).isFile() || !statSync(preparado.arquivo).size)
    throw Error("Processo terminou mas nenhum MP4 válido foi encontrado.");
  return { modo: "renderizado_local", gerado: true, arquivo: preparado.arquivo,
    tamanho_bytes: statSync(preparado.arquivo).size, fotos: preparado.fotos.length };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const opt = argumentos(process.argv.slice(2));
    const r = await executarRenderizacao({ ...opt, approve: !opt.dryRun });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error("NANO_VIDEO_NEGADO: " + (e instanceof Error ? e.message : "Falha não classificada."));
    process.exitCode = 1;
  }
}
