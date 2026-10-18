import type { ExtraidoDoNome } from "./extrair.ts";

export interface LinhaEnriquecimento {
  campo: string;
  valor: unknown;
  fonte: string;
  coletado_em: string;
  confianca: number;
  status: "a_confirmar";
  provedor: "integrado";
}

// Monta as linhas da camada de enriquecimento. Sempre a_confirmar: aprovar é do lojista.
export function montarLinhas(
  blingId: string, e: ExtraidoDoNome, slugTaxonomia: string | null, agoraISO: string,
): LinhaEnriquecimento[] {
  const fonte = `bling:produto:${blingId}:nome`;
  const base = { fonte, coletado_em: agoraISO, status: "a_confirmar" as const, provedor: "integrado" as const };
  const l: LinhaEnriquecimento[] = [];
  if (e.marca) l.push({ ...base, campo: "marca_peca", valor: e.marca, confianca: 0.7 });
  if (e.veiculo) l.push({ ...base, campo: "aplicacao_veicular", valor: { veiculo: e.veiculo }, confianca: 0.6 });
  if (e.motor) l.push({ ...base, campo: "motor", valor: e.motor, confianca: 0.6 });
  if (e.cilindrada) l.push({ ...base, campo: "cilindrada_l", valor: e.cilindrada, confianca: 0.6 });
  if (e.valvulas) l.push({ ...base, campo: "valvulas", valor: e.valvulas, confianca: 0.6 });
  if (e.anoInicial) l.push({ ...base, campo: "ano_inicial", valor: e.anoInicial, confianca: 0.4 });
  if (slugTaxonomia) l.push({ ...base, campo: "taxonomia", valor: { slug: slugTaxonomia }, confianca: 0.6 });
  return l;
}

export interface Disponivel {
  nome?: string | null; sku?: string | null; preco?: number | null; categoria?: string | null;
  temImagemPrincipal: boolean; temCodigoFabricante: boolean; temAplicacao: boolean;
  camposEnriquecidos: Set<string>;
}

// Compara com campos_exigidos da receita. O que não está comprovado fica em "vazios" (produto incompleto não publica).
export function checarCamposExigidos(exigidos: string[], d: Disponivel): { preenchidos: string[]; vazios: string[] } {
  const tem = (c: string): boolean => {
    switch (c) {
      case "nome": return !!d.nome?.trim();
      case "sku": return !!d.sku?.trim();
      case "preco": return d.preco != null && d.preco > 0;
      case "categoria": return !!d.categoria?.trim();
      case "imagem_principal": return d.temImagemPrincipal;
      case "marca_peca": return d.camposEnriquecidos.has("marca_peca");
      case "codigo_fabricante": return d.temCodigoFabricante;
      case "aplicacao_veicular": return d.temAplicacao || d.camposEnriquecidos.has("aplicacao_veicular");
      default: return d.camposEnriquecidos.has(c);
    }
  };
  const preenchidos: string[] = [], vazios: string[] = [];
  for (const c of exigidos) (tem(c) ? preenchidos : vazios).push(c);
  return { preenchidos, vazios };
}

export function resultadoDe(vazios: string[]): "sucesso" | "parcial" {
  return vazios.length === 0 ? "sucesso" : "parcial";
}
