/** Referências não cadastrais da loja piloto. Dados empresariais devem vir apenas de políticas formalmente aprovadas no servidor. */
export const MOBIS = {
  slug: "mobis",
  site: "https://mobisautopecas.com.br",
  nome: "Mobis Autopeças",
} as const;

/** Nunca inserir número fora do cadastro da loja (sem cruzar empresas). */
export function linkWhatsAppPublico(numero: string | null | undefined, mensagem: string): string | null {
  let digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) digitos = "55" + digitos;
  if (!/^55\d{10,11}$/.test(digitos)) return null;
  return "https://wa.me/" + digitos + "?text=" + encodeURIComponent(mensagem.slice(0, 450));
}

export function linkWhatsAppProduto(numero: string | null | undefined, nome: string, sku: string): string | null {
  return linkWhatsAppPublico(numero, "Olá! Tenho interesse em " + nome.slice(0, 150) +
    " (cód. " + sku.slice(0, 60) + "). Pode confirmar aplicação, preço e disponibilidade?");
}
