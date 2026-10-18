// Metadados públicos; nunca recebe nem devolve o segredo cifrado.
import { urlPublicaSegura } from "../ia/plugin.ts";

export const PROVEDORES_CHAT = ["compativel_openai", "gemini", "claude"] as const;
export type ProvedorChat = typeof PROVEDORES_CHAT[number];
export type EstadoProvedor = "disponivel" | "nao_configurado" | "indisponivel";
export interface ChavePublica {
  provedor: string; ativa: boolean; principal: boolean; modelo: string | null; base_url: string | null;
  limite_mensal_tokens: number | null; tokens_mes: number; mes_ref: string;
}

export function validarProvedor(valor: unknown): ProvedorChat | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !PROVEDORES_CHAT.includes(valor as ProvedorChat)) throw new Error("Provedor inválido.");
  return valor as ProvedorChat;
}

export function modeloDaChave(k: { provedor: string; modelo: string | null }): string {
  return k.modelo || (k.provedor === "gemini" ? "gemini-2.5-flash" : k.provedor === "claude" ? "claude-sonnet-5-5" : "");
}

export function nomeProvedor(id: string, base?: string | null): string {
  if (id === "gemini") return "Gemini";
  if (id === "claude") return "Claude";
  if (!base) return "GPT";
  try {
    const u = new URL(base);
    if (u.origin === "https://api.openai.com" && /^\/v1\/*$/.test(u.pathname)) return "GPT";
    return `Compatível OpenAI (${u.hostname})`;
  } catch { return "Compatível OpenAI"; }
}

export function listarProvedores(chaves: ChavePublica[], falha = false, agora = new Date()) {
  const mes = agora.toISOString().slice(0, 7);
  return PROVEDORES_CHAT.map((id) => {
    const k = chaves.find((c) => c.provedor === id);
    let estado: EstadoProvedor = !k || !k.ativa ? "nao_configurado" : "disponivel";
    let motivo = "";
    if (falha) { estado = "indisponivel"; motivo = "Não foi possível consultar a configuração."; }
    else if (k?.ativa) {
      if (!modeloDaChave(k) || (id === "compativel_openai" && (!k.base_url || !urlPublicaSegura(k.base_url)))) {
        estado = "indisponivel"; motivo = "Configuração incompleta.";
      } else if (k.mes_ref?.slice(0, 7) === mes && k.limite_mensal_tokens != null && k.tokens_mes >= k.limite_mensal_tokens) {
        estado = "indisponivel"; motivo = "Limite mensal atingido.";
      }
    }
    return { id, nome: nomeProvedor(id, k?.base_url), estado, motivo, modelo: k ? modeloDaChave(k) : null, principal: k?.principal === true };
  });
}
