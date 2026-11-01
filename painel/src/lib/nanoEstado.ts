// Fonte única e observável do estado do Nano.IA, por loja. Alimentada só por eventos reais (servidor SSE, fim/falha/cancelamento,
// microfone, voz, ação local executada). Assistente, cabeçalho, balão e dock leem daqui: uma esfera, um estado lógico.
import { useSyncExternalStore } from "react";
import { reduzirEstado, type EstadoAgente, type EventoEstado } from "./estadoAgente.ts";

export type EstadoNano = EstadoAgente | "falando";
export type EventoNano =
  | EventoEstado
  | { tipo: "fala"; falando: boolean }                // leitura em voz alta realmente em curso
  | { tipo: "aprovacao"; pendente: boolean }          // há proposta aguardando decisão humana (fato vindo do servidor)
  | { tipo: "local"; estado: EstadoAgente }           // ação local realmente executada pelo app (ex.: abrir tela)
  | { tipo: "repouso" };                              // nada em andamento (ex.: o chat foi fechado)

const ATIVOS_FORTES: EstadoNano[] = ["consultando_ferramentas", "pesquisando_fontes", "preparando_proposta", "executando", "sincronizando_bling", "interpretando"];

export function reduzirNano(atual: EstadoNano, e: EventoNano): EstadoNano {
  switch (e.tipo) {
    case "fala": return e.falando ? (ATIVOS_FORTES.includes(atual) || atual === "escutando" || atual === "aguardando_aprovacao" ? atual : "falando") : atual === "falando" ? "ocioso" : atual;
    case "aprovacao": return e.pendente ? "aguardando_aprovacao" : atual === "aguardando_aprovacao" ? "ocioso" : atual;
    case "local": return e.estado;
    case "repouso": return "ocioso";
    default: return reduzirEstado(atual === "falando" ? "ocioso" : atual, e);
  }
}

export interface StoreNano {
  ler(lojaId: string | null | undefined): EstadoNano;
  publicar(lojaId: string | null | undefined, e: EventoNano): void;
  assinar(f: () => void): () => void;
}

/** Cada loja tem o seu estado: trocar de loja nunca herda o estado da anterior. */
export function criarStoreNano(): StoreNano {
  const porLoja = new Map<string, EstadoNano>();
  const ouvintes = new Set<() => void>();
  const chave = (id: string | null | undefined) => id ?? "_";
  return {
    ler: (id) => porLoja.get(chave(id)) ?? "ocioso",
    publicar(id, e) {
      const k = chave(id), antes = porLoja.get(k) ?? "ocioso", depois = reduzirNano(antes, e);
      if (depois === antes) return;
      if (depois === "ocioso") porLoja.delete(k); else porLoja.set(k, depois);
      ouvintes.forEach((f) => f());
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  };
}

export const storeNano = criarStoreNano();
export const publicarNano = (lojaId: string | null | undefined, e: EventoNano) => storeNano.publicar(lojaId, e);
export function useEstadoNano(lojaId: string | null | undefined): EstadoNano {
  return useSyncExternalStore(storeNano.assinar, () => storeNano.ler(lojaId), () => "ocioso" as EstadoNano);
}
