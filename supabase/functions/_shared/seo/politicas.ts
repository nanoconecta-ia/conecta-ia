// Páginas de política que o Merchant/Google esperam encontrar (privacidade, troca/devolução, entrega, garantia, termos, contato).
// Só política APROVADA chega aqui (RLS/consulta filtram status = 'aprovada'). O texto é do lojista; o sistema não presume prazos.
import type { LojaSeo, PoliticasPublicas } from "./dados.ts";

export interface PaginaPolitica { slug: string; titulo: string; texto: string }
const campos: { slug: string; titulo: string; campo: keyof PoliticasPublicas }[] = [
  { slug: "privacidade", titulo: "Política de privacidade", campo: "privacidade_texto" },
  { slug: "troca-devolucao", titulo: "Trocas e devoluções", campo: "troca_devolucao_texto" },
  { slug: "entrega", titulo: "Entrega", campo: "entrega_texto" },
  { slug: "garantia", titulo: "Garantia", campo: "garantia_texto" },
  { slug: "termos", titulo: "Termos de uso", campo: "termos_texto" },
];
export const SLUGS_POLITICA = [...campos.map((c) => c.slug), "contato"];

const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function paginasPublicadas(p: PoliticasPublicas | null): PaginaPolitica[] {
  if (!p) return [];
  const out: PaginaPolitica[] = [];
  for (const c of campos) { const x = t(p[c.campo]); if (x) out.push({ slug: c.slug, titulo: c.titulo, texto: x }); }
  const contato = [t(p.razao_social), t(p.cnpj) && `CNPJ ${p.cnpj}`, t(p.endereco), t(p.telefone) && `Telefone: ${p.telefone}`, t(p.email_contato) && `E-mail: ${p.email_contato}`].filter(Boolean);
  if ((t(p.telefone) || t(p.email_contato)) && contato.length) out.push({ slug: "contato", titulo: "Contato", texto: contato.join("\n") });
  return out;
}

/** Prontidão da LOJA para o Merchant: domínio ativo + políticas essenciais aprovadas. O que exatamente o Google exige: NÃO CONFERIDO. */
export function prontidaoMerchantLoja(loja: LojaSeo): { pronta: boolean; faltando: string[] } {
  const faltando: string[] = [];
  if (!loja.dominio) faltando.push("domínio ativo (DNS e SSL verificados)");
  const p = loja.politicas;
  if (!p) faltando.push("políticas aprovadas pelo lojista");
  else {
    const slugs = new Set(paginasPublicadas(p).map((x) => x.slug));
    for (const [slug, nome] of [["privacidade", "política de privacidade"], ["troca-devolucao", "política de trocas e devoluções"], ["entrega", "política de entrega"], ["contato", "contato (telefone ou e-mail)"]] as const) {
      if (!slugs.has(slug)) faltando.push(nome);
    }
    if (!t(p.razao_social) || !t(p.cnpj) || !t(p.endereco)) faltando.push("razão social, CNPJ e endereço");
  }
  return { pronta: faltando.length === 0, faltando };
}
