export type ProvedorChat = "claude" | "gemini" | "compativel_openai";
export type OpcaoProvedor = { id: ProvedorChat; nome: string; modelo: string | null; estado: "disponivel" | "nao_configurado" | "indisponivel"; motivo: string; principal: boolean };
export const ESTADO_PROVEDOR = { disponivel: "Disponível", nao_configurado: "Não configurado", indisponivel: "Indisponível" };
export function escolherInicial(opcoes: OpcaoProvedor[]): ProvedorChat | "" {
  return opcoes.find((p) => p.principal && p.estado === "disponivel")?.id
    ?? opcoes.find((p) => p.estado === "disponivel")?.id ?? "";
}
export async function erroAssistente(error: unknown): Promise<string> {
  try { const j = await (error as { context?: Response }).context?.json(); if (typeof j?.erro === "string") return j.erro; } catch { /* mensagem segura */ }
  return "Não consegui responder agora. Tente novamente ou escolha outro provedor.";
}
