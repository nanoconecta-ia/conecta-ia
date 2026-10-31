import type { Item } from "./navegacao.ts";
const iniciais = ["/", "/catalogo", "/assistente"];
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Preferências locais não dão acesso a módulos ocultos; a lista permitida é a fonte de verdade. */
export function lerFavoritos(armazenado: string | null, disponiveis: string[]): string[] {
  if (!armazenado) return iniciais.filter((s) => disponiveis.includes(s));
  try {
    const valor: unknown = JSON.parse(armazenado);
    return Array.isArray(valor)
      ? [...new Set(valor.filter((x): x is string => typeof x === "string" && disponiveis.includes(x)))].slice(0, 12)
      : [];
  } catch { return iniciais.filter((s) => disponiveis.includes(s)); }
}
export function buscarFerramentas(itens: Item[], termo: string): Item[] {
  const q = normalizar(termo.trim());
  return !q ? itens : itens.filter(([, titulo]) => normalizar(titulo).includes(q));
}
