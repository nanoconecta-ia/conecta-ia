// Ícone do nó da taxonomia no mapa: a MESMA função que a página Taxonomia e a Loja usam (iconeDaCategoria, pelo slug real da categoria).
// Não existe segunda tabela: assim o mapa nunca diverge do que o lojista vê em Taxonomia. O ícone é visual: não prova SKU, OEM nem aplicação.
import { iconeDaCategoria, type Peca } from "./icones.ts";

/** Só os nós `tx:` (categorias reais) e o agrupador "taxonomia" recebem desenho de peça. */
export function iconeNoMapa(id: string, rotulo: string, slug?: string | null): Peca | null {
  if (id === "taxonomia") return "todas";
  if (!id.startsWith("tx:")) return null;
  return iconeDaCategoria(slug, rotulo);
}
