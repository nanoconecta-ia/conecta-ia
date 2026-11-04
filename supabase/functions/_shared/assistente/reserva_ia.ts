// Reserva independente: uma única tentativa, só leitura, sem histórico/anexos e com consentimento por sessão.
import { IaErro } from "../ia/tipos.ts";
export const URL_GROQ = "https://api.groq.com/openai/v1";
export function enderecoReserva(base: unknown): boolean {
  return typeof base === "string" && base.replace(/\/$/, "") === URL_GROQ;
}
export function configuracaoReserva(k: any) {
  const disponivel = k?.provedor === "compativel_openai" && k.ativa === true && enderecoReserva(k.base_url) && typeof k.modelo === "string" && k.modelo.trim().length > 0;
  return { provedor: "compativel_openai", nome: "Groq", host: "api.groq.com", disponivel,
    motivo: disponivel ? "Configurada; disponibilidade será confirmada na chamada." : "Cadastre uma chave do Groq em Integrações de IA, no provedor compatível com OpenAI." };
}
export function podeUsarReserva(e: { provedor: string; erro: unknown; consentimento: boolean; iniciou: boolean; cotaConhecida: boolean; anexos: number; textoTransmitido: boolean; tentativas: number; propostas: number }): boolean {
  return e.provedor === "openrouter_free" && e.consentimento && (e.iniciou || e.cotaConhecida)
    && e.anexos === 0 && !e.textoTransmitido && e.tentativas === 0 && e.propostas === 0
    && e.erro instanceof IaErro && [429, 502, 504].includes(e.erro.status);
}
