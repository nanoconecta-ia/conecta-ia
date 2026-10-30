// Chat do Nano.ia (SSE). NÃO IMPLANTADA nesta fase. verify_jwt = true. Contrato: docs/conector-ia/api-contratos.md.
// Escolha de modelo por conversa, memória persistente, ferramentas pelo Policy Engine, streaming de eventos, cancelamento pelo cliente.
import { executarTurno, type EventoChat } from "../_shared/conector/chat.ts";
import { portasChatSupabase } from "../_shared/conector/chat_portas.ts";
import { dadosSupabase } from "../_shared/conector/dados.ts";
import { ADAPTADORES_STREAM } from "../_shared/ia/adaptadores_stream.ts";
import { autenticar, blingLeitura, CORS, decifrarComChaveiro, json } from "../_shared/conector/edge.ts";
import type { PluginRegistro } from "../_shared/ia/plugin.ts";

Deno.serve(async (req) => {
  const c = await req.clone().json().catch(() => ({}));
  const s = await autenticar(req, c?.loja_id);
  if (s instanceof Response) return s;
  let decifrar;
  try { decifrar = await decifrarComChaveiro(s); } catch { return json({ erro: "Conexão de IA ainda não configurada no servidor." }, 503); }
  const bling = await blingLeitura(s);
  const { data: plugs } = await s.admin.from("loja_plugins").select("id, nome, tipo, url, capacidades, risco, ativo").eq("loja_id", s.lojaId);
  const { data: biRows } = await s.admin.rpc("busca_imagem_ler", { p_loja: s.lojaId });
  const bi = (biRows as { api_key_cifrada: string; cx: string }[] | null)?.[0];
  const buscaImagem = bi ? { chave: await decifrar(bi.api_key_cifrada), cx: bi.cx } : null;

  const portas = portasChatSupabase({
    admin: s.admin, lojaId: s.lojaId, userId: s.userId, nomeLoja: s.nomeLoja, decifrar,
    adaptadorStream: (p) => ADAPTADORES_STREAM[p],
    contexto: (conversaId) => ({
      origem: "chat", lojaId: s.lojaId, userId: s.userId, dados: dadosSupabase(s.admin, s.lojaId), rpc: (fn, args) => s.admin.rpc(fn, args), admin: s.admin, bling, conversaId,
      agente: { nome: "Nano.ia" }, plugins: (plugs ?? []) as PluginRegistro[], buscaImagem,
      credencialPlugin: async (pid) => { const { data } = await s.admin.rpc("plugin_credencial", { p_loja: s.lojaId, p_id: pid }); return typeof data === "string" ? await decifrar(data) : null; },
    }),
  });

  const abortar = new AbortController();
  req.signal.addEventListener("abort", () => abortar.abort());
  const enc = new TextEncoder();
  const corpo = new ReadableStream({
    async start(controller) {
      const emitir = (e: EventoChat) => { try { controller.enqueue(enc.encode(`event: ${e.evento}\ndata: ${JSON.stringify(e.dados)}\n\n`)); } catch { /* cliente saiu */ } };
      await executarTurno({ texto: String(c.texto ?? ""), conversaId: typeof c.conversa_id === "string" ? c.conversa_id : undefined,
        provedor: ["claude", "gemini", "compativel_openai"].includes(c.provedor) ? c.provedor : undefined, modelo: typeof c.modelo === "string" ? c.modelo.slice(0, 80) : undefined, fallback: c.fallback === true,
        contextoOperacional: c.contexto_operacional === true }, portas, emitir, abortar.signal);
      try { controller.close(); } catch { /* já fechado */ }
    },
    cancel() { abortar.abort(); },
  });
  return new Response(corpo, { headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
});
