import type { NoTaxonomia } from "./qualidadeProduto.ts";

/** Verificação estrutural, não homologação: só mostra erros; não inventa equivalência de peça. */
export interface NoTaxonomiaCompleto extends NoTaxonomia {
  pai_id: string | null; nome: string | null; slug: string | null;
}
export interface AuditoriaArvore { orfaos: string[]; ciclos: string[]; duplicados: string[]; semNome: string[] }

export function auditarArvore(nos: NoTaxonomiaCompleto[]): AuditoriaArvore {
  const porId = new Map(nos.map((n) => [n.id, n]));
  const vistos = new Map<string, string>();
  const orfaos: string[] = [], ciclos: string[] = [], duplicados: string[] = [], semNome: string[] = [];
  for (const no of nos) {
    if (!no.nome?.trim()) semNome.push(no.id);
    if (no.pai_id && !porId.has(no.pai_id)) orfaos.push(no.id);
    const chave = [no.pai_id ?? "raiz", (no.slug ?? no.nome ?? "").trim().toLocaleLowerCase("pt-BR")].join("|");
    if (chave.endsWith("|")) continue;
    if (vistos.has(chave)) duplicados.push(no.id); else vistos.set(chave, no.id);
    const visitados = new Set([no.id]);
    let atual = no.pai_id;
    while (atual && porId.has(atual)) {
      if (visitados.has(atual)) { ciclos.push(no.id); break; }
      visitados.add(atual); atual = porId.get(atual)?.pai_id ?? null;
    }
  }
  return { orfaos, ciclos, duplicados, semNome };
}
