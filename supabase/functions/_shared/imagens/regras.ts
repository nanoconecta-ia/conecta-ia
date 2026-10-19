// Regras de imagem de produto (lógica pura). Duas decisões separadas, como no banco:
//   1) o lojista APROVA a candidata (identidade provada por cruzamento);
//   2) a imagem só é PUBLICADA se os DIREITOS DE USO estiverem confirmados.
// url_original (página de terceiros) é interna: nunca vai ao catálogo público. Imagem sintética/ilustrativa é sempre rotulada.
export type TipoImagem = "real" | "gerada_ia" | "ilustrativa";
export type Licenca = "propria" | "fornecedor" | "fabricante" | "publica_web" | "licenciada";
export type Cruzamento = "sku" | "ean" | "oem" | "fabricante" | "similar" | "substituto";

export interface Imagem {
  id: string; produto_id: string; url: string; tipo: TipoImagem; origem: string | null; licenca_tipo: Licenca | null; url_original: string | null;
  cruzamento_tipo: Cruzamento | null; cruzamento_valor: string | null; confianca: number | null; aprovada: boolean; principal: boolean;
  removida_em: string | null; direitos_confirmados_em: string | null; largura_px: number | null; altura_px: number | null;
  fundo_branco: boolean; alt_texto: string | null;
}
export interface ContextoProduto {
  sku: string | null; gtin: string | null; codigosOem: string[]; codigosFabricante: string[]; aplicacoesAprovadas: number;
}

export type CanalId = "site" | "merchant";
/** `origem: "projeto"` = escolha nossa; `"google"` = regra de terceiro, ainda NÃO CONFERIDA na documentação (conferido = false). */
export interface RegraCanal { id: CanalId; minimoPx: number; recomendadoPx: number; origem: "projeto" | "google"; conferido: boolean; exigeFundoBranco: boolean }
export const CANAIS: Record<CanalId, RegraCanal> = {
  site: { id: "site", minimoPx: 300, recomendadoPx: 800, origem: "projeto", conferido: true, exigeFundoBranco: false },
  merchant: { id: "merchant", minimoPx: 100, recomendadoPx: 800, origem: "google", conferido: false, exigeFundoBranco: true },
};

const https = (u: string | null) => !!u && /^https:\/\/[^\s]+$/i.test(u);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Direitos de uso: foto própria/licenciada vale; fornecedor/fabricante/web pública exigem confirmação registrada. Sem tipo = desconhecido. */
export function direitosConfirmados(i: Pick<Imagem, "licenca_tipo" | "direitos_confirmados_em">): boolean {
  if (i.licenca_tipo === "propria" || i.licenca_tipo === "licenciada") return true;
  return i.licenca_tipo != null && i.direitos_confirmados_em != null;
}

export interface Veredito { ok: boolean; bloqueios: string[]; avisos: string[]; manuais: string[] }
const veredito = (bloqueios: string[], avisos: string[] = [], manuais: string[] = []): Veredito => ({ ok: bloqueios.length === 0, bloqueios, avisos, manuais });

/** O cruzamento declarado realmente bate com um identificador conhecido do produto? */
export function cruzamentoConfere(i: Pick<Imagem, "cruzamento_tipo" | "cruzamento_valor">, c: ContextoProduto): boolean {
  const v = norm(i.cruzamento_valor);
  if (!v) return false;
  switch (i.cruzamento_tipo) {
    case "sku": return v === norm(c.sku);
    case "ean": return !!c.gtin && v === norm(c.gtin);
    case "oem": return c.codigosOem.some((x) => norm(x) === v);
    case "fabricante": return c.codigosFabricante.some((x) => norm(x) === v);
    default: return false; // similar/substituto não provam identidade
  }
}

