// Árvore da taxonomia espelhada: monta a hierarquia e soma produtos e categorias do Bling por nó (nó + descendentes).

export type No = { id: string; pai_id: string | null; nome: string; slug: string; ordem: number };
export type NoComTotais = No & { filhos: NoComTotais[]; produtos: number; categoriasBling: number };

/** Constrói a floresta. Nó com pai inexistente vira raiz (nada some). Ciclo é cortado. `produtosPorNo`/`blingPorNo` contam só o nó; o total do nó inclui descendentes. */
export function montarArvore(nos: No[], produtosPorNo: Map<string, number>, blingPorNo: Map<string, number>): NoComTotais[] {
  const ids = new Set(nos.map((n) => n.id));
  const porPai = new Map<string | null, No[]>();
  for (const n of nos) { const pai = n.pai_id && ids.has(n.pai_id) && n.pai_id !== n.id ? n.pai_id : null; porPai.set(pai, [...(porPai.get(pai) ?? []), n]); }
  const vistos = new Set<string>();
  const construir = (n: No): NoComTotais => {
    vistos.add(n.id);
    const filhos = (porPai.get(n.id) ?? []).filter((f) => !vistos.has(f.id)).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")).map(construir);
    return { ...n, filhos, produtos: (produtosPorNo.get(n.id) ?? 0) + filhos.reduce((s, f) => s + f.produtos, 0), categoriasBling: (blingPorNo.get(n.id) ?? 0) + filhos.reduce((s, f) => s + f.categoriasBling, 0) };
  };
  return (porPai.get(null) ?? []).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")).map(construir);
}

export function contar<T>(itens: T[], chave: (i: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of itens) { const k = chave(i); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

/** Caminho do nó selecionado dentro da floresta (para as colunas de navegação). Id inexistente → []. */
export function caminhoAte(raizes: NoComTotais[], id: string | null): NoComTotais[] {
  if (!id) return [];
  const busca = (lista: NoComTotais[], trilha: NoComTotais[]): NoComTotais[] | null => {
    for (const n of lista) { const t = [...trilha, n]; if (n.id === id) return t; const r = busca(n.filhos, t); if (r) return r; }
    return null;
  };
  return busca(raizes, []) ?? [];
}
