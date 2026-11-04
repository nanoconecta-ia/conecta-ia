// LEGADO (a aposentar): contingencia GRATIS so para perguntas PUBLICAS (glossario), com consentimento por pergunta e a chave antiga "freellm".
// Hoje o caminho principal e o provedor `openrouter_free` (free_automatico.ts: modo Desligado/Manual/Automatico, so leitura, com ferramentas saneadas).
// Em chat.ts este modulo so roda DEPOIS de o automatico nao ter respondido. Remover junto com o consentimento da UI (Assistente.tsx) quando o dono decidir;
// ver docs/conector-ia/DIAGNOSTICO_IA.md. Nao ha segundo roteador: a decisao de quem responde e unica, em chat.ts.
// Nano.IA: contingencia de inferencia GRATIS apenas para perguntas PUBLICAS, sem contexto de loja.
// Nao reutiliza memoria/conversas, anexos, ferramentas, dados de ERP nem prompt comercial.
// OpenRouter free seleciona modelo gratuito; sem chave/allowlist/consentimento, NAO existe chamada de rede.
import { conversar, IaErro } from "../ia/claude.ts";
import type { Resposta } from "../ia/claude.ts";

export const FALLBACK_FREE_HOST = "openrouter.ai";
export const FALLBACK_FREE_URL = "https://openrouter.ai/api/v1";
export const FALLBACK_FREE_MODELO = "openrouter/free";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// O filtro eh INTENCIONALMENTE restritivo: dados de loja nao podem ser "anonimizados"
// com regex. Somente glossario de engenharia automotiva sem IDs/numeros ou historico.
const CONSULTA = /^(?:o que (?:e|significa)|explique(?: o conceito de| o funcionamento de)?|como funciona(?:m)?(?: um| uma| o| a)?)\s+(.+?)\s*\??$/i;
const ASSUNTOS = [
  "motor diesel", "turbocompressor", "turbo", "intercooler", "bomba d agua",
  "sistema de arrefecimento", "radiador", "termostato", "valvula termostatica",
  "correia dentada", "correia de distribuicao", "correia do alternador",
  "tensor de correia", "tensores", "pistao", "aneis de pistao", "biela",
  "virabrequim", "bronzin[a]", "bronzinas", "cabecote", "valvulas", "junta de cabecote",
  "embreagem", "volante do motor", "filtro de oleo", "filtro de combustivel",
  "bomba de oleo", "bomba de combustivel", "injetor diesel",
  "sincronismo do motor", "arrefecimento do motor", "sistema de lubrificacao",
];
const SEM_ACENTO = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’\x27]/g, " ").toLowerCase().trim();
const ASSUNTOS_PERMITIDOS = new Set(ASSUNTOS.map(SEM_ACENTO));

export function perguntaPublica(texto: unknown): boolean {
  if (typeof texto !== "string" || texto.length < 12 || texto.length > 125 || /[\n\r\t]/.test(texto)) return false;
  const t = SEM_ACENTO(texto).replace(/[.!]+$/, "");
  // Dados pessoal/comercial, numero de pedido, SKU, codigo, link, e-mail, telefone, tokens.
  if (/[0-9@/:\\={}\[\]<>#$]/.test(t)) return false;
  const m = t.match(CONSULTA);
  if (!m) return false;
  const assunto = m[1].replace(/[?.,!]+$/, "").trim().replace(/\s+/g, " ");
  return ASSUNTOS_PERMITIDOS.has(assunto);
}

export type ConfigFallback = { chave: string; modelo: typeof FALLBACK_FREE_MODELO; baseUrl: typeof FALLBACK_FREE_URL };
// Adaptação transitória para a chave já registrada como "freellm" na loja piloto.
// Não converte chave de outros provedores, não habilita outras lojas e mantém consentimento no chat.
const LOJA_PILOTO_MOBIS = "cd9d7570-f095-44f2-be28-b9b9cba6578e";
export function configFallbackFree(get: (nome: string) => string | undefined, lojaId: string): ConfigFallback | null {
  if (!UUID.test(lojaId)) return null;
  const flag = get("NANO_FREE_FALLBACK_ATIVO");
  if (flag === "0") return null; // desligamento explícito sempre prevalece
  const lojasRegistradas = get("NANO_FREE_FALLBACK_LOJAS");
  const lojas = (lojasRegistradas ?? "").split(",").map(s => s.trim().toLowerCase());
  const modoPadrao = flag === "1" && lojas.includes(lojaId.toLowerCase());
  // Compatibilidade com a instalação já autorizada: um único tenant, e apenas
  // enquanto não houver configuração explícita de ativação/allowlist.
  const modoPiloto = flag === undefined && !lojasRegistradas &&
    lojaId.toLowerCase() === LOJA_PILOTO_MOBIS;
  if (!modoPadrao && !modoPiloto) return null;
  const chave = get("NANO_FREE_FALLBACK_OPENROUTER_KEY") ||
    get("freellm") || get("FREELLM");
  // A variável "freellm" pode designar outro serviço; aceitar SOMENTE chave OpenRouter.
  // Nunca enviar para openrouter.ai uma credencial de provedor diferente.
  if (!chave || !/^sk-or-v1-[A-Za-z0-9_-]{15,}$/.test(chave) || chave.length > 600) return null;
  return { chave, modelo: FALLBACK_FREE_MODELO, baseUrl: FALLBACK_FREE_URL };
}

export interface PedidoFallback {
  texto: string;
  provedor: string;
  consentimento: boolean;
  anexos: number;
  tentativasFerramenta: number;
  textoTransmitido: boolean;
  erro: unknown;
  lojaId: string;
  get(nome: string): string | undefined;
  fetch?: typeof fetch;
}
export type ResultadoFallback = { texto: string; tokens: number; modelo?: string; origem: "openrouter-free"; completo: true };

export function podeTentarFallback(p: PedidoFallback): boolean {
  if (p.provedor !== "gemini" || p.consentimento !== true || p.anexos !== 0 ||
      p.tentativasFerramenta !== 0 || p.textoTransmitido) return false;
  if (!(p.erro instanceof IaErro) || ![429, 502, 504].includes(p.erro.status)) return false;
  return perguntaPublica(p.texto) && configFallbackFree(p.get, p.lojaId) !== null;
}

/** Retorna null quando bloqueado ou quando o gratuito tambem falhou. Nunca retenta em cascata. */
export async function tentarFallbackFree(p: PedidoFallback): Promise<ResultadoFallback | null> {
  if (!podeTentarFallback(p)) return null;
  const config = configFallbackFree(p.get, p.lojaId)!;
  try {
    const r: Resposta = await conversar({
      provedor: "compativel_openai", baseUrl: config.baseUrl, chave: config.chave, modelo: config.modelo,
      sistema: "Voce e um glossario publico de mecanica diesel. Responda em portugues do Brasil em ate 90 palavras. Nao afirme consultar ERP, Bling, historico, loja ou pecas especificas. Nao faca indicacoes de SKU, preco, fornecedor, estoque, garantias ou compatibilidades. Se nao souber, diga que nao sabe.",
      mensagens: [{ role: "user", content: p.texto }], ferramentas: [],
      executar: async () => { throw new Error("Fallback sem ferramentas."); },
      maxPassos: 1, maxTokens: 200, fetch: p.fetch,
    });
    if (!r.completa || !r.texto.trim() || r.ferramentasUsadas.length) return null;
    return { texto: r.texto.trim().slice(0, 1000), tokens: r.tokens, modelo: r.modelo, origem: "openrouter-free", completo: true };
  } catch {
    // Sem log do corpo de resposta, da chave ou do prompt.
    return null;
  }
}
