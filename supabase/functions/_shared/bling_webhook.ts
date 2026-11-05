// Webhook do Bling -> espelho (SOMENTE LEITURA do Bling; só escreve no banco do Conecta.IA).
// Lógica pura sobre portas: testável sem Supabase nem rede. Desenho: docs/conector-ia/DESENHO_WEBHOOK_BLING.md.
// Regras da documentação do Bling (developer.bling.com.br/webhooks): HMAC-SHA256 do corpo com o client_secret em
// `X-Bling-Signature-256: sha256=<hex>`; responder 2xx em até 5 s; entrega duplicada e fora de ordem; excluir um
// produto chega como `updated` (situacao E); só `deleted` apaga de vez. Custo e fornecedor nunca entram aqui.
import { mapearProduto, resumirExcluido, type Detalhe, type Existente, type LinhaProduto } from "./bling_sync.ts";

export const EVENTOS_ACEITOS = ["product.created", "product.updated", "product.deleted", "stock.created", "stock.updated", "stock.deleted"] as const;
export type NomeEvento = (typeof EVENTOS_ACEITOS)[number];
export const TAMANHO_MAX_CORPO = 64 * 1024;
export const MAX_TENTATIVAS = 8;

export interface EventoBling { eventId: string; date: string; version: string; event: NomeEvento; companyId: string; data: Record<string, unknown> }
export interface LinhaFila {
  tipo: "produto" | "estoque" | "inativacao"; bling_id: string; versao_origem: string; chave_idempotencia: string;
  payload: { evento: NomeEvento; situacao?: string };
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

function iguais(a: string, b: string): boolean { // tempo constante
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Confere `X-Bling-Signature-256` contra o HMAC-SHA256 do corpo CRU com o client_secret da loja. */
export async function assinaturaValida(corpoCru: string, cabecalho: string | null, segredo: string): Promise<boolean> {
  if (!cabecalho || !segredo || !cabecalho.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = hex(await crypto.subtle.sign("HMAC", chave, enc.encode(corpoCru)));
  return iguais(esperado, cabecalho.slice("sha256=".length).toLowerCase());
}

const idBling = (v: unknown): string | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? String(v) : typeof v === "string" && /^\d{1,20}$/.test(v) ? v : null);

/** Valida o formato do evento. Não confia em nada do corpo antes da assinatura ser conferida pelo chamador. */
export function lerEvento(corpoCru: string): { ok: true; evento: EventoBling } | { ok: false; motivo: string } {
  if (corpoCru.length > TAMANHO_MAX_CORPO) return { ok: false, motivo: "corpo grande demais" };
  let j: unknown;
  try { j = JSON.parse(corpoCru); } catch { return { ok: false, motivo: "JSON inválido" }; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { ok: false, motivo: "formato inválido" };
  const o = j as Record<string, unknown>;
  const { eventId, date, version, event, companyId, data } = o;
  if (typeof eventId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(eventId)) return { ok: false, motivo: "eventId inválido" };
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) return { ok: false, motivo: "date inválida" };
  if (typeof companyId !== "string" || !/^[A-Za-z0-9]{8,64}$/.test(companyId)) return { ok: false, motivo: "companyId inválido" };
  if (typeof event !== "string" || !(EVENTOS_ACEITOS as readonly string[]).includes(event)) return { ok: false, motivo: "evento não tratado" };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, motivo: "data inválido" };
  return { ok: true, evento: { eventId, date, version: typeof version === "string" ? version : "v1", event: event as NomeEvento, companyId, data: data as Record<string, unknown> } };
}

/** Evento -> linha da fila `sync_eventos` (origem 'webhook'). Guarda só o mínimo; o dado vem do Bling na hora de aplicar. */
export function eventoParaFila(e: EventoBling): LinhaFila | null {
  const produto = e.event.startsWith("product.");
  const id = idBling(produto ? e.data.id : (e.data.produto as Record<string, unknown> | undefined)?.id);
  if (!id) return null;
  const situacao = produto && typeof e.data.situacao === "string" ? e.data.situacao.slice(0, 2) : undefined;
  return {
    tipo: !produto ? "estoque" : e.event === "product.deleted" ? "inativacao" : "produto",
    bling_id: id, versao_origem: new Date(e.date).toISOString(), chave_idempotencia: e.eventId,
    payload: { evento: e.event, ...(situacao ? { situacao } : {}) },
  };
}

export interface EventoPendente { id: string; tipo: LinhaFila["tipo"]; bling_id: string; versao_origem: string | null; tentativas: number; payload: LinhaFila["payload"] | null }
export interface PortasWebhook {
  /** GET /produtos/{id}: `null` quando o Bling não devolve o detalhe (404) e `"erro"` em falha transitória (429/5xx/rede). */
  detalhe(id: number): Promise<Detalhe | null | "erro">;
  existente(blingId: string): Promise<Existente | undefined>;
  gravar(linha: LinhaProduto): Promise<void>;
  marcarExcluido(blingId: string, agoraISO: string): Promise<void>;
  agora(): number;
}
export type Resultado = { status: "aplicado" | "ignorado"; motivo: string } | { status: "erro"; motivo: string; definitivo: boolean };

/** Aplica UM evento ao espelho. Nunca regrava com dado mais antigo e nunca escreve no Bling. */
export async function aplicarEvento(lojaId: string, ev: EventoPendente, p: PortasWebhook): Promise<Resultado> {
  const agoraISO = new Date(p.agora()).toISOString();
  const anterior = await p.existente(ev.bling_id);
  // O dado é buscado AGORA no Bling. Se o espelho já foi sincronizado depois do instante do evento, ele já o contém.
  if (anterior?.sincronizado_em && ev.versao_origem && Date.parse(anterior.sincronizado_em) > Date.parse(ev.versao_origem)) {
    return { status: "ignorado", motivo: "espelho já sincronizado depois deste evento" };
  }
  if (ev.tipo === "inativacao") {
    await p.marcarExcluido(ev.bling_id, agoraISO);
    return { status: "aplicado", motivo: "produto apagado no Bling; espelho marcado como excluído" };
  }
  const d = await p.detalhe(Number(ev.bling_id));
  if (d === "erro") return { status: "erro", motivo: "Bling indisponível ou limite atingido; tentar de novo", definitivo: ev.tentativas + 1 >= MAX_TENTATIVAS };
  if (d === null) {
    if (ev.payload?.situacao === "E") { // excluído sem detalhe: preserva o que já havia e força situação E
      await p.gravar(resumirExcluido(lojaId, { id: Number(ev.bling_id) }, anterior, agoraISO));
      return { status: "aplicado", motivo: "excluído sem detalhe: espelho marcado como excluído" };
    }
    return { status: "erro", motivo: "Bling não devolveu o produto", definitivo: ev.tentativas + 1 >= MAX_TENTATIVAS };
  }
  const linha = mapearProduto(lojaId, { id: Number(ev.bling_id), idProdutoPai: typeof d?.idProdutoPai === "number" ? d.idProdutoPai : undefined }, d, agoraISO);
  await p.gravar(linha);
  return { status: "aplicado", motivo: ev.tipo === "estoque" ? "saldo atualizado a partir do Bling" : "produto atualizado a partir do Bling" };
}

/** Espera crescente entre tentativas: 30 s, 1 min, 2 min... no máximo 1 h. */
export function proximaTentativaEm(tentativas: number, agoraMs: number): string {
  return new Date(agoraMs + Math.min(30_000 * 2 ** Math.max(0, tentativas), 3_600_000)).toISOString();
}

/** Disjuntor: o Bling bloqueia o IP com 300 erros em 10 s; antes disso, paramos de chamar. */
export const LIMITE_FALHAS_SEGUIDAS = 5;
export const disjuntorAberto = (falhasSeguidas: number): boolean => falhasSeguidas >= LIMITE_FALHAS_SEGUIDAS;

/** Agrupa pendentes do mesmo produto: uma busca só por `bling_id`; os demais viram "ignorado" com o mesmo resultado. */
export function agruparPorProduto<T extends { bling_id: string }>(pendentes: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of pendentes) (m.get(e.bling_id) ?? m.set(e.bling_id, []).get(e.bling_id)!).push(e);
  return m;
}
