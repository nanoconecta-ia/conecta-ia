// Gateway MCP do Gênesis (Edge Function). NÃO IMPLANTADA nesta fase. verify_jwt = false: a autenticação é a chave MCP por loja
// (hash sha256 no banco, escopos, expiração, revogação). O cliente externo nunca recebe service_role nem token do Bling.
import { createClient } from "npm:@supabase/supabase-js@2";
import { tratarMcp, type PortasGateway } from "../_shared/conector/gateway.ts";
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
  const r = await tratarMcp({ metodo: req.method, cabecalhos: cab, corpo }, portas);
  return new Response(r.corpo || null, { status: r.status, headers: r.cabecalhos });
});
