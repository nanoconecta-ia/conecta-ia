// Releitura de um produto no Bling, pedida pelo lojista no Studio. Só leitura do Bling.
// A função bling-sync lê primeiro os SKUs de `forcar_skus` e depois segue a varredura normal.

export interface CorpoReleitura { loja_id: string; forcar_skus: string[] }

/** Monta o pedido. Sem SKU válido não há releitura (null). */
export function corpoReleitura(lojaId: string, sku: string | null | undefined): CorpoReleitura | null {
  const s = typeof sku === "string" ? sku.trim() : "";
  if (!lojaId || !s || s.length > 60) return null;
  return { loja_id: lojaId, forcar_skus: [s] };
}

/** Texto para o lojista a partir da resposta da função. Não afirma o que não foi confirmado. */
export function mensagemReleitura(data: unknown): { ok: boolean; texto: string } {
  const r = (data as { resultado?: { gravados?: number; erro?: boolean }[] } | null)?.resultado?.[0];
  if (!r) return { ok: false, texto: "O servidor não confirmou a releitura. Tente de novo em alguns minutos." };
  if ((r.gravados ?? 0) < 1) return { ok: false, texto: "O Bling não devolveu este produto agora. Tente de novo em alguns minutos." };
  return { ok: true, texto: "Produto relido no Bling. Os dados abaixo foram atualizados; confira marca e descrição." };
}
