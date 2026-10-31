// Sugestões do piloto: SÓ a partir do que já está na tela (nada inventado, nada buscado fora). Cada sugestão diz de onde veio.
// GTIN, peso, medidas e compatibilidade NUNCA são sugeridos aqui: exigem fonte externa verificável (fica "a confirmar").
import { chaveDe } from "./leitura.ts";
import type { Reconhecimento } from "./reconhecer.ts";

export interface Sugestao { campo: string; valor: string; origem: string; aplicavel: false }
export interface Pendencia { campo: string; canonico: string; motivo: string }

const PARADAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "p", "c", "sem", "em", "a", "o", "kit", "jogo", "un", "pc", "pcs"]);

/** Tags de busca derivadas do nome, marca e código já cadastrados. Palavras de 3+ letras, sem repetir, até 12. */
export function tagsDaTela(nome: string, marca: string, codigo: string): string[] {
  const tags: string[] = [];
  const add = (t: string) => { const k = chaveDe(t); if (k && !tags.includes(k)) tags.push(k); };
  for (const p of chaveDe(nome).split(" ")) if (p.length >= 3 && !PARADAS.has(p)) add(p);
  if (marca.trim()) add(marca);
  if (codigo.trim()) add(codigo.replace(/\s+/g, ""));
  // combinações modelo+motor comuns em autopeças ("hr 2.5" -> "hr 2 5" já vem quebrado; mantemos o número com o anterior)
  const partes = chaveDe(nome).split(" ");
  for (let i = 1; i < partes.length; i++) if (/^\d/.test(partes[i]) && /^[a-z]{2,}$/.test(partes[i - 1])) add(`${partes[i - 1]} ${partes[i]}`);
  return tags.slice(0, 12);
}

export function sugerir(r: Reconhecimento): { sugestoes: Sugestao[]; pendencias: Pendencia[] } {
  if (r.estado !== "reconhecida") return { sugestoes: [], pendencias: [] };
  const valor = (c: string) => r.casados.find((x) => x.mapa.canonico === c)?.lido.valor ?? "";
  const sugestoes: Sugestao[] = [];
  const pendencias: Pendencia[] = [];
  const tagsCampo = r.casados.find((x) => x.mapa.canonico === "tags");
  if (tagsCampo && !tagsCampo.lido.valor.trim()) {
    const tags = tagsDaTela(valor("nome"), valor("marca"), valor("codigo"));
    if (tags.length) sugestoes.push({ campo: "tags", valor: tags.join(", "), origem: "Nome, marca e código já cadastrados nesta tela", aplicavel: false });
  }
  for (const v of r.vazios) {
    if (!v.mapa.editavelPeloNano || v.mapa.canonico === "tags") continue;
    pendencias.push({ campo: v.mapa.descricao, canonico: v.mapa.canonico, motivo: ["gtin", "pesoLiquido", "pesoBruto", "largura", "altura", "profundidade"].includes(v.mapa.canonico)
      ? "Vazio. Precisa de fonte verificável (fabricante, embalagem, catálogo) — o Nano não inventa."
      : "Vazio. O Nano pode propor com fonte, para você aprovar." });
  }
  return { sugestoes, pendencias };
}
