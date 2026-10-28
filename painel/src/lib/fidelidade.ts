// Nano Visual Fidelity: regras puras da tela "Imagens e SEO". Nada sobe para servidor: a foto fica no navegador, o SHA-256 é calculado aqui.
// "Melhorada" é uma SIMULAÇÃO por filtro de CSS (luz e enquadramento): não remove fundo, não redesenha, não toca na peça.

export type ModoFidelidade = "desligado" | "manual" | "automatico_restrito";
export type Recurso = "fotos" | "banners" | "veiculos" | "sugestoes_site";
export type Config = { modo: ModoFidelidade; recursos: Record<Recurso, boolean> };

export const MODOS: { valor: ModoFidelidade; rotulo: string; descricao: string; disponivel: boolean; motivo?: string }[] = [
  { valor: "desligado", rotulo: "Desligado", descricao: "Nenhuma transformação de imagem.", disponivel: true },
  { valor: "manual", rotulo: "Manual (padrão)", descricao: "Mostra a prévia e solicita a sua aprovação.", disponivel: true },
  { valor: "automatico_restrito", rotulo: "Automático restrito", descricao: "Somente ajustes visuais já aprovados.", disponivel: false, motivo: "Ainda não há registro de ajustes aprovados para reaproveitar." },
];
export const RECURSOS: { chave: Recurso; rotulo: string; disponivel: boolean; motivo?: string }[] = [
  { chave: "fotos", rotulo: "Melhorar apresentação das fotografias", disponivel: true },
  { chave: "banners", rotulo: "Preparar banners comerciais", disponivel: true },
  { chave: "veiculos", rotulo: "Exibir imagens dos veículos compatíveis", disponivel: false, motivo: "Só com aplicação documentada (fonte, página e SKU)." },
  { chave: "sugestoes_site", rotulo: "Sugestões visuais no site", disponivel: false, motivo: "Depende de publicação autorizada, que esta tela não faz." },
];
export const CONFIG_PADRAO: Config = { modo: "manual", recursos: { fotos: true, banners: true, veiculos: false, sugestoes_site: false } };
const CHAVE = "conecta:fidelidade";

/** Lê a configuração guardada neste aparelho; qualquer coisa fora do esperado volta ao padrão. Recursos indisponíveis nunca ficam ligados. */
export function lerConfig(armazem: Pick<Storage, "getItem"> | null): Config {
  try {
    const bruto = armazem?.getItem(CHAVE);
    if (!bruto) return CONFIG_PADRAO;
    const o = JSON.parse(bruto) as { modo?: unknown; recursos?: Record<string, unknown> };
    const modo = MODOS.find((m) => m.valor === o.modo && m.disponivel)?.valor ?? CONFIG_PADRAO.modo;
    const recursos = { ...CONFIG_PADRAO.recursos };
    for (const r of RECURSOS) recursos[r.chave] = r.disponivel && typeof o.recursos?.[r.chave] === "boolean" ? (o.recursos[r.chave] as boolean) : CONFIG_PADRAO.recursos[r.chave];
    return { modo, recursos };
  } catch { return CONFIG_PADRAO; }
}
export function gravarConfig(armazem: Pick<Storage, "setItem"> | null, c: Config): void {
  try { armazem?.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem storage: vale só nesta sessão */ }
}
/** Ferramenta de comparação disponível? Desligado ou recurso desligado esconde a transformação. */
export const comparadorLigado = (c: Config) => c.modo !== "desligado" && c.recursos.fotos;
export const bannerLigado = (c: Config) => c.modo !== "desligado" && c.recursos.banners;

/** Filtro de CSS da "melhorada": só luz e cor, valores fixos e conhecidos (nada de blur/máscara, que mexeria na geometria). */
export const FILTRO_MELHORADA = "brightness(1.05) contrast(1.08) saturate(1.04)";

/** Checagens humanas obrigatórias antes de aprovar o uso interno. */
export const CHECAGENS = [
  "Furos, bordas e proporções iguais ao original",
  "Conectores e encaixes iguais",
  "Inscrições, marcas e gravações legíveis e iguais",
] as const;
export const podeAprovar = (marcadas: readonly boolean[]) => marcadas.length === CHECAGENS.length && marcadas.every(Boolean);

export type Formato = { id: string; rotulo: string; w: number; h: number };
export const FORMATOS_BANNER: Formato[] = [
  { id: "16:9", rotulo: "16:9", w: 16, h: 9 },
  { id: "4:5", rotulo: "4:5", w: 4, h: 5 },
  { id: "1:1", rotulo: "1:1", w: 1, h: 1 },
];

/** Ponto de interesse (0–100 %) a partir de um clique: vira o centro do zoom. Fora do quadro é recortado. */
export function pontoDoClique(x: number, y: number, w: number, h: number): { x: number; y: number } {
  if (!(w > 0) || !(h > 0)) return { x: 50, y: 50 };
  const c = (v: number) => Math.min(100, Math.max(0, v));
  return { x: c((x / w) * 100), y: c((y / h) * 100) };
}
export const limitarZoom = (z: number) => (Number.isFinite(z) ? Math.min(4, Math.max(1, z)) : 1);

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const TAMANHO_MAXIMO = 15 * 1024 * 1024;
export function validarArquivo(a: { type: string; size: number }): string | null {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(a.type)) return "Use uma foto JPG, PNG ou WebP.";
  if (a.size > TAMANHO_MAXIMO) return "A foto passa de 15 MB.";
  if (a.size === 0) return "O arquivo está vazio.";
  return null;
}

export async function sha256Hex(dados: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
