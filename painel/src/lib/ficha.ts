// Ficha automática do produto: monta os blocos do padrão (código, título, veículos, compatibilidade) só com dado confirmado.
// Nada é inventado: sem aplicação aprovada a ficha diz "a confirmar". Puro e testável.
export interface FichaVeiculo { modelo: string; motor: string | null; de: number | null; ate: number | null; tipo: string | null }
export interface FichaProduto { nome: string; sku: string; marca: string | null; preco: number | null; descricao: string | null; imagem: string | null; whatsapp: string | null }
export interface FichaCaracteristica { rotulo: string; valor: string; fonte: string; coletado_em: string }
export interface Ficha {
  codigo: string; marca: string | null; titulo: string; veiculos: string | null; spec: string | null;
  compativel: string[]; tipos: string[]; caracteristicas: FichaCaracteristica[]; aConfirmar: string[];
}

export function periodo(de: number | null, ate: number | null): string | null {
  if (de != null && ate != null) return de === ate ? String(de) : `${de}–${ate}`;
  if (de != null) return `${de} em diante`;
  if (ate != null) return `até ${ate}`;
  return null;
}
export function linhaCompativel(v: FichaVeiculo): string {
  return [v.modelo, v.motor, periodo(v.de, v.ate)].filter(Boolean).join(" · ");
}
const unicos = <T,>(xs: T[]) => [...new Set(xs)];

export function montarFicha(p: FichaProduto, veiculos: FichaVeiculo[], caracteristicas: FichaCaracteristica[] = []): Ficha {
  const modelos = unicos(veiculos.map((v) => v.modelo));
  const motores = unicos(veiculos.map((v) => v.motor).filter(Boolean) as string[]);
  const anos = veiculos.flatMap((v) => [v.de, v.ate]).filter((a): a is number => a != null);
  const spec = [motores.slice(0, 2).join(" / "), anos.length ? periodo(Math.min(...anos), Math.max(...anos)) : null].filter(Boolean).join(" · ") || null;
  const aConfirmar: string[] = [];
  if (veiculos.length === 0) aConfirmar.push("compatibilidade");
  if (!p.imagem) aConfirmar.push("foto");
  return {
    codigo: p.sku, marca: p.marca, titulo: p.nome,
    veiculos: modelos.length ? modelos.slice(0, 3).join(" / ") + (modelos.length > 3 ? " e outros" : "") : null,
    spec, compativel: unicos(veiculos.map(linhaCompativel)).slice(0, 12),
    tipos: unicos(veiculos.map((v) => v.tipo).filter(Boolean) as string[]), caracteristicas, aConfirmar,
  };
}
