// Contrato portavel entre o Studio (navegador) e o executor local do Nano.IA.
// SO fotos reais escolhidas pelo usuario; nenhum SKU, preco ou aplicacao e inferido.
export type FormatoVideo = "reels" | "quadrado" | "paisagem";
export type FotoVideo = { nome: string; sha256: string; bytes: number };
export type PlanoVideo = {
  versao: 1;
  tipo: "nano-video-local";
  loja_id: string;
  sku: string;
  titulo: string;
  marca: string;
  formato: FormatoVideo;
  segundos_por_foto: number;
  fotos: FotoVideo[];
  aprovacao: "pendente";
};
export const FORMATOS_VIDEO = [
  { id: "reels", rotulo: "Reels / Shorts · 9:16", largura: 720, altura: 1280 },
  { id: "quadrado", rotulo: "Catálogo · 1:1", largura: 960, altura: 960 },
  { id: "paisagem", rotulo: "Vídeo horizontal · 16:9", largura: 1280, altura: 720 },
] as const;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/i;
const NOME = /^[^/\\:\x00-\x1f<>|"*?]+[.](?:jpe?g|png|webp)$/i;
const SKU = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,59}$/;
const proibidos = /\b(?:custo|margem|cpf|cnpj|token|senha|fornecedor|ncm|cfop|cest)\b/i;

export function validarPlanoVideo(v: unknown): { ok: true; plano: PlanoVideo } | { ok: false; erro: string } {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, erro: "Plano inválido." };
  const p = v as Record<string, unknown>;
  if (p.versao !== 1 || p.tipo !== "nano-video-local" || p.aprovacao !== "pendente") return { ok: false, erro: "Versão ou tipo de plano inválido." };
  if (typeof p.loja_id !== "string" || !UUID.test(p.loja_id)) return { ok: false, erro: "Loja inválida." };
  if (typeof p.sku !== "string" || !SKU.test(p.sku)) return { ok: false, erro: "Informe o SKU público, sem espaços ou dados internos." };
  if (typeof p.titulo !== "string" || p.titulo.trim().length < 4 || p.titulo.length > 120 || proibidos.test(p.titulo)) return { ok: false, erro: "Título inválido ou com informação interna." };
  if (typeof p.marca !== "string" || p.marca.length > 80 || proibidos.test(p.marca)) return { ok: false, erro: "Marca inválida." };
  if (!FORMATOS_VIDEO.some(f => f.id === p.formato)) return { ok: false, erro: "Formato inválido." };
  if (!Number.isInteger(p.segundos_por_foto) || (p.segundos_por_foto as number) < 2 || (p.segundos_por_foto as number) > 5) return { ok: false, erro: "Duração por foto deve ser de 2 a 5 segundos." };
  if (!Array.isArray(p.fotos) || p.fotos.length < 1 || p.fotos.length > 4) return { ok: false, erro: "Selecione de 1 a 4 fotos." };
  const fotos: FotoVideo[] = []; const nomes = new Set<string>();
  for (const f of p.fotos) {
    if (!f || typeof f !== "object" || Array.isArray(f)) return { ok: false, erro: "Foto inválida." };
    const foto = f as Record<string, unknown>;
    if (typeof foto.nome !== "string" || foto.nome.length > 150 || foto.nome === "." || foto.nome === ".." ||
        !NOME.test(foto.nome) || foto.nome.startsWith(".") || typeof foto.sha256 !== "string" || !SHA.test(foto.sha256) ||
        !Number.isSafeInteger(foto.bytes) || (foto.bytes as number) < 100 || (foto.bytes as number) > 20_000_000) {
      return { ok: false, erro: "Foto exige nome de arquivo simples, hash SHA-256 e tamanho válido." };
    }
    if (nomes.has(foto.nome.toLowerCase())) return { ok: false, erro: "Nomes de fotos repetidos." };
    nomes.add(foto.nome.toLowerCase());
    fotos.push({ nome: foto.nome, sha256: foto.sha256.toLowerCase(), bytes: foto.bytes as number });
  }
  return { ok: true, plano: {
    versao: 1, tipo: "nano-video-local", loja_id: p.loja_id, sku: p.sku, titulo: p.titulo.trim(),
    marca: p.marca.trim(), formato: p.formato as FormatoVideo,
    segundos_por_foto: p.segundos_por_foto as number, fotos, aprovacao: "pendente",
  } };
}
export function montarPlanoVideo(o: Omit<PlanoVideo, "versao" | "tipo" | "aprovacao">) {
  return validarPlanoVideo({ ...o, tipo: "nano-video-local", versao: 1, aprovacao: "pendente" });
}
export function nomePlanoVideo(sku: string): string {
  return "nano-video-" + (SKU.test(sku) ? sku : "revisar") + ".json";
}
