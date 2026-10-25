// Vitrine pública de uma loja. Lógica pura (testável sem rede): normaliza host/slug e monta só os campos públicos.
// Nunca expõe custo, fornecedor, bling_id nem dado de outra loja. Produto só entra se `publicado` (a leitura filtra no banco).
export const SLUG_RE = /^[a-z0-9-]{2,63}$/;

/** "WWW.Loja.com.br:443" -> "www.loja.com.br". Devolve null se não parecer um host. */
export function normalizarHost(h: unknown): string | null {
  if (typeof h !== "string") return null;
  const x = h.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(x) && x.length <= 253 ? x : null;
}

export interface LinhaProduto {
  nome: string | null; sku: string | null; preco: number | string | null; estoque: number | string | null;
  marca: string | null; descricao_curta: string | null; atualizado_em?: string | null; sincronizado_em?: string | null;
  imagem?: string | null;
}
export interface ProdutoVitrine {
  nome: string; sku: string; preco: number | null; em_estoque: boolean | null; marca: string | null;
  descricao: string | null; imagem: string | null; whatsapp: string | null; atualizado_em: string | null;
}

const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
/** Texto simples: o espelho pode trazer HTML do Bling; a vitrine mostra só texto. */
export function textoSimples(s: string | null | undefined, max = 240): string | null {
  if (!s) return null;
  const t = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Mensagem pronta para o WhatsApp da loja: nome, código e, quando a loja tem domínio ativo, o link do produto. `origem` marca de onde veio o clique (ex.: banner). */
export function mensagemWhatsapp(nome: string, sku: string, opcoes: { url?: string | null; origem?: string } = {}): string {
  const linhas = [`Olá! Tenho interesse em ${nome} (cód. ${sku}).`];
  if (opcoes.url) linhas.push(opcoes.url);
  if (opcoes.origem && /^[a-z0-9-]{1,30}$/.test(opcoes.origem)) linhas.push(`ref: ${opcoes.origem}`);
  return linhas.join("\n");
}

export function linkWhatsapp(numero: string | null | undefined, nome: string, sku: string, opcoes: { url?: string | null; origem?: string } = {}): string | null {
  let d = (numero ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d; // DDD + número => acrescenta o país
  if (!/^55\d{10,11}$/.test(d)) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagemWhatsapp(nome, sku, opcoes))}`;
}

export interface LinhaBanner { sku: string | null; nome: string | null; preco: number | string | null; chamada: string | null; fim: string | null; flash: boolean | null }
export interface BannerVitrine { sku: string; nome: string; preco: number | null; chamada: string | null; fim: string | null; flash: boolean; whatsapp: string | null; url: string | null }
/** Banners no ar para a vitrine. Preço é o do espelho do Bling (nunca digitado). Sem nome ou SKU o banner não sai. */
export function montarBanners(linhas: LinhaBanner[], whatsapp: string | null, urlDoProduto: (sku: string) => string | null): BannerVitrine[] {
  const out: BannerVitrine[] = [];
  for (const l of linhas) {
    if (!l.nome || !l.sku) continue;
    const url = urlDoProduto(l.sku);
    out.push({ sku: l.sku, nome: l.nome, preco: num(l.preco), chamada: l.chamada?.trim() || null, fim: l.fim, flash: l.flash === true, url,
      whatsapp: linkWhatsapp(whatsapp, l.nome, l.sku, { url, origem: l.flash ? "banner-flash" : "banner" }) });
  }
  return out;
}

/** Linhas sem nome ou SKU não aparecem (produto incompleto não é publicado). */
export function montarVitrine(linhas: LinhaProduto[], whatsapp: string | null, urlDoProduto: (sku: string) => string | null = () => null): ProdutoVitrine[] {
  const out: ProdutoVitrine[] = [];
  for (const l of linhas) {
    if (!l.nome || !l.sku) continue;
    const est = num(l.estoque);
    out.push({
      nome: l.nome, sku: l.sku, preco: num(l.preco), em_estoque: est == null ? null : est > 0,
      marca: l.marca, descricao: textoSimples(l.descricao_curta), imagem: l.imagem ?? null,
      whatsapp: linkWhatsapp(whatsapp, l.nome, l.sku, { url: urlDoProduto(l.sku) }), atualizado_em: l.sincronizado_em ?? l.atualizado_em ?? null,
    });
  }
  return out;
}

export interface Aplicacao { produto_id: string; modelo: string; motorizacao: string | null; ano_inicial: number | null; ano_final: number | null; categoria?: string | null }

/** Tipos de veículo da vitrine e as categorias de `modelos` que cada um cobre (utilitário=SUV, van=furgão). */
export const TIPOS_VEICULO: Record<string, string[]> = {
  passeio: ["passeio"], suv: ["suv", "utilitario"], furgao: ["furgao", "van"], picape: ["picape"], caminhao: ["caminhao"], moto: ["moto"],
};
export const tipoDaCategoria = (c: string | null | undefined): string | null => Object.entries(TIPOS_VEICULO).find(([, cs]) => cs.includes(c ?? ""))?.[0] ?? null;
/** Quantos produtos publicados têm aplicação aprovada ligada a modelo de cada tipo. Sem ligação ao cadastro técnico, não classifica. */
export function tiposDoVeiculo(apls: Aplicacao[]): { tipo: string; total: number }[] {
  const por = new Map<string, Set<string>>();
  for (const a of apls) { const t = tipoDaCategoria(a.categoria); if (t) por.set(t, (por.get(t) ?? new Set()).add(a.produto_id)); }
  return Object.keys(TIPOS_VEICULO).filter((t) => por.has(t)).map((tipo) => ({ tipo, total: por.get(tipo)!.size }));
}
/** Ids de produto com aplicação aprovada em modelo do tipo escolhido (chave inválida => ninguém). */
export function produtosDoTipo(apls: Aplicacao[], tipo: string): Set<string> {
  const cats = Object.hasOwn(TIPOS_VEICULO, tipo) ? TIPOS_VEICULO[tipo] : [];
  return new Set(apls.filter((a) => cats.includes(a.categoria ?? "")).map((a) => a.produto_id));
}
/** O ano cai no intervalo (aberto quando falta um dos lados)? Sem nenhum limite informado, NÃO confirma. */
export function anoNoIntervalo(ano: number, ini: number | null, fim: number | null): boolean {
  if (ini == null && fim == null) return false;
  return (ini == null || ano >= ini) && (fim == null || ano <= fim);
}
/** Ids de produto cujas aplicações APROVADAS batem com os filtros escolhidos (modelo, motor e ano; todos opcionais). */
export function produtosDoVeiculo(apls: Aplicacao[], f: { modelo?: string; motor?: string; ano?: number }): Set<string> {
  const ids = new Set<string>();
  for (const a of apls) {
    if (f.modelo && a.modelo !== f.modelo) continue;
    if (f.motor && a.motorizacao !== f.motor) continue;
    if (f.ano != null && !anoNoIntervalo(f.ano, a.ano_inicial, a.ano_final)) continue;
    ids.add(a.produto_id);
  }
  return ids;
}
/** Opções da busca por veículo (cascata), só do que existe aprovado nos produtos publicados. */
export function opcoesVeiculo(apls: Aplicacao[]) {
  return apls.map((a) => ({ modelo: a.modelo, motor: a.motorizacao, de: a.ano_inicial, ate: a.ano_final }))
    .filter((v, i, arr) => arr.findIndex((o) => o.modelo === v.modelo && o.motor === v.motor && o.de === v.de && o.ate === v.ate) === i)
    .slice(0, 500);
}

export interface FichaVeiculo { modelo: string; motor: string | null; de: number | null; ate: number | null; tipo: string | null }
/** Aplicações APROVADAS de um produto, sem repetir, para a ficha automática. Tipo só quando ligado ao cadastro técnico. */
export function veiculosDaFicha(apls: Aplicacao[], produtoId: string): FichaVeiculo[] {
  const vistos = new Set<string>(); const out: FichaVeiculo[] = [];
  for (const a of apls) {
    if (a.produto_id !== produtoId) continue;
    const chave = `${a.modelo}|${a.motorizacao}|${a.ano_inicial}|${a.ano_final}`;
    if (vistos.has(chave)) continue; vistos.add(chave);
    out.push({ modelo: a.modelo, motor: a.motorizacao, de: a.ano_inicial, ate: a.ano_final, tipo: tipoDaCategoria(a.categoria) });
  }
  return out.slice(0, 40);
}

export interface Caracteristica { rotulo: string; valor: string; fonte: string; coletado_em: string }
export interface LinhaEnriquecimento { campo: string; valor: unknown; fonte: string | null; coletado_em: string | null; status: string }
const ROTULOS_CARACTERISTICA: Record<string, string> = { marca_peca: "Marca da peça", peso_kg: "Peso", dimensoes: "Dimensões" };
/** Só o host da fonte vai para a vitrine (nunca o caminho nem parâmetros da URL); documento sem URL vira "documento do fornecedor". */
export function fonteVisivel(fonte: string): string {
  try { const u = new URL(fonte); return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.replace(/^www\./, "") : "documento do fornecedor"; }
  catch { return "documento do fornecedor"; }
}
function valorTexto(campo: string, v: unknown): string | null {
  if (campo === "peso_kg") { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg` : null; }
  if (campo === "dimensoes" && v && typeof v === "object") {
    const d = v as Record<string, unknown>; const med = [d.altura, d.largura, d.profundidade].map(Number);
    return med.every((x) => Number.isFinite(x) && x > 0) ? `${med.join(" × ")} cm (A × L × P)` : null;
  }
  return typeof v === "string" ? textoSimples(v, 120) : null;
}
/** Características da ficha: SOMENTE enriquecimento aprovado, com fonte e data. Sem fonte/data ou sem valor válido, não aparece. */
export function caracteristicasDaFicha(linhas: LinhaEnriquecimento[]): Caracteristica[] {
  const out: Caracteristica[] = [];
  for (const l of linhas) {
    const rotulo = ROTULOS_CARACTERISTICA[l.campo];
    if (!rotulo || l.status !== "aprovado" || !l.fonte || !l.coletado_em) continue;
    const valor = valorTexto(l.campo, l.valor);
    if (valor) out.push({ rotulo, valor, fonte: fonteVisivel(l.fonte), coletado_em: l.coletado_em.slice(0, 10) });
  }
  return out;
}
