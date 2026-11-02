// Diagnóstico do cadastro do Bling (fase 0 do desenho BALANCO_E_CADASTRO_INICIAL.md; o dono respondeu "proposta sim, pode mexer" em 02/11/2026). PURO e só leitura:
// recebe páginas de produtos (id, código, nome, situação) e acumula contagens, duplicidades prováveis e a maior sequência CI. Funciona em PÁGINAS, com estado que se
// carrega de uma chamada para outra (memória constante em relação ao catálogo: guarda só mapas por código e por nome normalizado).
// O QUE PROVA: contagens e candidatos a duplicidade, com os ids. O QUE NÃO PROVA: que dois registros são o mesmo produto (isso é decisão de uma pessoa); nada é apagado, mesclado ou gravado.
import { sequenciaMaxima } from "./regras_sku.ts";

export interface ProdutoResumo { id: string | number; codigo: string | null | undefined; nome: string | null | undefined; situacao: string }
export interface DiagnosticoEstado {
  total: number; porSituacao: Record<string, number>; semSku: number; semNome: number; maiorSequenciaCi: number;
  /** código normalizado -> ids e situações (só guarda quando há mais de um) */
  porCodigo: Record<string, { ids: string[]; situacoes: string[]; codigo: string }>;
  /** nome normalizado -> códigos distintos e situações */
  porNome: Record<string, { nome: string; codigos: string[]; situacoes: string[]; n: number }>;
}
export const novoDiagnostico = (): DiagnosticoEstado => ({ total: 0, porSituacao: {}, semSku: 0, semNome: 0, maiorSequenciaCi: 0, porCodigo: {}, porNome: {} });
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SIT: Record<string, string> = { A: "ativo", I: "inativo", E: "excluido" };

/** Soma uma página ao estado (função pura sobre cópia superficial: devolve novo estado). */
export function somarPagina(e: DiagnosticoEstado, produtos: readonly ProdutoResumo[]): DiagnosticoEstado {
  const s: DiagnosticoEstado = { ...e, porSituacao: { ...e.porSituacao }, porCodigo: { ...e.porCodigo }, porNome: { ...e.porNome } };
  const codigosPagina: string[] = [];
  for (const p of produtos) {
    s.total++;
    const sit = SIT[p.situacao] ?? "desconhecida"; s.porSituacao[sit] = (s.porSituacao[sit] ?? 0) + 1;
    const cod = (p.codigo ?? "").trim(), nome = (p.nome ?? "").trim();
    if (!cod) s.semSku++; else {
      codigosPagina.push(cod);
      const k = cod.toUpperCase(), a = s.porCodigo[k] ?? { ids: [], situacoes: [], codigo: cod };
      s.porCodigo[k] = { codigo: a.codigo, ids: [...a.ids, String(p.id)], situacoes: [...a.situacoes, sit] };
    }
    if (!nome) s.semNome++; else {
      const k = norm(nome), a = s.porNome[k] ?? { nome, codigos: [], situacoes: [], n: 0 };
      s.porNome[k] = { nome: a.nome, n: a.n + 1, situacoes: [...a.situacoes, sit], codigos: cod && !a.codigos.includes(cod) ? [...a.codigos, cod] : a.codigos };
    }
  }
  s.maiorSequenciaCi = Math.max(s.maiorSequenciaCi, sequenciaMaxima(codigosPagina));
  return s;
}

export interface RelatorioDiagnostico {
  total: number; porSituacao: Record<string, number>; semSku: number; semNome: number; maiorSequenciaCi: number; proximoSkuSugerido: string | null;
  skusDuplicados: { codigo: string; ids: string[]; situacoes: string[] }[];
  nomesDuplicados: { nome: string; registros: number; codigos: string[]; ativosNoGrupo: number }[];
  resumo: { codigosRepetidos: number; gruposDeNomeRepetido: number; gruposComAtivo: number };
  aviso: string;
}
/** Fecha o diagnóstico. `topo` limita as listas do relatório (o total vai no resumo). */
export function finalizarDiagnostico(e: DiagnosticoEstado, topo = 20): RelatorioDiagnostico {
  const skus = Object.values(e.porCodigo).filter((x) => x.ids.length > 1).sort((a, b) => b.ids.length - a.ids.length || a.codigo.localeCompare(b.codigo));
  const nomes = Object.values(e.porNome).filter((x) => x.n > 1).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
  const comAtivo = nomes.filter((x) => x.situacoes.includes("ativo")).length;
  return {
    total: e.total, porSituacao: e.porSituacao, semSku: e.semSku, semNome: e.semNome, maiorSequenciaCi: e.maiorSequenciaCi,
    proximoSkuSugerido: e.maiorSequenciaCi >= 0 ? `CI${String(e.maiorSequenciaCi + 1).padStart(6, "0")}` : null,
    skusDuplicados: skus.slice(0, topo).map((x) => ({ codigo: x.codigo, ids: x.ids, situacoes: x.situacoes })),
    nomesDuplicados: nomes.slice(0, topo).map((x) => ({ nome: x.nome, registros: x.n, codigos: x.codigos, ativosNoGrupo: x.situacoes.filter((s) => s === "ativo").length })),
    resumo: { codigosRepetidos: skus.length, gruposDeNomeRepetido: nomes.length, gruposComAtivo: comAtivo },
    aviso: "Candidatos a duplicidade, não decisão. Nada foi apagado, mesclado ou gravado. Excluído é restaurado como origem de um mestre, nunca apagado.",
  };
}
