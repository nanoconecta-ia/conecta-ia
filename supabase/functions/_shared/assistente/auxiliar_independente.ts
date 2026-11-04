// Auxiliar independente do OpenRouter para perguntas estritamente PUBLICAS.
// Reutiliza o chat Nano; nao recebe historico, loja, ERP, ferramentas nem anexos.
// So pode ser habilitado quando a loja configurou explicitamente um segundo
// provedor de cota gratuita e aprovou o failover. Sem retries em cascata.
import { conversar, IaErro } from "../ia/claude.ts";
import { perguntaPublica } from "./fallback_free.ts";

export const AUXILIAR_PROVEDOR = "compativel_openai" as const;
export const AUXILIAR_HOSTS = ["api.groq.com", "api.cerebras.ai"] as const;
export interface CandidatoAuxiliar {
  provedor: string; ativa: boolean; failover: boolean;
  base_url: string | null; modelo: string | null;
}
export interface ContextoTrocaAuxiliar {
  origem: string; erro: unknown; iniciouChamadaProvedor: boolean;
  consentimento: boolean; texto: unknown; anexos: number;
  textoTransmitido: boolean; tentativasFerramenta: number; propostasCriadas: number;
}

export function urlAuxiliarPermitida(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password &&
      !u.search && !u.hash && !u.port && AUXILIAR_HOSTS.includes(u.hostname as typeof AUXILIAR_HOSTS[number]) &&
      ((u.hostname === "api.groq.com" && /^\/openai\/v1\/?$/.test(u.pathname)) ||
       (u.hostname === "api.cerebras.ai" && /^\/v1\/?$/.test(u.pathname)));
  } catch { return false; }
}

export function podeTrocarParaAuxiliar(c: ContextoTrocaAuxiliar, k: CandidatoAuxiliar | null): boolean {
  return c.origem === "openrouter_free" && c.iniciouChamadaProvedor &&
    c.consentimento && c.anexos === 0 && !c.textoTransmitido &&
    c.tentativasFerramenta === 0 && c.propostasCriadas === 0 &&
    c.erro instanceof IaErro && [429, 502, 504].includes(c.erro.status) &&
    perguntaPublica(c.texto) && k?.provedor === AUXILIAR_PROVEDOR &&
    k.ativa === true && k.failover === true &&
    typeof k.modelo === "string" && k.modelo.length > 0 && k.modelo.length <= 120 &&
    urlAuxiliarPermitida(k.base_url);
}

export interface RespostaAuxiliar { texto: string; modelo: string; tokens: number; provedor: typeof AUXILIAR_PROVEDOR }
export async function executarAuxiliarPublico(p: {
  texto: string; baseUrl: string; modelo: string; chave: string; fetch?: typeof fetch;
}): Promise<RespostaAuxiliar | null> {
  // Nova checagem na borda: o executor nao deve confiar apenas no roteador.
  if (!perguntaPublica(p.texto) || !urlAuxiliarPermitida(p.baseUrl) ||
      !p.modelo || p.modelo.length > 120 || !p.chave) return null;
  try {
    const r = await conversar({
      provedor: AUXILIAR_PROVEDOR, baseUrl: p.baseUrl, chave: p.chave,
      modelo: p.modelo, mensagens: [{ role: "user", content: p.texto }],
      sistema: "Glossario publico de mecanica diesel. Responda em portugues do Brasil, ate 90 palavras. Sem historico, ERP, clientes, marcas de lojas, precos, SKU, estoque ou afirmacoes de compatibilidade. Nao invente fontes.",
      ferramentas: [], executar: async () => { throw new Error("Ferramentas proibidas."); },
      maxPassos: 1, maxTokens: 200, fetch: p.fetch,
    });
    if (!r.completa || !r.texto.trim() || r.ferramentasUsadas.length > 0) return null;
    return { texto: r.texto.trim().slice(0, 1000), modelo: r.modelo ?? p.modelo, tokens: r.tokens, provedor: AUXILIAR_PROVEDOR };
  } catch { return null; }
}
