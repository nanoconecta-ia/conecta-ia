// Filtros ativos da vitrine como "chips" que o cliente entende e remove com um toque. Puro e testável.
export interface FiltrosVitrine { q: string; modelo: string; motor: string; ano: string; categoria: string; tipo: string }
export type ChaveFiltro = keyof FiltrosVitrine;
export interface ChipFiltro { chave: ChaveFiltro; rotulo: string; valor: string }

/** Os filtros ligados, na ordem dos passos da tela (tipo → veículo → categoria → busca). Motor e ano dependem do modelo. */
export function chipsDeFiltro(f: FiltrosVitrine, nomeTipo: (chave: string) => string | null, nomeCategoria: (slug: string) => string | null): ChipFiltro[] {
  const out: ChipFiltro[] = [];
  if (f.tipo) out.push({ chave: "tipo", rotulo: "Tipo", valor: nomeTipo(f.tipo) ?? f.tipo });
  if (f.modelo) out.push({ chave: "modelo", rotulo: "Modelo", valor: f.modelo });
  if (f.motor) out.push({ chave: "motor", rotulo: "Motor", valor: f.motor });
  if (f.ano) out.push({ chave: "ano", rotulo: "Ano", valor: f.ano });
  if (f.categoria) out.push({ chave: "categoria", rotulo: "Peça", valor: nomeCategoria(f.categoria) ?? f.categoria });
  if (f.q) out.push({ chave: "q", rotulo: "Busca", valor: f.q });
  return out;
}

/** Ao remover um chip, o que depende dele também sai (tirar o modelo limpa motor e ano; tirar o motor limpa o ano). */
export function removerFiltro(chave: ChaveFiltro): Partial<FiltrosVitrine> {
  if (chave === "modelo") return { modelo: "", motor: "", ano: "" };
  if (chave === "motor") return { motor: "", ano: "" };
  return { [chave]: "" } as Partial<FiltrosVitrine>;
}

export function textoResultado(total: number, ativos: number): string {
  const n = total === 1 ? "1 peça encontrada" : `${total} peças encontradas`;
  return ativos > 0 ? `${n} com os filtros escolhidos` : `${n} no catálogo`;
}
