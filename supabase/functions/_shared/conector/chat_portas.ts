// Portas do chat sobre o banco (cliente service_role estilo supabase-js). Tudo escopado por loja e usuário AQUI.
// Os testes rodam esta implementação sobre um Postgres local; a Edge Function conector-chat só adiciona HTTP/SSE.
import type { Mensagem } from "../ia/tipos.ts";
import type { ProvedorId } from "../ia/adaptadores.ts";
import type { ClienteDados } from "./dados.ts";
import { dadosSupabase } from "./dados.ts";
import type { ContextoDespacho } from "./despacho.ts";
import { PROMPT_PADRAO } from "./prompts.ts";
import type { PortasChat, ProvedorAtivo } from "./chat.ts";

export interface ClienteAdmin extends ClienteDados { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }> }
const SUPORTADOS: ProvedorId[] = ["claude", "gemini", "compativel_openai"];
const MODELO_PADRAO: Partial<Record<ProvedorId, string>> = { claude: "claude-sonnet-5-5", gemini: "gemini-2.5-flash" };

export interface OpcoesPortas {
  admin: ClienteAdmin; lojaId: string; userId: string; nomeLoja: string;
  decifrar(cifrada: string): Promise<string>;
  contexto(conversaId: string): ContextoDespacho | Promise<ContextoDespacho>;
  adaptadorStream?: PortasChat["adaptadorStream"];
  fetch?: typeof fetch;
}

/** Lê o resultado de uma consulta e FALHA ALTO se o banco devolveu erro (memória perdida em silêncio é pior que erro). */
function dadosDe<T>(r: { data: T | null; error?: { message: string } | null }): T | null { if (r.error) throw new Error(r.error.message); return r.data; }

const textoDe = (conteudo: unknown): string =>
  Array.isArray(conteudo) ? conteudo.filter((b: any) => b?.type === "text").map((b: any) => String(b.text)).join("\n") : typeof conteudo === "string" ? conteudo : "";

export function portasChatSupabase(o: OpcoesPortas): PortasChat {
  const { admin, lojaId, userId } = o;
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await admin.rpc(fn, args); if (error) throw new Error(error.message); return data; };
  const dados = dadosSupabase(admin, lojaId);
  return {
    nomeLoja: () => o.nomeLoja,
    adaptadorStream: o.adaptadorStream, fetch: o.fetch,
    contexto: o.contexto,
    async provedores() {
      const linhas = dadosDe(await admin.from("loja_chaves_ia").select("provedor, principal").eq("loja_id", lojaId).eq("ativa", true));
      const ordenadas = ((linhas ?? []) as { provedor: ProvedorId; principal: boolean }[]).filter((l) => SUPORTADOS.includes(l.provedor)).sort((a, b) => Number(b.principal) - Number(a.principal));
      const out: ProvedorAtivo[] = [];
      for (const l of ordenadas) {
        const k = ((await rpc("ia_chave_ativa", { p_loja: lojaId, p_provedor: l.provedor })) as any[] | null)?.[0];
        const modelo = k?.modelo ?? MODELO_PADRAO[l.provedor];
        if (!k || !modelo) continue;
        out.push({ provedor: l.provedor, chave: await o.decifrar(k.cifrada), modelo, baseUrl: k.base_url ?? undefined, limite: k.limite ?? null, tokensMes: Number(k.tokens_mes ?? 0), principal: l.principal });
      }
      return out;
    },
    async conversa(id) {
      return dadosDe(await admin.from("agente_conversas").select("id, titulo, provedor, modelo").eq("id", id).eq("loja_id", lojaId).eq("user_id", userId).maybeSingle());
    },
    criarConversa: (titulo, provedor, modelo) => rpc("agente_conversa_criar", { p_loja: lojaId, p_user: userId, p_titulo: titulo, p_provedor: provedor, p_modelo: modelo }),
    async historico(conversaId, limite) {
      const data = dadosDe(await admin.from("agente_mensagens").select("papel, conteudo, seq").eq("loja_id", lojaId).eq("conversa_id", conversaId).in("papel", ["user", "assistant"]).order("seq", { ascending: false }).limit(limite));
      return ((data ?? []) as any[]).reverse().map((m): Mensagem => ({ role: m.papel, content: textoDe(m.conteudo).slice(0, 4000) })).filter((m) => m.content);
    },
    async gravarMensagem(conversaId, papel, texto, meta) {
      await rpc("agente_mensagem_gravar", { p_loja: lojaId, p_conversa: conversaId, p_user: userId, p_papel: papel, p_conteudo: [{ type: "text", text: texto }],
        p_provedor: meta?.provedor ?? null, p_modelo: meta?.modelo ?? null, p_tokens: meta?.tokens ?? null, p_custo: null, p_prompt_versao: meta?.promptVersao ?? null });
    },
    registrarUso: (provedor, tokens) => rpc("ia_registrar_uso", { p_loja: lojaId, p_provedor: provedor, p_tokens: tokens }),
    async promptAtivo() {
      const data = dadosDe(await admin.from("agente_prompts").select("conteudo, versao, loja_id").eq("nome", "geral").eq("estado", "ativo").or(`loja_id.eq.${lojaId},loja_id.is.null`));
      const lista = (data ?? []) as { conteudo: string; versao: number; loja_id: string | null }[];
      const p = lista.find((x) => x.loja_id) ?? lista[0];
      return p ? { texto: p.conteudo, versao: p.versao } : { texto: PROMPT_PADRAO, versao: null };
    },
    async estadoOperacional() {
      const t = await admin.from("agente_tarefas").select("objetivo, estado").eq("loja_id", lojaId).in("estado", ["planejando", "aguardando_aprovacao", "executando", "verificando", "bloqueada"]).order("atualizado_em", { ascending: false }).limit(5);
      const p = await admin.from("agente_propostas").select("titulo, versao, estado, risco").eq("loja_id", lojaId).in("estado", ["pendente", "aprovada", "executando", "parcial", "falhou"]).order("criado_em", { ascending: false }).limit(5);
      return { tarefas: dadosDe(t) ?? [], propostas: dadosDe(p) ?? [] };
    },
    conhecimento: (texto) => dados.buscarConhecimento(texto, undefined, 5) as Promise<any[]>,
  };
}
