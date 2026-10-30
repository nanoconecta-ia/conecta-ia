// Gateway MCP do Nano.ia (Edge Function). NÃO IMPLANTADA nesta fase. verify_jwt = false: a autenticação é a chave MCP por loja
// (hash sha256 no banco, escopos, expiração, revogação). O cliente externo nunca recebe service_role nem token do Bling.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { type PortasGateway } from "../_shared/conector/gateway.ts";
import { tratarMcpComLocal, type PortasLocais } from "../_shared/exec_local/gateway_local.ts";
import { executar } from "../_shared/exec_local/executor.ts";
import { criarRunnerDb } from "../_shared/exec_local/runner_db.ts";
import { auditarDespacho, dispositivoAtivo, filaDbSupabase } from "../_shared/exec_local/portas_supabase.ts";
import { dadosSupabase } from "../_shared/conector/dados.ts";
import { BlingLeituraReal } from "../_shared/conector/porta_bling.ts";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const portas: PortasGateway = {
    async validarChave(hash) {
      const { data } = await admin.rpc("mcp_chave_validar", { p_hash: hash });
      return (data as any[] | null)?.[0] ?? null;
    },
    async limite(chaveId) {
      const { data } = await admin.rpc("limite_chamada", { p_chave: `mcp:${chaveId}`, p_max: 120, p_janela_s: 60 });
      return data === true;
    },
    async contexto(chave) {
      const chaveCifra = await chaveiroPlataforma(admin, (n) => Deno.env.get(n));
      return {
        origem: "gateway_mcp", lojaId: chave.loja_id, userId: chave.criada_por, dados: dadosSupabase(admin, chave.loja_id),
        rpc: (fn, args) => admin.rpc(fn, args) as any, admin: admin as any,
        bling: chaveCifra ? new BlingLeituraReal(armazemSupabase(admin), chave.loja_id, { chaveCifra }) : undefined,
        agente: { nome: `Cliente externo: ${chave.nome}` },
      };
    },
  };
  const corpo = await req.text();
  const cab: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => { cab[k.toLowerCase()] = v; });
  // Ferramentas LOCAIS (Windows, só leitura): anunciadas apenas se a loja tem agente_desktop pareado e ativo; executadas pela fila persistente.
  const fila = filaDbSupabase(admin as any);
  const locais: PortasLocais = {
    esperaMs: 0, novoId: () => crypto.randomUUID(), executoresAtivos: ["windows"],
    dispositivo: (chave) => dispositivoAtivo(admin as any, chave.loja_id),
    executarInline: (sessao, tarefa, chave) => executar(sessao, tarefa, {
      agora: Date.now, revogada: async () => false, pausada: async () => false, consentimento: async () => null,   // a chave MCP já foi validada nesta chamada; todas as capacidades ativas são consulta
      auditar: auditarDespacho(admin as any, chave),
      runner: criarRunnerDb(fila, { loja_id: sessao.loja_id, dispositivo_id: sessao.dispositivo_id, capacidade: tarefa.capacidade, agente: sessao.agente, intervaloMs: 500 }),
    }),
  };
  const r = await tratarMcpComLocal({ metodo: req.method, cabecalhos: cab, corpo }, portas, locais);
  return new Response(r.corpo || null, { status: r.status, headers: r.cabecalhos });
});
