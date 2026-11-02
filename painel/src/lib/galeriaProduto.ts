// Galeria de até 8 imagens do produto na ficha (PR #242). Lógica PURA de apresentação: espelha, sem copiar regra nova, o que o servidor já decide em
// supabase/functions/_shared/imagens/regras.ts (direitos, cruzamento) e o gatilho do banco (máximo 8 imagens ativas). Aprovar é decisão do LOJISTA, por imagem;
// aprovar a identidade NÃO publica: a publicação exige direitos confirmados (duas decisões separadas).
export const LIMITE_GALERIA = 8;
export type Licenca = "propria" | "fornecedor" | "fabricante" | "publica_web" | "licenciada";
export interface LinhaImagem {
  id: string; url: string; tipo: "real" | "gerada_ia" | "ilustrativa"; origem: string | null; url_original: string | null; licenca_tipo: Licenca | null;
  cruzamento_tipo: string | null; cruzamento_valor: string | null; largura_px: number | null; altura_px: number | null;
  aprovada: boolean; principal: boolean; direitos_confirmados_em: string | null; removida_em: string | null; ordem: number | null;
}
export type EstadoImagem = "aprovada" | "pendente";
export interface ResumoImagem {
  id: string; url: string; estado: EstadoImagem;
  identidade: "confere" | "nao_prova" | "sem_cruzamento";
  direitos: boolean; publicavel: boolean; principal: boolean;
  origem: string; resolucao: string; licenca: string; rotulo: string | null;
  avisos: string[];
}

const PROVAM = new Set(["sku", "ean", "oem", "fabricante"]);
export const direitosConfirmados = (l: Pick<LinhaImagem, "licenca_tipo" | "direitos_confirmados_em">) =>
  l.licenca_tipo === "propria" || l.licenca_tipo === "licenciada" || (l.licenca_tipo != null && l.direitos_confirmados_em != null);
const LICENCA: Record<Licenca, string> = { propria: "foto própria", fornecedor: "fornecedor", fabricante: "fabricante", publica_web: "web pública", licenciada: "licenciada" };

/** Host da página de origem, sem caminho (a URL de terceiros é interna e não vira link clicável aqui). */
export function hostDaOrigem(l: Pick<LinhaImagem, "url_original" | "origem" | "url">): string {
  for (const u of [l.url_original, l.url]) { try { if (u) return new URL(u).hostname.replace(/^www\./, ""); } catch { /* tenta o próximo */ } }
  return l.origem?.trim() || "origem não registrada";
}

export function resumirImagem(l: LinhaImagem): ResumoImagem {
  const avisos: string[] = [];
  const identidade = !l.cruzamento_tipo || !l.cruzamento_valor ? "sem_cruzamento" : PROVAM.has(l.cruzamento_tipo) ? "confere" : "nao_prova";
  if (identidade === "sem_cruzamento") avisos.push("sem código que prove que é esta peça");
  if (identidade === "nao_prova") avisos.push(`cruzamento "${l.cruzamento_tipo}" não prova que é a mesma peça`);
  const direitos = direitosConfirmados(l);
  if (!direitos) avisos.push("direitos de uso não confirmados: aprovar não publica");
  const menor = l.largura_px != null && l.altura_px != null ? Math.min(l.largura_px, l.altura_px) : null;
  if (menor == null) avisos.push("resolução desconhecida");
  else if (menor < 300) avisos.push(`resolução baixa (${menor}px)`);
  if (l.tipo !== "real") avisos.push(l.tipo === "gerada_ia" ? "imagem gerada por IA: só ilustração" : "imagem ilustrativa, não é foto do produto");
  const publicavel = l.aprovada && direitos && !l.removida_em && /^https:\/\//i.test(l.url) && !(l.url_original && l.url === l.url_original);
  return {
    id: l.id, url: l.url, estado: l.aprovada ? "aprovada" : "pendente", identidade, direitos, publicavel, principal: l.principal,
    origem: hostDaOrigem(l), resolucao: l.largura_px && l.altura_px ? `${l.largura_px}×${l.altura_px}` : "desconhecida",
    licenca: l.licenca_tipo ? LICENCA[l.licenca_tipo] : "desconhecida",
    rotulo: l.tipo === "real" ? null : l.tipo === "gerada_ia" ? "Imagem gerada por IA, apenas ilustração" : "Imagem ilustrativa", avisos,
  };
}

/** Ativas (não retiradas), em ordem, limitadas a 8. */
export function galeriaDaFicha(linhas: LinhaImagem[]): { itens: ResumoImagem[]; vagas: number; cheia: boolean } {
  const ativas = linhas.filter((l) => !l.removida_em).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).slice(0, LIMITE_GALERIA);
  return { itens: ativas.map(resumirImagem), vagas: Math.max(LIMITE_GALERIA - ativas.length, 0), cheia: ativas.length >= LIMITE_GALERIA };
}
export const pedidoDeImagens = (sku: string) =>
  `Busque imagens do produto ${sku} (galeria de até 8) usando o SKU, o GTIN e os códigos OEM/fabricante aprovados. Só vale a candidata cujo código aparece escrito na página de origem; ` +
  `informe fonte, resolução e licença, descarte marca d'água e peça semelhante, e não aprove nada: a aprovação é minha, imagem por imagem.`;
