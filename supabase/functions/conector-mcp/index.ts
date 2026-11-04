// Gateway MCP do Nano.ia (Edge Function). IMPLANTADA (workflow deploy-conector-mcp.yml, com aprovação do ambiente producao-assistente). verify_jwt = false: a autenticação é a chave MCP por loja
// (hash sha256 no banco, escopos, expiração, revogação). O cliente externo nunca recebe service_role nem token do Bling.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type PortasGateway } from "../_shared/conector/gateway.ts";
import { tratarMcpComLocal, type PortasLocais } from "../_shared/exec_local/gateway_local.ts";
import { executar } from "../_shared/exec_local/executor.ts";
import { criarRunnerDb } from "../_shared/exec_local/runner_db.ts";
import { auditarDespacho, dispositivoAtivo, filaDbSupabase } from "../_shared/exec_local/portas_supabase.ts";
import { dadosSupabase } from "../_shared/conector/dados.ts";
import { BlingLeituraReal } from "../_shared/conector/porta_bling.ts";
import { armazemSupabase } from "../_shared/bling_armazem.ts";
import { chaveiroPlataforma } from "../_shared/plataforma.ts";
import { metadataRecursoMcp } from "../_shared/pair/oauth.ts";

const TRADUCAO_ESCOPO: Record<string, "leitura" | "propor"> = { "mcp:leitura": "leitura", "mcp:propor": "propor" };

Deno.serve(async (req) => {
  const urlBase = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "") + "/functions/v1";
  const urlRecurso = urlBase + "/conector-mcp";
  // Descoberta OAuth do recurso (RFC 9728): metadado público, sem segredo. Qualquer outro GET continua 405 no gateway.
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/.well-known/oauth-protected-resource")) {
    return new Response(JSON.stringify(metadataRecursoMcp(urlRecurso, urlBase + "/conecta-gateway")), { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const portas: PortasGateway = {
    async validarChave(hash) {
      const { data } = await admin.rpc("mcp_chave_validar", { p_hash: hash });
      return (data as any[] | null)?.[0] ?? null;
    },
    async validarOAuth(tokenHash, salHash) {
      const { data } = await admin.rpc("oauth_validar_para_recurso", { p_token_hash: tokenHash, p_sal_hash: salHash, p_recurso: "conector-mcp" });
      const s = data as { sessao_id: string; loja_id: string; usuario_id: string; nome: string; escopos: string[] } | null;
      if (!s) return null;
      const escopos = [...new Set(s.escopos.flatMap((e) => (TRADUCAO_ESCOPO[e] ? [TRADUCAO_ESCOPO[e]] : [])))];
      if (!escopos.length) return null;
      return { chave_id: s.sessao_id, loja_id: s.loja_id, escopos, criada_por: s.usuario_id, nome: s.nome, via: "oauth" as const };
    },
    urlRecurso,
    registrar: (linha) => console.log(linha),
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
