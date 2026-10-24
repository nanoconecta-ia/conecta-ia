// SKU não é chave única (o Bling aceita o mesmo código em registros diferentes). Toda leitura por SKU pede até 2 linhas e classifica:
// uma => ok; nenhuma => não encontrado; mais de uma => ambíguo. Nunca escolhe um dos produtos; a consulta sempre é filtrada pela loja.
export type ResultadoSku<T> = { estado: "ok"; produto: T } | { estado: "ambiguo" } | { estado: "nao_encontrado" };

export function classificarSku<T>(linhas: readonly T[] | null | undefined): ResultadoSku<T> {
  const n = linhas?.length ?? 0;
  if (n === 0) return { estado: "nao_encontrado" };
  if (n > 1) return { estado: "ambiguo" };
  return { estado: "ok", produto: linhas![0] };
}

export const MSG_NAO_ENCONTRADO = "Produto não encontrado nesta loja.";
export const MSG_SKU_AMBIGUO = "Este SKU aparece em mais de um produto do Bling. Resolva a duplicidade (conflito de identidade) antes de continuar.";
/** Resposta de erro das ferramentas, com motivo estável para o agente distinguir os dois casos. */
export const erroSku = (r: { estado: "ambiguo" } | { estado: "nao_encontrado" }) =>
  r.estado === "ambiguo" ? { erro: MSG_SKU_AMBIGUO, motivo: "sku_ambiguo" } : { erro: MSG_NAO_ENCONTRADO, motivo: "nao_encontrado" };
