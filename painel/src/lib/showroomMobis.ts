/**
 * Contrato visual do showroom Mobis Autopeças.
 * O MA e a tipografia comercial são arquivos oficiais da loja (não texto/SVG redesenhado).
 * A cor da montadora é apenas acento da página — nunca substitui as cores da Mobis.
 * Esta camada não concede homologação técnica nem permissão de uso de fotografias.
 */
export const CORES_MOBIS_SHOWROOM = Object.freeze({
  grafite: "#1F2327",
  vermelho: "#E2181A",
  cinza: "#BFC3C7",
  aco: "#A6A6A6",
  branco: "#FFFFFF",
  gelo: "#EAF2F6",
} as const);

export type IdentidadeMontadora = "hyundai" | "kia" | "neutra";
export type AplicacaoBanner = {
  slug: string;
  titulo: string;
  modelo: string;
  status: string;
  indexavel?: boolean;
};
export type FaixaShowroom = {
  id: string;
  titulo: string;
  subtitulo: string;
  acento: string;
  montadora: IdentidadeMontadora;
  destino: string;
  tipo: "aplicacao";
};

/** Apenas nome de modelo recebido da API; nunca deduz aplicação a partir do SKU ou de foto. */
export function identidadeDaMontadora(modelo: string): IdentidadeMontadora {
  const v = modelo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (/^(hyundai\s+)?hr(?:\b|\s)/.test(v)) return "hyundai";
  if (/^(kia\s+)?(?:bongo|k2500)(?:\b|\s)/.test(v)) return "kia";
  return "neutra";
}
export function acentoMontadora(marca: IdentidadeMontadora): string {
  switch (marca) {
    case "hyundai": return "#1877F2"; // azul Hyundai / acento digital aprovado na referência visual
    case "kia": return "#B70E28";     // acento visual da página Kia, não alteração do logotipo original
    default: return CORES_MOBIS_SHOWROOM.vermelho;
  }
}
/** Rascunhos e aprovações não indexáveis não geram banner comercial / link. */
export function faixasPublicasPorAplicacao(paginas: readonly AplicacaoBanner[]): FaixaShowroom[] {
  const jaIncluidas = new Set<string>();
  const result: FaixaShowroom[] = [];
  for (const a of paginas) {
    if (a.status !== "aprovado" || a.indexavel !== true || !a.slug.trim() || !a.modelo.trim()) continue;
    if (jaIncluidas.has(a.slug)) continue;
    jaIncluidas.add(a.slug);
    const montadora = identidadeDaMontadora(a.modelo);
    result.push({
      id: a.slug,
      titulo: a.modelo,
      subtitulo: a.titulo,
      montadora,
      acento: acentoMontadora(montadora),
      tipo: "aplicacao",
      destino: "#/a/" + encodeURIComponent(a.slug),
    });
  }
  return result;
}
/** Códigos OEM de componente não são referência OEM do conjunto físico. */
export function rotuloOemConjunto(oem: string | null | undefined, aprovado: boolean): string {
  return aprovado && !!oem?.trim() ? oem.trim() : "Referência OEM do conjunto em validação";
}
