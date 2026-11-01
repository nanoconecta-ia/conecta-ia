// Gerador dos PERFIS DE COR do painel e da esfera do Nano.IA. Uma definição por perfil (matiz e saturação, ou um neutro) gera os tokens do painel
// (acento, cabeçalho, superfícies dos neutros) E as cores da esfera, a partir das mesmas variáveis: por isso layout e esfera nunca divergem.
// O CSS (painel/src/perfis-cor.css) é gerado daqui; o teste confere que o arquivo bate com o gerador e que cada perfil passa no contraste (WCAG AA)
// em cada tema. Alto contraste fica de fora de propósito: ele nunca é alterado por perfil.
import { razao } from "./contraste.ts";

export interface Perfil { id: string; rotulo: string; descricao: string; h: number; c: number; neutro?: "cinza" | "chumbo" | "branco"; hb?: number }
/** terracota é o padrão atual do painel (sem atributo); os demais escrevem data-cor na raiz. */
export const PERFIS: Perfil[] = [
  { id: "terracota", rotulo: "Terracota", descricao: "Padrão do Conecta.IA", h: 40, c: 0.14, hb: 80 },
  { id: "vermelho", rotulo: "Vermelho", descricao: "Acento vermelho", h: 25, c: 0.19, hb: 350 },
  { id: "pardo", rotulo: "Pardo", descricao: "Marrom terroso", h: 62, c: 0.075, hb: 85 },
  { id: "ambar", rotulo: "Âmbar", descricao: "Dourado e ocre", h: 82, c: 0.14, hb: 45 },
  { id: "verde", rotulo: "Verde", descricao: "Verde folha", h: 150, c: 0.14, hb: 195 },
  { id: "turquesa", rotulo: "Turquesa", descricao: "Azul-esverdeado", h: 195, c: 0.105, hb: 250 },
  { id: "azul", rotulo: "Azul", descricao: "Azul real", h: 255, c: 0.17, hb: 295 },
  { id: "roxo", rotulo: "Roxo", descricao: "Violeta", h: 295, c: 0.18, hb: 345 },
  { id: "rosa", rotulo: "Rosa", descricao: "Rosa choque", h: 350, c: 0.18, hb: 20 },
  { id: "cristal", rotulo: "Cristal", descricao: "Azul e magenta, como a esfera de vidro", h: 270, c: 0.19, hb: 335 },
  { id: "cinza", rotulo: "Cinza", descricao: "Neutro, sem cor", h: 250, c: 0.005, neutro: "cinza" },
  { id: "chumbo", rotulo: "Chumbo", descricao: "Cinza-azulado escuro", h: 255, c: 0.025, neutro: "chumbo" },
  { id: "branco", rotulo: "Branco", descricao: "Superfícies brancas e acento grafite", h: 250, c: 0.003, neutro: "branco" },
];
export const PADRAO = "terracota";