/** A candidata pode ser APROVADA pelo lojista? Identidade provada, origem registrada, URL própria. */
export function validarCandidata(i: Imagem, c: ContextoProduto, opcoes: { comoPrincipal?: boolean } = {}): Veredito {
  const b: string[] = [], a: string[] = [], m: string[] = [];
  if (!https(i.url)) b.push("URL da imagem não é https");
  if (i.url_original && i.url === i.url_original) b.push("a URL servida é a de terceiros (url_original): use a cópia tratada");
  if (!i.origem && !i.url_original) b.push("origem não registrada");
  if (i.tipo !== "real") {
    if (!i.cruzamento_tipo || !norm(i.cruzamento_valor)) b.push("imagem não real exige cruzamento (sku/ean/oem/fabricante) que prove a identidade");
    else if (i.cruzamento_tipo === "similar" || i.cruzamento_tipo === "substituto") {
      (opcoes.comoPrincipal ? b : a).push(`cruzamento "${i.cruzamento_tipo}" não prova que é a mesma peça`);
    } else if (!cruzamentoConfere(i, c)) b.push(`cruzamento ${i.cruzamento_tipo}="${i.cruzamento_valor}" não confere com os identificadores do produto`);
    if (c.aplicacoesAprovadas === 0) a.push("produto sem aplicação veicular aprovada: aplicação da imagem não verificada");
  }
  if (i.tipo === "gerada_ia" && opcoes.comoPrincipal) b.push("imagem gerada por IA não pode ser a principal");
  if (i.confianca != null && i.confianca < 0.5) a.push("confiança baixa na identificação");
  if (i.largura_px == null || i.altura_px == null) m.push("resolução desconhecida: medir antes de publicar");
  return veredito(b, a, m);
}

/** Pode ir ao catálogo público? Aprovada + direitos confirmados + não retirada + URL própria. Nunca devolve url_original. */
export function podePublicar(i: Imagem): Veredito {
  const b: string[] = [];
  if (i.removida_em) b.push("imagem retirada (takedown)");
  if (!i.aprovada) b.push("não aprovada pelo lojista");
  if (!direitosConfirmados(i)) b.push("direitos de uso não confirmados");
  if (!https(i.url)) b.push("URL não é https");
  if (i.url_original && i.url === i.url_original) b.push("serviria a URL de terceiros");
  return veredito(b);
}

/** Texto obrigatório junto à imagem não real. Foto real não leva rótulo. */
export function rotuloPublico(i: Pick<Imagem, "tipo">): string | null {
  return i.tipo === "real" ? null : i.tipo === "gerada_ia" ? "Imagem gerada por IA, apenas ilustração" : "Imagem ilustrativa";
}
/** Principal: foto real publicável; não real só se aprovada de propósito (espelha a constraint do banco) e nunca gerada por IA. */
export function podeSerPrincipal(i: Imagem): boolean {
  return podePublicar(i).ok && i.tipo !== "gerada_ia";
}
export function escolherPrincipal(imagens: Imagem[]): Imagem | null {
  const area = (i: Imagem) => (i.largura_px ?? 0) * (i.altura_px ?? 0);
  return [...imagens].filter(podeSerPrincipal).sort((a, b) => Number(b.tipo === "real") - Number(a.tipo === "real") || area(b) - area(a) || a.id.localeCompare(b.id))[0] ?? null;
}
/** Produtos ativos sem nenhuma imagem publicável: fila de trabalho do pipeline. */
export function produtosSemImagem(produtoIds: string[], imagens: Imagem[]): string[] {
  const com = new Set(imagens.filter((i) => podePublicar(i).ok).map((i) => i.produto_id));
  return produtoIds.filter((id) => !com.has(id));
}

/** Validação por canal. Só o mensurável por metadados vira bloqueio; o resto vai para `manuais` (verificação humana). */
export function validarParaCanal(i: Imagem, canal: CanalId): Veredito {
  const r = CANAIS[canal], b: string[] = [], a: string[] = [], m: string[] = [];
  const pub = podePublicar(i);
  b.push(...pub.bloqueios);
  if (i.tipo === "gerada_ia" && canal === "merchant") b.push("imagem sintética não serve como imagem de produto no feed");
  if (i.largura_px == null || i.altura_px == null) m.push(`resolução desconhecida: confirmar mínimo de ${r.minimoPx}px`);
  else {
    const menor = Math.min(i.largura_px, i.altura_px);
    if (menor < r.minimoPx) b.push(`menor lado ${menor}px < mínimo ${r.minimoPx}px${r.conferido ? "" : " (regra NÃO CONFERIDA)"}`);
    else if (menor < r.recomendadoPx) a.push(`abaixo do recomendado (${r.recomendadoPx}px)${r.conferido ? "" : " (NÃO CONFERIDO)"}`);
  }
  if (r.exigeFundoBranco && !i.fundo_branco) m.push("fundo branco não confirmado");
  if (canal === "merchant") m.push("marca d'água/sobreposição/texto promocional: verificação manual");
  if (i.tipo === "ilustrativa") m.push("imagem ilustrativa: conferir se o canal aceita");
  return veredito(b, a, m);
}
