// Regras de relação entre peças e de classe da peça. Nenhuma equivalência é homologada por semelhança de descrição:
// cada tipo de relação tem um TETO definido pelo tipo de evidência que o sustenta. Espelha as restrições de ref_cruzada / pecas_ref no banco.
export type ClassePeca = "genuina" | "oem_primeiro_equipamento" | "oes" | "aftermarket_equivalente" | "a_confirmar";
export type TipoRelacao = "hipotese" | "referencia_cruzada" | "equivalencia_funcional" | "equivalente_validado" | "substituto_homologado";
export type TipoEvidencia = "descricao" | "catalogo" | "especificacao" | "ensaio" | "homologacao" | "fornecimento_original" | "catalogo_comercial_fabricante";
export interface EvidenciaRelacao { tipo: TipoEvidencia; fonte?: string; documento?: string; data?: string }

const ORDEM: TipoRelacao[] = ["hipotese", "referencia_cruzada", "equivalencia_funcional", "equivalente_validado", "substituto_homologado"];
const completa = (e: EvidenciaRelacao) => !!(e.fonte || e.documento) && !!e.data;

/** O maior tipo de relação que as evidências sustentam. Evidência sem fonte/data, ou só de descrição, sustenta no máximo "hipotese". */
export function tetoDaRelacao(evs: EvidenciaRelacao[]): { tipo: TipoRelacao; motivo: string } {
  const validas = evs.filter(completa);
  const tem = (t: TipoEvidencia) => validas.some((e) => e.tipo === t);
  if (tem("homologacao")) return { tipo: "substituto_homologado", motivo: "há documento de homologação com fonte e data" };
  if (tem("ensaio")) return { tipo: "equivalente_validado", motivo: "há ensaio/validação de engenharia com documento e data" };
  if (tem("especificacao")) return { tipo: "equivalencia_funcional", motivo: "há especificação técnica com fonte; equivalência funcional NÃO é homologação" };
  if (tem("catalogo")) return { tipo: "referencia_cruzada", motivo: "há listagem de catálogo com fonte; referência cruzada NÃO é equivalência validada" };
  return { tipo: "hipotese", motivo: evs.length ? "evidência sem fonte/data ou só de descrição: não sustenta relação" : "sem evidência" };
}

export function podePromover(para: TipoRelacao, evs: EvidenciaRelacao[]): { ok: boolean; motivo: string } {
  const teto = tetoDaRelacao(evs);
  const ok = ORDEM.indexOf(para) <= ORDEM.indexOf(teto.tipo);
  return { ok, motivo: ok ? teto.motivo : `"${para}" exige mais do que as evidências dão (teto: ${teto.tipo}: ${teto.motivo})` };
}

/** Semelhança de descrição serve apenas para SUGERIR uma hipótese a investigar; nunca produz relação. */
export function sugerirHipotese(descA: string, descB: string): { similaridade: number; relacao: "hipotese" | null } {
  const tok = (s: string) => new Set(s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));
  const a = tok(descA), b = tok(descB);
  const inter = [...a].filter((x) => b.has(x)).length;
  const sim = a.size + b.size - inter === 0 ? 0 : inter / (a.size + b.size - inter);
  return { similaridade: Number(sim.toFixed(3)), relacao: sim >= 0.6 ? "hipotese" : null };
}

export interface DadosClasse {
  codigoPertenceAMontadora: boolean; vendidaSobMarcaDaMontadora: boolean;
  fornecimentoOriginal?: { tipo: "primeiro_equipamento" | "oes"; aprovado: boolean; documento?: string };
  evidencias: EvidenciaRelacao[];
}
/** Genuína, OEM (primeiro equipamento/OES), aftermarket ou a confirmar — cada classe exige a evidência da própria classe. */
export function classificarClasse(d: DadosClasse): { classe: ClassePeca; motivo: string } {
  const doc = (t: TipoEvidencia) => d.evidencias.some((e) => e.tipo === t && completa(e));
  if (d.codigoPertenceAMontadora && d.vendidaSobMarcaDaMontadora && doc("catalogo")) return { classe: "genuina", motivo: "código da montadora, vendida sob a marca dela, com catálogo e fonte" };
  const f = d.fornecimentoOriginal;
  if (f && f.aprovado && f.documento && doc("fornecimento_original")) return { classe: f.tipo === "oes" ? "oes" : "oem_primeiro_equipamento", motivo: "fornecimento original aprovado, documentado" };
  if (doc("catalogo_comercial_fabricante") && !f) return { classe: "aftermarket_equivalente", motivo: "linha de reposição do fabricante em catálogo comercial, sem fornecimento original comprovado" };
  return { classe: "a_confirmar", motivo: "faltam evidências da classe: marca conhecida ou 'original' no texto não bastam" };
}
