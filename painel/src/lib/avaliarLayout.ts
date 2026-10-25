// Avaliação do layout da tela atual feita no navegador, só leitura (não altera a tela nem envia nada). `coletar` mede o DOM; `avaliar` é pura e testável.
export interface Instantaneo {
  largura: number; rolagemHorizontal: boolean; alvosPequenos: number; exemplosAlvos: string[]; imagensSemAlt: number; botoesSemNome: number;
  camposSemRotulo: number; h1: number; saltoDeTitulo: boolean; textoPequeno: number; foraDaTela: number; titulo: string;
}
export interface Achado { gravidade: "alta" | "media" | "baixa"; texto: string }
export interface Avaliacao { nota: number; achados: Achado[]; resumo: string }

export function avaliar(i: Instantaneo): Avaliacao {
  const a: Achado[] = [];
  if (i.rolagemHorizontal) a.push({ gravidade: "alta", texto: `A tela rola na horizontal em ${i.largura} px: algum elemento passa da largura. No celular isso esconde conteúdo.` });
  if (i.foraDaTela > 0) a.push({ gravidade: "alta", texto: `${i.foraDaTela} elemento(s) ficam parcialmente fora da tela.` });
  if (i.alvosPequenos > 0) a.push({ gravidade: i.largura < 600 ? "alta" : "media", texto: `${i.alvosPequenos} botão(ões)/link(s) menores que 40 px de toque${i.exemplosAlvos.length ? ` (ex.: ${i.exemplosAlvos.slice(0, 3).join(", ")})` : ""}. Em smartphone são difíceis de acertar.` });
  if (i.botoesSemNome > 0) a.push({ gravidade: "media", texto: `${i.botoesSemNome} botão(ões) sem texto nem nome acessível (leitores de tela não sabem o que fazem).` });
  if (i.camposSemRotulo > 0) a.push({ gravidade: "media", texto: `${i.camposSemRotulo} campo(s) de formulário sem rótulo.` });
  if (i.imagensSemAlt > 0) a.push({ gravidade: "baixa", texto: `${i.imagensSemAlt} imagem(ns) sem texto alternativo.` });
  if (i.h1 === 0) a.push({ gravidade: "baixa", texto: "A tela não tem um título principal (h1)." });
  if (i.h1 > 1) a.push({ gravidade: "baixa", texto: `A tela tem ${i.h1} títulos principais (h1); o ideal é um só.` });
  if (i.saltoDeTitulo) a.push({ gravidade: "baixa", texto: "A hierarquia de títulos pula níveis (por exemplo, de h1 direto para h3)." });
  if (i.textoPequeno > 0) a.push({ gravidade: i.largura < 600 ? "media" : "baixa", texto: `${i.textoPequeno} trecho(s) com letra menor que 12 px.` });
  const peso = { alta: 25, media: 12, baixa: 5 };
  const nota = Math.max(0, 100 - a.reduce((s, x) => s + peso[x.gravidade], 0));
  const resumo = a.length === 0
    ? `Layout de "${i.titulo}" a ${i.largura} px: não encontrei problemas nas verificações automáticas (rolagem lateral, toque, rótulos, imagens, títulos, tamanho de letra). Isso não substitui olhar a tela.`
    : `Layout de "${i.titulo}" a ${i.largura} px: nota ${nota}/100, ${a.length} ponto(s) de atenção.\n${a.map((x) => `• [${x.gravidade}] ${x.texto}`).join("\n")}\nVerificações automáticas: não avaliam beleza nem contraste de cor; confira visualmente.`;
  return { nota, achados: a, resumo };
}

const visivel = (e: Element, w: Window) => { const r = e.getBoundingClientRect(); const s = w.getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
const nomeCurto = (e: Element) => (e.getAttribute("aria-label") || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 24);

/** Mede a área principal (nunca o próprio painel do agente). */
export function coletar(janela: Window = window): Instantaneo {
  const doc = janela.document;
  const raiz: ParentNode = doc.querySelector("main") ?? doc.body;
  const dentro = (e: Element) => !e.closest("#dock-agente, .balao-genesis, [hidden]");
  const todos = (sel: string) => Array.from(raiz.querySelectorAll(sel)).filter((e) => dentro(e) && visivel(e, janela));
  const alvos = todos("button, a[href], [role=button], input:not([type=hidden]), select").filter((e) => { const r = e.getBoundingClientRect(); return r.height < 40 || r.width < 40; });
  const nivel = todos("h1,h2,h3,h4,h5,h6").map((h) => Number(h.tagName[1]));
  const saltos = nivel.some((n, k) => k > 0 && n - nivel[k - 1] > 1);
  const L = janela.innerWidth;
  return {
    largura: L, rolagemHorizontal: doc.documentElement.scrollWidth > L + 1,
    alvosPequenos: alvos.length, exemplosAlvos: alvos.slice(0, 3).map(nomeCurto),
    imagensSemAlt: todos("img").filter((e) => !e.hasAttribute("alt")).length,
    botoesSemNome: todos("button").filter((e) => !(e.textContent ?? "").trim() && !e.getAttribute("aria-label") && !e.getAttribute("title")).length,
    camposSemRotulo: todos("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea").filter((e) => !e.getAttribute("aria-label") && !e.closest("label") && !(e.id && doc.querySelector(`label[for="${e.id}"]`))).length,
    h1: todos("h1").length, saltoDeTitulo: saltos,
    textoPequeno: todos("p, span, small, li, td, label").filter((e) => (e.textContent ?? "").trim() && parseFloat(janela.getComputedStyle(e).fontSize) < 12).length,
    foraDaTela: todos("*").filter((e) => { const r = e.getBoundingClientRect(); return r.right > L + 2 && !e.closest("[style*='overflow'], .v-categorias"); }).length,
    titulo: (raiz.querySelector("h1")?.textContent ?? doc.title ?? "tela").trim().slice(0, 60) || "tela",
  };
}