// ── Conversão OKLCH → sRGB (com redução de saturação até caber no gamut)
const lin = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
function rgbDe(L: number, C: number, h: number): [number, number, number] | null {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const ok = [r, g, bb].every((v) => v >= -0.0005 && v <= 1.0005);
  return ok ? [r, g, bb].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number] : null;
}
export function hex(L: number, C: number, h: number): string {
  let c = C, rgb = rgbDe(L, c, h);
  while (!rgb && c > 0) { c = Math.max(0, c - 0.005); rgb = rgbDe(L, c, h); }
  const [r, g, b] = (rgb ?? [L, L, L]).map((v) => Math.round(Math.min(1, Math.max(0, lin(v))) * 255));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

// Superfícies de referência dos temas (as mesmas de styles.css): o acento é ajustado para passar no contraste sobre elas.
const CLARO = { fundo: "#F6F3EC", cartao: "#FBF9F4", realce: "#EFEBE1" }, ESCURO = { fundo: "#1B1916", cartao: "#24211D", realce: "#2B2823" };
const BRANCO_TEXTO = "#FFFFFF", ESCURO_TEXTO = "#14110F";

/** Primeiro L (andando de `de` para `ate`) em que a condição passa. */
function achar(de: number, ate: number, passo: number, ok: (L: number) => boolean): number {
  const dir = ate > de ? 1 : -1;
  for (let L = de; dir > 0 ? L <= ate + 1e-9 : L >= ate - 1e-9; L += dir * passo) if (ok(L)) return L;
  return ate;
}

export interface Tokens { [k: string]: string }
export interface Gerado { claro: Tokens; escuro: Tokens; orbe: Tokens; topo: Tokens; superficieClara?: Tokens; superficieEscura?: Tokens; amostra: string }

export function gerar(p: Perfil): Gerado {
  const neutro = p.neutro;
  let claro: Tokens, escuro: Tokens;
  if (neutro === "branco") {
    claro = { "--marca": "#2B2B2E", "--marca-forte": "#101012", "--marca-texto": BRANCO_TEXTO, "--grafite": "#1D1D1F", "--grafite-2": "#2A2A2D" };
    escuro = { "--marca": "#F2F2F4", "--marca-forte": "#FFFFFF", "--marca-texto": ESCURO_TEXTO, "--grafite": "#101012", "--grafite-2": "#1B1B1D" };
  } else {
    const c = p.c;
    const Lc = achar(0.62, 0.3, 0.005, (L) => { const x = hex(L, c, p.h); return razao(BRANCO_TEXTO, x) >= 5 && razao(x, CLARO.cartao) >= 4.8 && razao(x, CLARO.fundo) >= 4.8 && razao(x, CLARO.realce) >= 4.5; });
    const Lcf = achar(Lc - 0.04, 0.2, 0.005, (L) => { const x = hex(L, c, p.h); return razao(x, CLARO.cartao) >= 6.5 && razao(x, CLARO.fundo) >= 6.5; });
    const Le = achar(0.66, 0.97, 0.005, (L) => { const x = hex(L, c, p.h); return razao(x, ESCURO.cartao) >= 5.2 && razao(x, ESCURO.fundo) >= 5.2 && razao(ESCURO_TEXTO, x) >= 5.2; });
    const Lef = achar(Le + 0.05, 0.98, 0.005, (L) => { const x = hex(L, c, p.h); return razao(x, ESCURO.cartao) >= 7 && razao(x, ESCURO.fundo) >= 7; });
    const ch = neutro ? Math.min(c, 0.03) : Math.min(c * 0.4, 0.05);
    claro = { "--marca": hex(Lc, c, p.h), "--marca-forte": hex(Lcf, c, p.h), "--marca-texto": BRANCO_TEXTO, "--grafite": hex(0.2, ch, p.h), "--grafite-2": hex(0.26, ch, p.h) };
    escuro = { "--marca": hex(Le, c, p.h), "--marca-forte": hex(Lef, c, p.h), "--marca-texto": ESCURO_TEXTO, "--grafite": hex(0.15, ch * 0.8, p.h), "--grafite-2": hex(0.2, ch * 0.8, p.h) };
  }
  // Esfera: as mesmas famílias de cor do layout. a = fita principal e repouso; b = luz secundária (borda inferior); m1..m3 = interior de vidro escuro.
  const hb = p.hb ?? p.h + 55, c = p.c;
  const orbe: Tokens = neutro
    ? { "--orbe-a": neutro === "branco" ? "#D9DCE3" : hex(0.74, 0.012, p.h), "--orbe-b": neutro === "branco" ? "#FFFFFF" : hex(0.9, 0.01, p.h), "--orbe-m1": hex(0.3, 0.012, p.h), "--orbe-m2": hex(0.18, 0.01, p.h), "--orbe-m3": hex(0.08, 0.006, p.h) }
    : { "--orbe-a": hex(0.64, Math.min(c * 1.25, 0.23), p.h), "--orbe-b": hex(0.74, Math.min(c * 1.3, 0.24), hb), "--orbe-m1": hex(0.3, Math.min(c * 0.7, 0.12), p.h), "--orbe-m2": hex(0.18, Math.min(c * 0.5, 0.08), p.h), "--orbe-m3": hex(0.08, Math.min(c * 0.3, 0.04), p.h) };
  // Cabeçalho e menu (sempre escuros): o mesmo perfil, em tons claros para ler sobre o grafite. -1/-2 = degradê do botão Nano.IA; -claro = textos de destaque; -rgb = brilhos translúcidos.
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",");
  const t1 = neutro ? (neutro === "branco" ? "#F2F2F4" : hex(0.82, 0.012, p.h)) : hex(0.8, Math.min(c * 0.8, 0.13), p.h);
  const t2 = neutro ? (neutro === "branco" ? "#C9CBD1" : hex(0.66, 0.012, p.h)) : hex(0.64, Math.min(c, 0.17), p.h);
  const tc = neutro ? (neutro === "branco" ? "#FFFFFF" : hex(0.86, 0.01, p.h)) : hex(0.84, Math.min(c * 0.55, 0.09), p.h);
  const topo: Tokens = { "--acento-1": t1, "--acento-2": t2, "--acento-claro": tc, "--acento-rgb": rgb(t1), "--acento-rgb-2": rgb(t2) };
  let superficieClara: Tokens | undefined, superficieEscura: Tokens | undefined;
  if (neutro === "branco") {
    superficieClara = { "--fundo": "#FFFFFF", "--cartao": "#FFFFFF", "--realce": "#F1F1F3", "--borda": "#DADADD", "--borda-forte": "#767679", "--suave": "#4F4F54", "--texto": "#111113" };
    superficieEscura = { "--fundo": "#161618", "--cartao": "#1F1F21", "--realce": "#27272A", "--borda": "#38383B", "--borda-forte": "#8E8E93", "--suave": "#B0B0B5", "--texto": "#F2F2F4" };
  } else if (neutro === "cinza") {
    superficieClara = { "--fundo": "#F1F2F3", "--cartao": "#FAFAFB", "--realce": "#E7E8EA", "--borda": "#D2D4D8", "--borda-forte": "#6F7378", "--suave": "#52555A", "--texto": "#1B1C1E" };
    superficieEscura = { "--fundo": "#1A1B1D", "--cartao": "#232427", "--realce": "#2B2D30", "--borda": "#3A3C40", "--borda-forte": "#8C9096", "--suave": "#AEB1B6", "--texto": "#EDEEF0" };
  } else if (neutro === "chumbo") {
    superficieClara = { "--fundo": "#ECEFF2", "--cartao": "#F6F8FA", "--realce": "#E1E6EB", "--borda": "#CAD2DA", "--borda-forte": "#667380", "--suave": "#4A5561", "--texto": "#171C22" };
    superficieEscura = { "--fundo": "#12171C", "--cartao": "#1B222A", "--realce": "#232C36", "--borda": "#323D49", "--borda-forte": "#8795A4", "--suave": "#A9B5C1", "--texto": "#E6EBF0" };
  }
  return { claro, escuro, orbe, topo, superficieClara, superficieEscura, amostra: claro["--marca"] };
}

