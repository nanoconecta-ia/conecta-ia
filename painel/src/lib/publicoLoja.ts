/** Referências públicas da loja piloto; nunca reutilizar contatos em outros tenants. */
export const MOBIS = {
  slug: "mobis",
  site: "https://mobisautopecas.com.br",
  nome: "Mobis Autopeças",
  razao: "Mobis Distribuidora de Peças e Acessórios Ltda.",
  cnpj: "19.903.967/0001-01",
  endereco: "Av. T-9, 3492 — Jardim América, Goiânia - GO, CEP 74255-220",
  mapas: "https://www.google.com/maps/search/?api=1&query=Av.%20T-9%2C%203492%2C%20Jardim%20Am%C3%A9rica%2C%20Goi%C3%A2nia%20GO",
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
