// Lentes da taxonomia (issue #297): a árvore mistura três eixos (peça/sistema, marca/fabricante, veículo). Aqui eles são SEPARADOS para a tela,
// e a fila "Sem classificação" ganha uma SUGESTÃO determinística (sem IA) pelo nome do produto. Tudo é leitura: nada grava, nada vira aplicação homologada.
// O QUE PROVA: que o nome do produto contém o nome de uma categoria de peça / de um modelo / de um motor cadastrados.
// O QUE NÃO PROVA: aplicação por geração, equivalência OEM nem compatibilidade. Sinal de veículo pelo nome é CANDIDATO, nunca aplicação.

export type Eixo = "peca" | "marca" | "veiculo" | "fila";

/** Minúsculas, sem acento, só letras/dígitos, plural simples removido por palavra; "d'água"/"dagua" unificados. */
export function normalizar(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\bd agua\b/g, "dagua").replace(/\bde agua\b/g, "dagua")
    .split(" ").map((p) => (p.length > 4 && p.endsWith("oes") ? p.slice(0, -3) + "ao" : p.length > 3 && p.endsWith("s") && !/\d/.test(p) ? p.slice(0, -1) : p)).join(" ");
}

/** Eixo de uma RAIZ da árvore, pelo nome (os slugs variam por ramo). */
export function eixoDaRaiz(nome: string): Eixo {
  const n = normalizar(nome);
  if (n.startsWith("sem classificac")) return "fila";
  if (/\bmarca\b|\bfabricante\b/.test(n)) return "marca";
  if (/\bveiculo\b|\baplicac/.test(n)) return "veiculo";
  return "peca";
}

export interface NoPeca { id: string; nome: string; caminho: string; profundidade: number }
export interface Sugestao { noId: string; nome: string; caminho: string; termo: string }

const contemPalavras = (texto: string, termo: string) => (` ${texto} `).includes(` ${termo} `);

/** Índice pronto para sugerir: normaliza uma vez os nós de PEÇA (raízes de marca/veículo/fila ficam de fora). Nomes curtos demais são ignorados. */
export function indicePecas(nos: NoPeca[]): { no: NoPeca; chave: string }[] {
  return nos.map((no) => ({ no, chave: normalizar(no.nome) })).filter((x) => x.chave.length >= 4)
    .sort((a, b) => b.chave.length - a.chave.length || b.no.profundidade - a.no.profundidade);
}

/** Sugestão de categoria de peça pelo nome: o nó cujo nome (palavras inteiras) aparece no nome do produto; vence o mais específico (nome mais longo, depois o mais fundo). null = sem sinal. */
export function sugerirPeca(nomeProduto: string, indice: { no: NoPeca; chave: string }[]): Sugestao | null {
  const texto = normalizar(nomeProduto);
  if (!texto) return null;
  for (const { no, chave } of indice) if (contemPalavras(texto, chave)) return { noId: no.id, nome: no.nome, caminho: no.caminho, termo: no.nome };
  return null;
}

export interface TermoVeiculo { tipo: "modelo" | "motor"; id: string; rotulo: string; grupo: string }

/** Sinais de veículo no nome (modelos e códigos de motor CADASTRADOS, por palavra inteira). São candidatos pelo nome, não aplicação. */
export function sinaisVeiculo(nomeProduto: string, termos: TermoVeiculo[]): TermoVeiculo[] {
  const texto = normalizar(nomeProduto);
  const vistos = new Set<string>();
  return termos.filter((t) => { const k = normalizar(t.rotulo); if (k.length < 2 || !contemPalavras(texto, k) || vistos.has(t.tipo + k)) return false; vistos.add(t.tipo + k); return true; });
}

/** Percentual inteiro seguro (0 quando não há total). */
export const pct = (parte: number, total: number): number => (total > 0 ? Math.round((parte / total) * 100) : 0);
