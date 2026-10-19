// Markdown mínimo e SEGURO para as respostas do agente: devolve uma árvore (AST) que o React renderiza como elementos.
// Nunca produz HTML cru: texto vai sempre como texto; links só http/https/mailto; imagens e HTML embutido não são suportados.
export type Inline =
  | { t: "texto"; v: string } | { t: "negrito"; c: Inline[] } | { t: "italico"; c: Inline[] }
  | { t: "codigo"; v: string } | { t: "link"; href: string; c: Inline[] };
export type Bloco =
  | { t: "p"; c: Inline[] } | { t: "h"; n: 1 | 2 | 3 | 4; c: Inline[] }
  | { t: "ul"; itens: Inline[][] } | { t: "ol"; itens: Inline[][] }
  | { t: "tabela"; cab: Inline[][]; linhas: Inline[][][] }
  | { t: "codigo"; v: string } | { t: "citacao"; c: Inline[] } | { t: "hr" };

/** Só esquemas seguros. Qualquer outra coisa (javascript:, data:, vbscript:…) vira texto simples. */
export function urlSegura(u: string): string | null {
  const s = u.trim();
  if (/^[\s\x00-\x1f]*(javascript|data|vbscript|file):/i.test(s)) return null;
  try {
    const url = new URL(s);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function inline(s: string, prof = 0): Inline[] {
  const saida: Inline[] = [];
  let buf = "";
  const solta = () => { if (buf) { saida.push({ t: "texto", v: buf }); buf = ""; } };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length && /[\\`*_\[\]()]/.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
    if (c === "`") {
      const f = s.indexOf("`", i + 1);
      if (f > i + 1) { solta(); saida.push({ t: "codigo", v: s.slice(i + 1, f) }); i = f + 1; continue; }
    }
    if (prof < 4 && c === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(s.slice(i));
      if (m) {
        const href = urlSegura(m[2]);
        solta();
        if (href) saida.push({ t: "link", href, c: inline(m[1], prof + 1) }); else saida.push({ t: "texto", v: m[1] });
        i += m[0].length; continue;
      }
    }
    if (prof < 4 && (s.startsWith("**", i) || s.startsWith("__", i))) {
      const f = s.indexOf(s.slice(i, i + 2), i + 2);
      if (f > i + 2) { solta(); saida.push({ t: "negrito", c: inline(s.slice(i + 2, f), prof + 1) }); i = f + 2; continue; }
    }
    if (prof < 4 && (c === "*" || c === "_") && s[i + 1] !== " ") {
      const f = s.indexOf(c, i + 1);
      if (f > i + 1 && s[f - 1] !== " " && !(c === "_" && /\w/.test(s[f + 1] ?? ""))) { solta(); saida.push({ t: "italico", c: inline(s.slice(i + 1, f), prof + 1) }); i = f + 1; continue; }
    }
    buf += c; i++;
  }
  solta();
  return saida;
}

const celulas = (linha: string) => linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const ehSeparador = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");

export function markdown(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (l.trim() === "") { i++; continue; }
    if (/^```/.test(l)) {
      const cod: string[] = []; i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) cod.push(linhas[i++]);
      i++; blocos.push({ t: "codigo", v: cod.join("\n") }); continue;
    }
    const h = /^(#{1,4})\s+(.+)$/.exec(l);
    if (h) { blocos.push({ t: "h", n: h[1].length as 1 | 2 | 3 | 4, c: inline(h[2]) }); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { blocos.push({ t: "hr" }); i++; continue; }
    if (l.includes("|") && i + 1 < linhas.length && ehSeparador(linhas[i + 1])) {
      const cab = celulas(l).map((c) => inline(c)); i += 2;
      const rows: Inline[][][] = [];
      while (i < linhas.length && linhas[i].includes("|") && linhas[i].trim() !== "") rows.push(celulas(linhas[i++]).map((c) => inline(c)));
      blocos.push({ t: "tabela", cab, linhas: rows }); continue;
    }
    if (/^\s*[-*•]\s+/.test(l)) {
      const itens: Inline[][] = [];
      while (i < linhas.length && /^\s*[-*•]\s+/.test(linhas[i])) itens.push(inline(linhas[i++].replace(/^\s*[-*•]\s+/, "")));
      blocos.push({ t: "ul", itens }); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const itens: Inline[][] = [];
      while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(inline(linhas[i++].replace(/^\s*\d+[.)]\s+/, "")));
      blocos.push({ t: "ol", itens }); continue;
    }
    if (/^>\s?/.test(l)) {
      const q: string[] = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) q.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push({ t: "citacao", c: inline(q.join(" ")) }); continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() !== "" && !/^(```|#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|>)/.test(linhas[i]) && !(linhas[i].includes("|") && ehSeparador(linhas[i + 1] ?? ""))) par.push(linhas[i++]);
    if (!par.length) { par.push(linhas[i++]); }
    blocos.push({ t: "p", c: inline(par.join(" ")) });
  }
  return blocos;
}
