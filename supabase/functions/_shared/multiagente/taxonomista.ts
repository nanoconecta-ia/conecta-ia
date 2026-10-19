// Capacidade 3 — Taxonomista. Classifica na árvore FECHADA (Sistema ▸ Subsistema ▸ Família). Regras determinísticas primeiro; LLM só se as regras
// não resolverem e houver orçamento. Resposta fora da lista é descartada: a árvore só cresce por proposta aprovada pelo lojista.
import { chave } from "../pipeline/texto.ts";
import { carregarTaxonomia, taxonomiaValida, type Taxonomia } from "./taxonomia_dados.ts";
import type { PortaCustos } from "./custos.ts";

export interface Classificacao { sistema: string; subsistema: string; familia: string; origem: "regra" | "aprendida" | "llm"; confianca: "media" | "baixa"; regra_versao?: number }
export interface RegraAprendida { id?: string; chave: string; valor: { sistema?: string; subsistema?: string; familia?: string }; versao: number }
export type ClassificadorLLM = (texto: string, taxonomia: Taxonomia) => Promise<{ saida: { sistema?: string; subsistema?: string; familia?: string }; tokens_in: number; tokens_out: number; usd: number }>;

// termos ESPECÍFICOS da peça (ordem importa: o mais específico primeiro). Sem acento, em minúsculas.
const REGRAS: { termos: RegExp; c: [string, string, string] }[] = [
  { termos: /\bjogo de juntas\b|\bkit de juntas\b/, c: ["Motor", "Juntas e Vedacao", "Jogo de Juntas"] },
  { termos: /\bjunta (do )?cabecote\b|\bjunta de cabecote\b/, c: ["Motor", "Juntas e Vedacao", "Junta de Cabecote"] },
  { termos: /\bjunta (do )?coletor\b/, c: ["Motor", "Juntas e Vedacao", "Junta Coletor"] },
  { termos: /\bretentor(es)?\b/, c: ["Motor", "Juntas e Vedacao", "Retentores"] },
  { termos: /\bkit corrente\b|\bcorrente de comando\b/, c: ["Motor", "Distribuicao e Sincronismo", "Kit Corrente"] },
  { termos: /\bcorreia dentada\b/, c: ["Motor", "Distribuicao e Sincronismo", "Correia Dentada"] },
  { termos: /\btensor(es)?\b/, c: ["Motor", "Distribuicao e Sincronismo", "Tensores"] },
  { termos: /\bbico injetor\b|\binjetor(es)?\b/, c: ["Injecao e Alimentacao", "Sistema Common Rail", "Bico Injetor"] },
  { termos: /\bbomba de alta pressao\b/, c: ["Injecao e Alimentacao", "Sistema Common Rail", "Bomba de Alta Pressao"] },
  { termos: /\bturbina\b|\bturbocompressor\b/, c: ["Injecao e Alimentacao", "Turboalimentacao", "Turbina Completa"] },
  { termos: /\bbomba d.?agua\b/, c: ["Arrefecimento", "Circulacao e Controle", "Bomba d'Agua"] },
  { termos: /\bvalvula termostatica\b|\btermostato\b/, c: ["Arrefecimento", "Circulacao e Controle", "Valvula Termostatica"] },
  { termos: /\bradiador\b/, c: ["Arrefecimento", "Circulacao e Controle", "Radiador"] },
  { termos: /\bbandeja\b/, c: ["Suspensao e Freios", "Articulacoes e Hidraulica", "Bandeja"] },
  { termos: /\bpivo\b/, c: ["Suspensao e Freios", "Articulacoes e Hidraulica", "Pivo"] },
  { termos: /\bservo freio\b/, c: ["Suspensao e Freios", "Articulacoes e Hidraulica", "Servo Freio"] },
  { termos: /\bpinca\b/, c: ["Suspensao e Freios", "Articulacoes e Hidraulica", "Pinca"] },
];

