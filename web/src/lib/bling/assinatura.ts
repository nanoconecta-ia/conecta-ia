import { createHmac, timingSafeEqual } from "node:crypto";

/** Valida X-Bling-Signature-256 ("sha256=<hex>") sobre o corpo BRUTO, em tempo constante. */
export function assinaturaValida(corpoBruto: string, cabecalho: string | null, clientSecret: string): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const recebido = Buffer.from(cabecalho.slice(7), "hex");
  const esperado = createHmac("sha256", clientSecret).update(corpoBruto, "utf8").digest();
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
