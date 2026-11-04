// Controle preventivo de APIs free. Nunca interpreta teto local como franquia externa.
// O RPC existente incrementa atomica e transversalmente entre Edge Functions por loja/conta.
// Janela diaria precisa de retenção >= 24h na limpeza do banco (migration separada).
import { IaErro } from "../ia/claude.ts";
import { perguntaPublica } from "./fallback_free.ts";

type ReservaRpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
export type PlanoLivre = "groq" | "openrouter" | "outro";
export type PerfilUso = { plano: PlanoLivre; reduzido: boolean; chamadas: readonly { janelaS: number; max: number; tipo: string }[]; estimativa: number };

export function saudacaoSemIA(texto: unknown): string | null {
  if (typeof texto !== "string" || texto.length > 45 || /[\r\n\t0-9@:/\\]/.test(texto)) return null;
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[!.?]+$/, "");
  if (!/^(oi|ola|bom dia|boa tarde|boa noite|alo|e ai)$/.test(t)) return null;
  return "Olá! Sou o Nano.IA. Para conferir um produto sem gastar tokens, digite /ficha seguido do SKU (por exemplo, /ficha CI000016). Para revisar: /revisar SKU. As consultas ao Bling exigem confirmação das evidências.";
}
export function consultaPublicaEconomica(texto: unknown, anexos = 0): boolean {
  return anexos === 0 && perguntaPublica(texto);
}
export const PROMPT_PUBLICO_ECONOMICO = "Glossário público de mecânica diesel. Responda em português do Brasil em até 90 palavras, apenas conceito geral, sem consultar ERP, sem recomendar SKU, preço, fornecedor, cliente, dado fiscal ou afirmar aplicação veicular. Se não souber, diga que não sabe.";

export function planoLimites(provedor: string, baseUrl: string | null | undefined, economico: boolean): PerfilUso {
  if (provedor === "openrouter_free") return {
    plano: "openrouter", reduzido: economico,
    // A reserva por minuto é atômica no banco.
    // O saldo DIÁRIO é consultado diretamente no /api/v1/key (a limpeza da tabela local vence em 2h).
    chamadas: [{ tipo: "rpm", janelaS: 60, max: 16 }],
    estimativa: economico ? 650 : 5000,
  };
  if (provedor === "compativel_openai" && /^https:\/\/api\.groq\.com\/openai\/v1\/?$/.test(baseUrl ?? "")) return {
    plano: "groq", reduzido: economico,
    // 8k TPM no modelo gratuito: duas chamadas curtas podem já atingir TPM.
    // Limitador de requisições é preventivo, NÃO substitui um limitador ponderado de tokens.
    chamadas: [{ tipo: "rpm", janelaS: 60, max: 2 }],
    estimativa: economico ? 650 : 5000,
  };
  return { plano: "outro", reduzido: false, chamadas: [], estimativa: 0 };
}

/** Falha fechada em erro de RPC: não arrisca consumir a chave nem forja disponibilidade. */
export async function reservarPassoLivre(
  admin: ReservaRpc, lojaId: string, perfil: PerfilUso, usados: number,
  teto: number | null, usadosNesteTurno: number,
): Promise<void> {
  if (perfil.plano === "outro") return;
  if (teto != null && Number.isFinite(teto) &&
      usados + usadosNesteTurno + perfil.estimativa > teto)
    throw new IaErro(429, "Saldo preventivo do teto mensal interno insuficiente. Use a ficha sem IA ou aguarde a renovação.");
  for (const p of perfil.chamadas) {
    const { data, error } = await admin.rpc("limite_chamada", {
      p_chave: `nano:free:${perfil.plano}:${p.tipo}:${lojaId}`,
      p_max: p.max, p_janela_s: p.janelaS,
    });
    if (error || data !== true)
      throw new IaErro(429, p.tipo === "rpd"
        ? "Limite preventivo diário das chamadas gratuitas. Use os recursos sem IA."
        : "Limite preventivo de chamadas por minuto. Aguarde a próxima janela.");
  }
}

/** Consulta a cota diária do OpenRouter sem usar endpoint de inferência.
 * Não registra chave, corpo ou rótulo da conta. Em falha, devolve null (não inventa saldo).
 */
export async function restanteDiarioOpenRouter(chave: string, f: typeof fetch = fetch): Promise<number | null> {
  if (!/^sk-or-v1-[A-Za-z0-9_-]{15,}$/.test(chave)) return null;
  try {
    const r = await f("https://openrouter.ai/api/v1/key", {
      method: "GET", redirect: "manual",
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const n = j?.data?.free_model_daily_requests?.remaining;
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  } catch { return null; }
}
