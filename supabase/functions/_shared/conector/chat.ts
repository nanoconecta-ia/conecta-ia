// Turno de chat do Nano.ia: persistência, escolha/troca de modelo, memória e estado operacional, ferramentas pelo Policy Engine,
// eventos para a esfera/streaming. Puro e injetável (portas); a Edge Function conector-chat só liga as portas ao Supabase.
// O estado pertence ao Conecta.IA: trocar GPT/Gemini/Claude não apaga conversa, tarefa, proposta nem auditoria.
import { conversar, IaErro, type Mensagem } from "../ia/claude.ts";
import type { Chamada, Passo, ProvedorId } from "../ia/adaptadores.ts";
import { despachar, ferramentasParaLlm, type ContextoDespacho } from "./despacho.ts";
import { buscarDefinicao, idDoNomeLlm } from "./registro.ts";
import { montarSistema, PROMPT_PADRAO, type ItemConhecimento, type PropostaPendente, type TarefaAberta } from "./prompts.ts";

export type EstadoAgente = "ocioso" | "escutando" | "interpretando" | "consultando_ferramentas" | "pesquisando_fontes" | "preparando_proposta"
  | "aguardando_aprovacao" | "executando" | "sincronizando_bling" | "concluido" | "erro" | "bloqueado";
export type NomeEvento = "conversa" | "estado" | "texto" | "ferramenta_inicio" | "ferramenta_fim" | "proposta" | "uso" | "aviso" | "erro" | "fim";
export interface EventoChat { evento: NomeEvento; dados: Record<string, unknown> }

export interface ProvedorAtivo { provedor: ProvedorId; chave: string; modelo: string; baseUrl?: string; limite: number | null; tokensMes: number; principal: boolean }
export interface ConversaSalva { id: string; titulo: string; provedor: string | null; modelo: string | null }
export interface PortasChat {
  provedores(): Promise<ProvedorAtivo[]>;
  conversa(id: string): Promise<ConversaSalva | null>;
  criarConversa(titulo: string, provedor: string, modelo: string): Promise<string>;
  historico(conversaId: string, limite: number): Promise<Mensagem[]>;
  gravarMensagem(conversaId: string, papel: "user" | "assistant", texto: string, meta?: { provedor?: string; modelo?: string; tokens?: number; promptVersao?: number | null }): Promise<void>;
  registrarUso(provedor: string, tokens: number): Promise<void>;
  promptAtivo(): Promise<{ texto: string; versao: number | null }>;
  estadoOperacional(): Promise<{ tarefas: TarefaAberta[]; propostas: PropostaPendente[] }>;
  conhecimento(texto: string): Promise<ItemConhecimento[]>;
  contexto(conversaId: string): ContextoDespacho | Promise<ContextoDespacho>;
  nomeLoja(): string;
  /** Adaptador com streaming do provedor (undefined = sem streaming; o texto sai por bloco de resposta). */
  adaptadorStream?(p: ProvedorId): ((c: Chamada, m: Mensagem[], aoTexto: (d: string) => void, s?: AbortSignal) => Promise<Passo>) | undefined;
  fetch?: typeof fetch;
}
export interface PedidoTurno { texto: string; conversaId?: string; provedor?: ProvedorId; modelo?: string; fallback?: boolean }

const MAX_TEXTO = 4000, MAX_HISTORICO = 20;
const FALHAS_QUE_PERMITEM_FALLBACK = new Set([401, 429, 502, 504]);

/** Estado da esfera para cada tipo de ferramenta: reflete o que o servidor está de fato fazendo. */
export function estadoParaFerramenta(id: string): EstadoAgente {
  if (id.startsWith("conhecimento.") || id.includes("buscar_web") || id.startsWith("conecta.plugins.") || id.startsWith("engenharia.oem") || id.startsWith("engenharia.cruzados")) return "pesquisando_fontes";
  if (id.includes("preparar") || id.includes("propor") || id === "conecta.proposta.criar") return "preparando_proposta";
  return "consultando_ferramentas";
}

const resumo = (r: { ok: boolean; erro?: string; resultado?: unknown }) => {
  const t = r.ok ? JSON.stringify(r.resultado ?? null) : String(r.erro ?? "falhou");
  return t.length > 200 ? t.slice(0, 200) + "…" : t;
};

