// Catálogo em formato de planilha: o que cada produto do Bling já tem no espelho e o que ainda falta.
// Só lê o que veio do ERP; não inventa nada. "Falta" = campo vazio no espelho, não é o resultado do gate de publicação.
export type LinhaPlanilha = {
  id: string;
  sku: string | null;
  nome: string | null;
  marca: string | null;
  gtin: string | null;
  peso_kg: number | null;
  descricao_curta: string | null;
  descricao_complementar: string | null;
  categoria_bling_id: string | null;
  situacao: string | null;
  taxonomia_no_id: string | null;
  imagens: number;
};

export type Filtro = "todos" | "sem_categoria" | "incompletos" | "inativos" | "sem_no";

const vazio = (v: string | null | undefined) => v == null || v.replace(/<[^>]*>/g, "").trim() === "";

/** Campos do cadastro que estão vazios no espelho, na ordem em que o lojista os conserta. */
export function camposFaltando(p: LinhaPlanilha): string[] {
  const f: string[] = [];
  if (vazio(p.marca)) f.push("marca");
  if (vazio(p.descricao_curta) && vazio(p.descricao_complementar)) f.push("descrição");
  if (vazio(p.gtin)) f.push("GTIN");
  if (p.peso_kg == null || p.peso_kg <= 0) f.push("peso");
  if (p.imagens === 0) f.push("imagem");
  return f;
}

/** Categoria padrão do Bling (produto sem categoria): vem em branco ou como a categoria que o Bling não lista. */
export const semCategoria = (p: LinhaPlanilha, idsListados: ReadonlySet<string>) =>
  p.categoria_bling_id == null || !idsListados.has(p.categoria_bling_id);

export function filtrar<T extends LinhaPlanilha>(itens: readonly T[], filtro: Filtro, idsListados: ReadonlySet<string>): T[] {
  switch (filtro) {
    case "sem_categoria": return itens.filter((p) => semCategoria(p, idsListados));
    case "incompletos": return itens.filter((p) => camposFaltando(p).length > 0);
    case "inativos": return itens.filter((p) => p.situacao !== "A");
    case "sem_no": return itens.filter((p) => p.taxonomia_no_id == null);
    default: return [...itens];
  }
}

export function contagens(itens: readonly LinhaPlanilha[], idsListados: ReadonlySet<string>): Record<Filtro, number> {
  return {
    todos: itens.length,
    sem_categoria: filtrar(itens, "sem_categoria", idsListados).length,
    incompletos: filtrar(itens, "incompletos", idsListados).length,
    inativos: filtrar(itens, "inativos", idsListados).length,
    sem_no: filtrar(itens, "sem_no", idsListados).length,
  };
}

export const ROTULO_FILTRO: Record<Filtro, string> = {
  todos: "Todos",
  sem_categoria: "Sem categoria no Bling",
  incompletos: "Com campos vazios",
  inativos: "Inativos no Bling",
  sem_no: "Sem lugar na taxonomia",
};

export const situacaoTexto = (s: string | null) => (s === "A" ? "ativo" : s === "I" ? "inativo" : s === "ausente" ? "sumiu do Bling" : "—");
