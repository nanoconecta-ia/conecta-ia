// Converte mensagens salvas (formato canônico: blocos text / tool_use / tool_result) nos itens da tela. Puro e testável.
import type { Risco } from "./chat.ts";

export type ItemChat =
  | { k: "user"; id: string; texto: string }
  | { k: "ia"; id: string; texto: string; modelo?: string | null; provedor?: string | null }
  | { k: "ferramenta"; id: string; nome: string; risco?: Risco; decisao?: string; ok?: boolean; resumo?: string; rodando: boolean }
  | { k: "proposta"; id: string; propostaId: string; versao: number; hash: string; titulo: string; risco: Risco }
  | { k: "aviso"; id: string; texto: string }
  | { k: "erro"; id: string; texto: string };

interface Salva { id: string; papel: string; conteudo: unknown; provedor?: string | null; modelo?: string | null }
type Bloco = { type?: string; text?: string; id?: string; name?: string; tool_use_id?: string; content?: unknown; is_error?: boolean };

const resumir = (c: unknown): string => {
  const t = typeof c === "string" ? c : JSON.stringify(c ?? "");
  return t.length > 160 ? t.slice(0, 157) + "…" : t;
};

export function mensagensParaItens(msgs: Salva[]): ItemChat[] {
  const itens: ItemChat[] = [];
  const porUso = new Map<string, number>();
  for (const m of msgs) {
    const blocos: Bloco[] = typeof m.conteudo === "string" ? [{ type: "text", text: m.conteudo }] : Array.isArray(m.conteudo) ? (m.conteudo as Bloco[]) : [];
    for (const [n, b] of blocos.entries()) {
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        if (m.papel === "user") itens.push({ k: "user", id: `${m.id}:${n}`, texto: b.text });
        else if (m.papel === "assistant") itens.push({ k: "ia", id: `${m.id}:${n}`, texto: b.text, modelo: m.modelo, provedor: m.provedor });
      } else if (b.type === "tool_use" && b.name) {
        porUso.set(b.id ?? `${m.id}:${n}`, itens.length);
        itens.push({ k: "ferramenta", id: b.id ?? `${m.id}:${n}`, nome: b.name, rodando: false });
      } else if (b.type === "tool_result" && b.tool_use_id) {
        const i = porUso.get(b.tool_use_id);
        const alvo = i === undefined ? undefined : itens[i];
        if (alvo?.k === "ferramenta") { alvo.ok = !b.is_error; alvo.resumo = resumir(b.content); }
      }
    }
  }
  return itens;
}

/** Título curto a partir da primeira mensagem (o servidor pode renomear depois). */
export const tituloDe = (texto: string) => { const t = texto.replace(/\s+/g, " ").trim(); return t.length > 60 ? t.slice(0, 57) + "…" : t || "Nova conversa"; };

export function agruparPorProjeto<T extends { projeto: string | null }>(itens: T[]): { projeto: string | null; itens: T[] }[] {
  const m = new Map<string | null, T[]>();
  for (const i of itens) m.set(i.projeto, [...(m.get(i.projeto) ?? []), i]);
  return [...m.entries()].sort((a, b) => (a[0] === null ? -1 : b[0] === null ? 1 : a[0].localeCompare(b[0], "pt-BR"))).map(([projeto, itens]) => ({ projeto, itens }));
}
