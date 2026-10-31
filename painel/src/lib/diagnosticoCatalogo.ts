/** Diagnóstico leve, sem acesso ao ERP: trabalha apenas com SKUs já visíveis pela RLS da loja. */
export type DiagnosticoSku = { repetidos: number; vazios: number; analisados: number };
export function diagnosticarSkus(linhas: Array<{ sku: string | null }>): DiagnosticoSku {
  const vezes = new Map<string, number>();
  let vazios = 0;
  for (const linha of linhas) {
    const sku = (linha.sku ?? "").trim().toUpperCase();
    if (!sku) { vazios++; continue; }
    vezes.set(sku, (vezes.get(sku) ?? 0) + 1);
  }
  return { repetidos: [...vezes.values()].filter((n) => n > 1).length, vazios, analisados: linhas.length };
}

export function avisoPublicacao(publicados: number | null, produtos: number | null): string | null {
  if (produtos == null || publicados == null) return null;
  if (produtos === 0) return "O espelhamento está vazio. Confirme a sincronização antes de publicar a loja.";
  if (publicados === 0) return "Nenhum produto está publicado. Sua vitrine pode aparecer vazia para os clientes; revise cadastro, imagem, aplicação e políticas antes de publicar.";
  return null;
}