export async function executarTurno(pedido: PedidoTurno, portas: PortasChat, emitir: (e: EventoChat) => void, sinal?: AbortSignal): Promise<void> {
  const e = (evento: NomeEvento, dados: Record<string, unknown> = {}) => emitir({ evento, dados });
  const estado = (s: EstadoAgente) => e("estado", { estado: s });
  try {
    estado("interpretando");
    const texto = (pedido.texto ?? "").trim();
    if (!texto) { e("erro", { mensagem: "Escreva sua mensagem." }); estado("erro"); return; }
    if (texto.length > MAX_TEXTO) { e("erro", { mensagem: `Mensagem grande demais (máximo ${MAX_TEXTO} caracteres).` }); estado("erro"); return; }

    const ativos = await portas.provedores();
    if (ativos.length === 0) { e("erro", { mensagem: "Nenhum provedor de IA ativo. Cadastre uma chave em Integrações de IA para conversar com o Nano.ia." }); estado("erro"); return; }

    let conv: ConversaSalva | null = null;
    if (pedido.conversaId) {
      conv = await portas.conversa(pedido.conversaId);
      if (!conv) { e("erro", { mensagem: "Conversa não encontrada." }); estado("erro"); return; }
    }
    const desejado = pedido.provedor ?? (conv?.provedor as ProvedorId | null) ?? undefined;
    const escolhido = desejado ? ativos.find((p) => p.provedor === desejado) : ativos[0];
    if (!escolhido) { e("erro", { mensagem: `O provedor escolhido não tem chave ativa. Ativos: ${ativos.map((p) => p.provedor).join(", ")}.` }); estado("erro"); return; }
    const candidatos = [escolhido, ...(pedido.fallback === false ? [] : ativos.filter((p) => p !== escolhido))];
    const modeloPara = (p: ProvedorAtivo) => (p === escolhido && pedido.modelo) || p.modelo;

    // histórico ANTES de gravar a mensagem nova; memória da conversa = só texto de usuário/assistente (o resto fica no log de ferramentas)
    const anterior = conv ? await portas.historico(conv.id, MAX_HISTORICO) : [];
    let conversaId = conv?.id;
    if (!conversaId) {
      conversaId = await portas.criarConversa(texto.slice(0, 60), escolhido.provedor, modeloPara(escolhido));
      e("conversa", { id: conversaId, titulo: texto.slice(0, 60) });
    }
    await portas.gravarMensagem(conversaId, "user", texto);

    const [prompt, op, conhecimento] = await Promise.all([portas.promptAtivo().catch(() => ({ texto: PROMPT_PADRAO, versao: null })), portas.estadoOperacional().catch(() => ({ tarefas: [], propostas: [] })), portas.conhecimento(texto).catch(() => [])]);
    const sistema = montarSistema({ prompt, loja: portas.nomeLoja(), tarefas: op.tarefas, propostas: op.propostas, conhecimento });
    const ctx = await portas.contexto(conversaId);
    const mensagens: Mensagem[] = [];
    for (const m of [...anterior, { role: "user", content: texto } as Mensagem]) { // a API exige alternância user/assistant
      if (mensagens.length && mensagens[mensagens.length - 1].role === m.role) mensagens.pop();
      mensagens.push(m);
    }

    let propostaCriada = false, bloqueado = false, chamadas = 0;
    const executar = async (nome: string, entrada: unknown) => {
      const id = idDoNomeLlm(nome), n = String(++chamadas), def = buscarDefinicao(id);
      e("ferramenta_inicio", { id: n, nome: id, risco: def?.risco ?? "LOW" });
      estado(estadoParaFerramenta(id));
      const r = await despachar(id, entrada, { ...ctx, origem: "chat", conversaId });
      e("ferramenta_fim", { id: n, nome: id, decisao: r.decisao, ok: r.ok, resumo: resumo(r) });
      const res = r.resultado as Record<string, unknown> | undefined;
      if (r.ok && res && typeof res === "object" && "proposta_id" in res && "hash" in res) {
        propostaCriada = true;
        e("proposta", { id: res.proposta_id, versao: res.versao, hash: res.hash, titulo: res.titulo ?? "", risco: res.risco, itens: res.itens });
        estado("aguardando_aprovacao");
      } else if (!r.ok && /produto_travado|nada_aprovavel/.test(r.erro ?? "")) { bloqueado = true; estado("bloqueado"); }
      return r.ok ? r.resultado : { erro: r.erro, decisao: r.decisao };
    };

    let ultimoErro: unknown;
    for (const [i, p] of candidatos.entries()) {
      if (p.limite != null && p.tokensMes >= p.limite) { ultimoErro = new IaErro(429, "O limite mensal de uso da IA desta loja foi atingido. Ajuste o limite em Integrações de IA ou aguarde o próximo mês."); continue; }
      try {
        if (i > 0) e("aviso", { mensagem: "O provedor anterior falhou; respondendo com outro provedor ativo.", provedor: p.provedor });
        const r = await conversar({
          provedor: p.provedor, baseUrl: p.baseUrl, chave: p.chave, modelo: modeloPara(p), sistema, mensagens, ferramentas: ferramentasParaLlm("chat"), executar,
          aoTexto: (delta) => e("texto", { delta }), sinal, fetch: portas.fetch, maxTokens: 2048, adaptadorStream: portas.adaptadorStream?.(p.provedor),
        });
        const final = r.texto || "Não encontrei uma resposta. Pode reformular?";
        await portas.gravarMensagem(conversaId, "assistant", final, { provedor: p.provedor, modelo: modeloPara(p), tokens: r.tokens, promptVersao: prompt.versao });
        await portas.registrarUso(p.provedor, r.tokens).catch(() => {});
        e("uso", { provedor: p.provedor, modelo: modeloPara(p), tokens: r.tokens, custo_estimado: null });
        estado(propostaCriada ? "aguardando_aprovacao" : bloqueado ? "bloqueado" : "concluido");
        return;
      } catch (err) {
        if (err instanceof IaErro && err.status === 499) throw err;
        ultimoErro = err;
        if (!(err instanceof IaErro && FALHAS_QUE_PERMITEM_FALLBACK.has(err.status))) break;
      }
    }
    throw ultimoErro ?? new IaErro(502, "Nenhum provedor respondeu.");
  } catch (err) {
    if ((err instanceof IaErro && err.status === 499) || (err as Error)?.name === "AbortError") { estado("ocioso"); return; }
    e("erro", { mensagem: err instanceof IaErro ? err.message : "Não consegui responder agora." });
    estado("erro");
  } finally {
    e("fim");
  }
}
