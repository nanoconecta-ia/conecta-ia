// "1 pique / 2 piques" (PR #242; teste de aceite 5). São marcações físicas cuja função varia por fabricante e por junta: a ESPESSURA só sai de uma TABELA TÉCNICA
// específica (fabricante + produto + fonte). Sem tabela, ou com piques fora dela, a espessura fica PENDENTE. Nunca se infere "2 piques = mais grosso".
export interface TabelaPiques { fabricante: string; produto: string; fonte_url: string; linhas: { piques: number; espessura_mm: number }[] }
export type ResultadoPiques = { estado: "determinada"; espessura_mm: number; fonte_url: string } | { estado: "pendente"; motivo: string };
const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function espessuraPorPiques(piques: number, alvo: { fabricante: string; produto: string }, tabela?: TabelaPiques | null): ResultadoPiques {
  if (!Number.isInteger(piques) || piques < 0 || piques > 9) return { estado: "pendente", motivo: "quantidade de piques inválida" };
  if (!tabela) return { estado: "pendente", motivo: "sem tabela técnica deste fabricante e desta junta: espessura pendente (não inferida)" };
  if (!/^https:\/\//i.test(tabela.fonte_url ?? "")) return { estado: "pendente", motivo: "a tabela não tem fonte https" };
  if (n(tabela.fabricante) !== n(alvo.fabricante) || n(tabela.produto) !== n(alvo.produto)) return { estado: "pendente", motivo: "a tabela é de outro fabricante ou de outro produto" };
  const l = tabela.linhas.filter((x) => x.piques === piques);
  if (l.length !== 1) return { estado: "pendente", motivo: l.length ? "a tabela tem linhas conflitantes para esse número de piques" : "esse número de piques não consta na tabela" };
  if (!(l[0].espessura_mm > 0)) return { estado: "pendente", motivo: "espessura da tabela inválida" };
  return { estado: "determinada", espessura_mm: l[0].espessura_mm, fonte_url: tabela.fonte_url };
}
