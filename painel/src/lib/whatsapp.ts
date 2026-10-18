/** Normaliza para o formato do banco: 55 + DDD + número (12 ou 13 dígitos). Devolve null se não der. */
export function normalizarWhatsapp(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55[0-9]{10,11}$/.test(d) ? d : null;
}

/** Link wa.me com mensagem pronta (validação do contador). */
export function linkWhatsapp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
