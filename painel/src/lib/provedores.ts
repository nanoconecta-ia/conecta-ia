import { erroDoChat } from "./recuperacaoSemIa.ts";
export type ProvedorChat = "claude" | "gemini" | "compativel_openai" | "openrouter_free";
export type OpcaoProvedor = { id: ProvedorChat; nome: string; modelo: string | null; estado: "disponivel" | "nao_configurado" | "indisponivel"; motivo: string; principal: boolean; modo?: "desligado" | "manual" | "automatico" };
export const ESTADO_PROVEDOR = { disponivel: "Disponível", nao_configurado: "Não configurado", indisponivel: "Indisponível" };
export function escolherInicial(opcoes: OpcaoProvedor[]): ProvedorChat | "" {
  return opcoes.find((p) => p.principal && p.estado === "disponivel")?.id
    ?? opcoes.find((p) => p.estado === "disponivel")?.id ?? "";
}
export async function erroAssistente(error: unknown): Promise<string> {
  try { const j = await (error as { context?: Response }).context?.json(); if (typeof j?.erro === "string") return j.erro; } catch { /* mensagem segura */ }
  return "Não consegui responder agora. Tente novamente ou escolha outro provedor.";
}

/** Preserva categorias tanto no HTTP comum quanto no streaming. */
export async function falhaAssistente(error: unknown): Promise<Error> {
  try {
    const contexto = (error as { context?: Response }).context;
    if (contexto) return erroDoChat(await contexto.clone().json());
  } catch { /* servidor sem corpo JSON */ }
  return new Error("Não consegui responder agora. Tente novamente ou escolha outro provedor.");
}