/** Terracota: os valores que o cabeçalho e o menu já tinham. */
const TOPO_PADRAO: Tokens = { "--acento-1": "#F6AC78", "--acento-2": "#D76F3D", "--acento-claro": "#F7B18A", "--acento-rgb": "236,143,88", "--acento-rgb-2": "213,101,49" };
const linhas = (t: Tokens) => Object.entries(t).map(([k, v]) => `${k}:${v};`).join(" ");
const NAO_CONTRASTE = ':not([data-tema="contraste"])';

/** O CSS inteiro de perfis-cor.css. Determinístico: o teste compara o arquivo com esta saída. */
export function cssDosPerfis(): string {
  const padrao = gerar(PERFIS.find((p) => p.id === PADRAO)!);
  const o: string[] = [];
  o.push("/* GERADO por painel/src/lib/perfisCorGerador.ts: não edite à mão (o teste confere). Perfis de cor do painel e da esfera do Nano.IA. */");
  o.push("/* Variáveis da esfera no perfil padrão (terracota); os perfis abaixo as trocam, e o painel e a esfera mudam juntos. */");
  o.push(`:root { ${linhas(padrao.orbe)} ${linhas(TOPO_PADRAO)} }`);
  for (const p of PERFIS) o.push(`.amostra-cor[data-cor="${p.id}"] { background:${p.id === PADRAO ? "#AD4C29" : gerar(p).amostra}; }`); // o padrão é a cor atual do painel
  for (const p of PERFIS) {
    if (p.id === PADRAO) continue;
    const g = gerar(p);
    // Claro (todos os temas, exceto os escuros e o alto contraste): acento, cabeçalho, esfera e, nos neutros, as superfícies.
    o.push(`html[data-cor="${p.id}"]${NAO_CONTRASTE} { ${linhas({ ...g.claro, ...(g.superficieClara ?? {}), ...g.orbe, ...g.topo })} }`);
    // Escuro: temas escuro e noturno, e o automático quando o aparelho está no escuro.
    const esc = linhas({ ...g.escuro, ...(g.superficieEscura ?? {}) });
    o.push(`html[data-cor="${p.id}"][data-tema="escuro"], html[data-cor="${p.id}"][data-tema="noturno"] { ${esc} }`);
    o.push(`@media (prefers-color-scheme: dark) { html[data-cor="${p.id}"]:not([data-tema]) { ${esc} } }`);
  }
  return o.join("\n") + "\n";
}
