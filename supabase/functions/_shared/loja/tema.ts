// Tema da loja pública (cores, fonte, logo e ícone). Lógica pura: o servidor valida contraste (WCAG AA) e imagem; o navegador só aplica.
export const HEX_RE = /^#[0-9a-f]{6}$/;
export const FONTES = ["inter", "sistema", "serifada"] as const; // todas sem carregar nada de terceiros (Inter vem junto do código)
export type Fonte = typeof FONTES[number];
export const PILHA_FONTE: Record<Fonte, string> = {
  inter: '"Inter Variable",Inter,system-ui,sans-serif',
  sistema: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  serifada: 'Georgia,"Times New Roman",serif',
};

export interface Cores { primaria: string; destaque: string; bloco: string }
export const PERFIS: Record<string, { nome: string } & Cores> = {
  azul_conecta: { nome: "Azul Conecta (padrão)", primaria: "#0864a0", destaque: "#04a88d", bloco: "#102335" },
  grafite_laranja: { nome: "Grafite e laranja", primaria: "#b34700", destaque: "#ff8a1f", bloco: "#1f2933" },
  verde_floresta: { nome: "Verde floresta", primaria: "#1b6b3a", destaque: "#f2b01e", bloco: "#0f2a1a" },
  vinho: { nome: "Vinho", primaria: "#8e1b3a", destaque: "#e0a526", bloco: "#2a0f18" },
};

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** Razão de contraste WCAG entre duas cores hex (#rrggbb). */
export function contraste(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const BRANCO = "#ffffff", ESCURO = "#102335";
/** Cor de texto (branco ou escuro) com melhor contraste sobre o fundo dado. */
export const textoSobre = (fundo: string) => (contraste(BRANCO, fundo) >= contraste(ESCURO, fundo) ? BRANCO : ESCURO);

/** Escurece em `f` (0..1) para o estado de hover. */
export function escurecer(hex: string, f = 0.18): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export type Validacao = { ok: true; cores: Cores } | { ok: false; erro: string };
/** Aceita só #rrggbb; exige AA (4,5:1) para o texto de cada superfície. */
export function validarCores(c: Partial<Cores>): Validacao {
  for (const k of ["primaria", "destaque", "bloco"] as const) {
    const v = typeof c[k] === "string" ? c[k]!.toLowerCase() : "";
    if (!HEX_RE.test(v)) return { ok: false, erro: "Use cores no formato #rrggbb." };
    c[k] = v;
  }
  const x = c as Cores;
  if (contraste(BRANCO, x.primaria) < 4.5) return { ok: false, erro: "A cor primária é clara demais: o texto branco dos botões ficaria ilegível. Escolha uma cor mais escura." };
  if (contraste(textoSobre(x.destaque), x.destaque) < 4.5) return { ok: false, erro: "A cor de destaque não tem contraste suficiente com texto claro nem escuro. Escolha outra." };
  if (contraste(BRANCO, x.bloco) < 4.5) return { ok: false, erro: "A cor do bloco de abertura é clara demais para o texto branco. Escolha uma cor mais escura." };
  return { ok: true, cores: x };
}

export type TipoImagem = "png" | "webp" | "jpeg";
/** Tipo pelos primeiros bytes (não confia no nome nem no mime enviado). SVG é recusado de propósito (pode carregar script). */
export function tipoImagem(b: Uint8Array): TipoImagem | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  return null;
}
export const LIMITE_IMAGEM_BYTES = 512 * 1024;
export const MIME: Record<TipoImagem, string> = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" };

/** Variáveis CSS que a loja pública aplica (calculadas aqui para o navegador não decidir contraste). */
export function variaveisCss(c: Cores, fonte: Fonte): Record<string, string> {
  return {
    "--marca": c.primaria, "--marca-forte": escurecer(c.primaria), "--marca-texto": textoSobre(c.primaria),
    "--verde": c.destaque, "--verde-texto": textoSobre(c.destaque), "--grafite": c.bloco, "--fonte": PILHA_FONTE[fonte], "--titulo": PILHA_FONTE[fonte],
  };
}
