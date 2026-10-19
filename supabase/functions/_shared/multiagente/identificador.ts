// Capacidade 1 — Identificador. Determinística: SKU, OEM, GTIN, marca da peça × montadora, classe da peça com evidência e duplicidades.
import { extrair, type CandidatoOem, type Extracao } from "../pipeline/extracao.ts";
import { classeDaPeca, montadorasCitadas } from "../pipeline/identificacao.ts";
import { aplicacoesDeExtracao } from "../pipeline/conectores.ts";
import type { EntradaPipeline } from "../pipeline/pipeline.ts";

export interface PortaCatalogo { duplicados(sku: string, gtin: string | undefined, nome: string): Promise<{ sku: string; nome: string }[]> }
export interface Identificacao {
  sku: string; extracao: Extracao; gtin: { valor: string; valido: boolean } | null; codigos_oem: CandidatoOem[];
  marca_da_peca: string | null; montadoras_citadas: string[];
  classe_peca: { classe: string; evidencia: string | null; pendencia: string | null };
  duplicidades: { sku: string; nome: string }[]; ambiguidades: string[];
}

export async function identificar(sku: string, e: EntradaPipeline, catalogo: PortaCatalogo, homologados: Record<string, string> = {}): Promise<Identificacao> {
  const ext = extrair(sku, e.nome ?? "", e.descricao ?? "", e.marca ?? "", e.gtin ?? "");
  const dup = (await catalogo.duplicados(sku, ext.gtin?.valido ? ext.gtin.valor : undefined, e.nome ?? "")).filter((d) => d.sku !== sku);
  return {
    sku, extracao: ext, gtin: ext.gtin, codigos_oem: ext.codigos_oem, marca_da_peca: ext.marca_fabricante,
    montadoras_citadas: montadorasCitadas(ext.texto_fonte), classe_peca: classeDaPeca(ext.marca_fabricante, ext.texto_fonte, homologados), duplicidades: dup,
    ambiguidades: aplicacoesDeExtracao(ext).ambigua ? ["mais de um veículo ou motor no mesmo texto: não se deduz aplicação; separar por versão"] : [],
  };
}
