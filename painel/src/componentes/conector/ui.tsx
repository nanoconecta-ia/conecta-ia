import type { Risco } from "../../lib/chat.ts";
import { ROTULO_ITEM, ROTULO_PROPOSTA, ROTULO_RISCO, type EstadoItem, type EstadoProposta } from "../../lib/propostas.ts";

const CLASSE_RISCO: Record<Risco, string> = { LOW: "ok", MEDIUM: "", HIGH: "atencao", CRITICAL: "erro" };
export const SeloRisco = ({ risco }: { risco: Risco }) => <span className={`selo ${CLASSE_RISCO[risco]}`}>Risco {ROTULO_RISCO[risco].toLowerCase()}</span>;

const CLASSE_PROP: Partial<Record<EstadoProposta, string>> = { aprovada: "ok", executada: "ok", pendente: "atencao", parcial: "atencao", rejeitada: "erro", falhou: "erro", expirada: "erro", invalidada: "" };
export const SeloProposta = ({ estado }: { estado: EstadoProposta }) => <span className={`selo ${CLASSE_PROP[estado] ?? ""}`}>{ROTULO_PROPOSTA[estado]}</span>;

const CLASSE_ITEM: Partial<Record<EstadoItem, string>> = { confirmado: "ok", aprovado: "ok", travado: "atencao", desconhecido: "atencao", falhou: "erro" };
export const SeloItem = ({ estado }: { estado: EstadoItem }) => <span className={`selo ${CLASSE_ITEM[estado] ?? ""}`}>{ROTULO_ITEM[estado]}</span>;

export const hashCurto = (h: string | null) => (h ? h.slice(0, 8) : "—");
export const dataBr = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const nomeModelo = (provedor: string | null) => (provedor === "claude" ? "Claude" : provedor === "gemini" ? "Gemini" : provedor === "compativel_openai" || provedor === "openai" ? "GPT / compatível OpenAI" : provedor ?? "—");
export const alvoOperacao = (op: string) => (op.startsWith("bling.") ? "Bling (simulado nesta fase)" : "Conecta.IA");
