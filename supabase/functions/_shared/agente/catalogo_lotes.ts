/** Segurança de seleção do Catálogo: identifica só peças ativas/não pausadas.
 * Não infere OEM, não altera produto, não chama LLM. */
import type { ProdutoMin } from "./fila.ts";
export type EscopoCatalogo = "selecionados" | "todos_ativos";
export interface ProdutoParaFila extends ProdutoMin { situacao?: string | null; }
export interface EscopoEntrada { escopo: EscopoCatalogo; selecionados: readonly string[]; pausados: ReadonlySet<string>; }
export function filtrarLoteCatalogo(produtos: readonly ProdutoParaFila[], entrada: EscopoEntrada) {
  const selecionados = new Set(entrada.selecionados);
  const noEscopo = produtos.filter(p => entrada.escopo === "todos_ativos" || selecionados.has(p.id));
  const inativos = noEscopo.filter(p => p.situacao !== "A").length;
  const pausados = noEscopo.filter(p => p.situacao === "A" && entrada.pausados.has(p.id)).length;
  return {
    elegiveis: noEscopo.filter(p => p.situacao === "A" && !entrada.pausados.has(p.id)),
    noEscopo: noEscopo.length,
    inativos, pausados,
    naoEncontrados: entrada.escopo === "selecionados"
      ? [...selecionados].filter(id => !noEscopo.some(p => p.id === id)).length : 0,
  };
}
export function validarSelecaoCatalogo(escopo: unknown, ids: unknown): string | null {
  if (escopo !== "selecionados" && escopo !== "todos_ativos") return "Escopo de enriquecimento inválido.";
  if (escopo === "todos_ativos") return ids != null && (!Array.isArray(ids) || ids.length !== 0)
    ? "O modo todos ativos não aceita IDs de seleção." : null;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) return "Selecione entre 1 e 100 produtos.";
  if (ids.some(x => typeof x !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(x)))
    return "Identificador de produto inválido.";
  if (new Set(ids).size !== ids.length) return "Seleção contém produtos duplicados.";
  return null;
}
