// Ficha VERIFICADA (PR #242, requisito 7 e teste de aceite 9): campos propostos, confirmados, divergências, fontes e pendências, SEM custo, fornecedor, fiscal,
// credencial nem dado pessoal. Pura. Serve ao fallback sem IA (mostra só dado real e verificado) e a qualquer saída pública.
// O QUE PROVA: o texto/objeto devolvido não contém chave sensível (em qualquer nível) nem número de CNPJ/CPF/e-mail/telefone/token no texto, e diz o que NÃO foi feito.
// O QUE NÃO PROVA: que o dado confirmado é verdadeiro (isso é a evidência + a aprovação humana).
import { validarEvidencia, type EvidenciaBusca } from "./evidencia.ts";

const CHAVE_SENSIVEL = /^(custo|preco_?custo|preco_?compra|precocusto|precocompra|compra|fornecedor\w*|margem|lucro|ncm|cest|cfop|cst|csosn|tributacao|icms|ipi|pis|cofins|cnpj|cpf|senha|token|chave|api_?key|secret\w*|email|e_?mail|telefone|celular|whatsapp)$/i;
const TEXTO_SENSIVEL: [RegExp, string][] = [
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ removido]"], [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF removido]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail removido]"], [/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, "[telefone removido]"],
  [/\b(sk|sbp|ghp|AIza)[-_A-Za-z0-9]{16,}\b/g, "[credencial removida]"],
];

/** Remove chaves sensíveis em qualquer nível e mascara números sensíveis em textos. Devolve o que removeu (para auditoria), nunca o valor. */
export function higienizar<T>(v: T, removidos: Set<string> = new Set(), caminho = ""): T {
  if (typeof v === "string") return TEXTO_SENSIVEL.reduce((t, [re, no]) => { const n = t.replace(re, no); if (n !== t) removidos.add(`${caminho || "texto"}:padrao`); return n; }, v) as unknown as T;
  if (Array.isArray(v)) return v.map((x, i) => higienizar(x, removidos, `${caminho}[${i}]`)) as unknown as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (CHAVE_SENSIVEL.test(k)) { removidos.add(`${caminho}${caminho ? "." : ""}${k}`); continue; }
      o[k] = higienizar(x, removidos, `${caminho}${caminho ? "." : ""}${k}`);
    }
    return o as T;
  }
  return v;
}

export interface Divergencia { campo: string; valores: string[]; fontes: string[] }
export interface EntradaFicha {
  sku: string; confirmados: Record<string, unknown>; propostos: Record<string, unknown>; divergencias: Divergencia[]; evidencias: EvidenciaBusca[]; pendencias: string[];
  /** Códigos que provam a identidade do produto (para marcar cada evidência como válida ou não). */
  codigos: string[]; hoje: string;
}
export interface FichaVerificada {
  sku: string; confirmados: Record<string, unknown>; propostos: Record<string, unknown>; divergencias: Divergencia[]; pendencias: string[];
  fontes: { url: string; coletada_em: string; codigo: string; nivel: string; classe: string }[]; removidos_por_seguranca: string[]; texto: string;
}

export function montarFichaVerificada(e: EntradaFicha): FichaVerificada {
  const rem = new Set<string>();
  const confirmados = higienizar(e.confirmados, rem, "confirmados"), propostos = higienizar(e.propostos, rem, "propostos");
  const divergencias = higienizar(e.divergencias, rem, "divergencias"), pendencias = higienizar(e.pendencias, rem, "pendencias");
  const fontes = e.evidencias.map((ev) => ({ url: ev.url, coletada_em: ev.coletada_em.slice(0, 10), codigo: ev.codigo_exato, nivel: validarEvidencia(ev, { codigos: e.codigos }, e.hoje).nivel, classe: ev.classe }));
  const lista = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  const linhas = [
    `FICHA VERIFICADA — SKU ${e.sku} (sem inteligência artificial)`,
    "CONFIRMADOS (com fonte e aprovação):", ...(Object.keys(confirmados).length ? lista(confirmados) : ["- nenhum"]),
    "PROPOSTOS (aguardam aprovação humana):", ...(Object.keys(propostos).length ? lista(propostos) : ["- nenhum"]),
    "DIVERGÊNCIAS (mostradas, não resolvidas por palpite):", ...(divergencias.length ? divergencias.map((d) => `- ${d.campo}: ${d.valores.join(" x ")} (${d.fontes.join(", ")})`) : ["- nenhuma"]),
    "FONTES:", ...(fontes.length ? fontes.map((f) => `- ${f.url} · código ${f.codigo} · ${f.coletada_em} · ${f.nivel} (${f.classe})`) : ["- nenhuma"]),
    "PENDÊNCIAS:", ...(pendencias.length ? pendencias.map((p) => `- ${p}`) : ["- nenhuma"]),
    "NADA FOI GRAVADO NO BLING, ALTERADO NO FISCAL, APROVADO OU PUBLICADO.",
  ];
  return { sku: e.sku, confirmados, propostos, divergencias, pendencias, fontes, removidos_por_seguranca: [...rem].sort(), texto: higienizar(linhas.join("\n")) };
}