export async function classificar(nome: string, descricao: string, o: { custos: PortaCustos; llm?: ClassificadorLLM; taxonomia?: Taxonomia; regrasAprendidas?: RegraAprendida[] }): Promise<{ classificacao: Classificacao | null; pendencia: string | null; duracao_ms: number }> {
  const ini = Date.now();
  const tx = o.taxonomia ?? carregarTaxonomia();
  const t = chave(`${nome} ${descricao}`);
  // o NOME manda: a descrição cita peças relacionadas ("com retentor") que não definem o produto
  const alvo = chave(nome);
  // regras APRENDIDAS e ATIVAS (aprovadas pelo lojista) vêm primeiro; o destino precisa existir na árvore fechada, senão a regra é ignorada
  for (const r of o.regrasAprendidas ?? []) {
    if (!alvo.includes(chave(r.chave))) continue;
    const dest = resolverDestino(tx, r.valor);
    if (dest) return { classificacao: { ...dest, origem: "aprendida", confianca: "media", regra_versao: r.versao }, pendencia: null, duracao_ms: Date.now() - ini };
  }
  for (const base of [alvo, t]) {
    for (const r of REGRAS) {
      if (!r.termos.test(base)) continue;
      const alvoValido = achar(tx, r.c);
      if (alvoValido) return { classificacao: { ...alvoValido, origem: "regra", confianca: base === alvo ? "media" : "baixa" }, pendencia: null, duracao_ms: Date.now() - ini };
    }
  }
  if (o.llm) {
    const reserva = await o.custos.tentar("taxonomista", "llm", "classificador", 0.002);
    if (reserva.ok) {
      const r = await o.llm(`${nome}\n${descricao}`.slice(0, 1500), tx);
      await o.custos.confirmar(reserva.id!, { capacidade: "taxonomista", tarefa: "classificar:llm", tipo: "llm", fonte: "classificador", chamadas: 1, tokens_in: r.tokens_in, tokens_out: r.tokens_out, usd: r.usd, duracao_ms: Date.now() - ini });
      const s = r.saida;
      if (s.sistema && s.subsistema && s.familia && taxonomiaValida(tx, s.sistema, s.subsistema, s.familia)) return { classificacao: { sistema: s.sistema, subsistema: s.subsistema, familia: s.familia, origem: "llm", confianca: "baixa" }, pendencia: null, duracao_ms: Date.now() - ini };
      return { classificacao: null, pendencia: "classificação do modelo fora da lista fechada: descartada (pede proposta de categoria nova ao lojista)", duracao_ms: Date.now() - ini };
    }
    return { classificacao: null, pendencia: "sem regra e sem orçamento para classificar por modelo", duracao_ms: Date.now() - ini };
  }
  return { classificacao: null, pendencia: "nenhuma regra reconhece a peça; classificar por modelo ou pessoa", duracao_ms: Date.now() - ini };
}

function achar(tx: Taxonomia, c: [string, string, string]): { sistema: string; subsistema: string; familia: string } | null {
  const norm = (s: string) => chave(s).replace(/'/g, "");
  for (const [s, subs] of Object.entries(tx)) for (const [sub, fams] of Object.entries(subs)) for (const f of fams) {
    if (norm(s) === norm(c[0]) && norm(sub) === norm(c[1]) && norm(f).replace(/\s+/g, "") === norm(c[2]).replace(/\s+/g, "")) return { sistema: s, subsistema: sub, familia: f };
  }
  return null;
}

/** Resolve o destino de uma regra aprendida na árvore fechada. Família sem caminho único ou fora da lista => null (a regra não vale). */
function resolverDestino(tx: Taxonomia, v: { sistema?: string; subsistema?: string; familia?: string }): { sistema: string; subsistema: string; familia: string } | null {
  if (!v.familia) return null;
  const achados: { sistema: string; subsistema: string; familia: string }[] = [];
  for (const [s, subs] of Object.entries(tx)) for (const [sub, fams] of Object.entries(subs)) for (const f of fams)
    if (f === v.familia && (!v.sistema || v.sistema === s) && (!v.subsistema || v.subsistema === sub)) achados.push({ sistema: s, subsistema: sub, familia: f });
  return achados.length === 1 ? achados[0] : null;
}

/** Termo candidato para uma regra a partir do nome do produto corrigido: as palavras do núcleo do nome, sem números, códigos nem marca. */
export function termoCandidato(nome: string): string {
  const stop = new Set(["de", "da", "do", "dos", "das", "com", "para", "e", "em", "a", "o", "sem", "std", "completo", "marca"]);
  return chave(nome).split(/[^a-z]+/).filter((t) => t.length > 2 && !stop.has(t)).slice(0, 3).join(" ");
}
