/**
 * HOST DE LABORATÓRIO para Service Binding (sem URL pública).
 * Dados inteiramente sintéticos; NÃO publicar em conta real, mesmo como preview.
 * A assinatura HMAC autentica o Worker PAI; a identidade da loja é definida no host.
 * Replay em Map e revogação automática são apenas fixtures locais — NÃO produçāo.
 */
import { verificarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
import { criarAdaptadorCodeModeLeitura } from "../../../supabase/functions/_shared/conector/codemode_bridge.ts";

interface Env {
  TEST_HMAC_A: string;
  TEST_HMAC_B: string;
}
const estados = new Map<string, { ativo: boolean; chamadas: number }>([
  ["hml-a", { ativo: true, chamadas: 0 }],
  ["hml-b", { ativo: true, chamadas: 0 }],
]);
const nonces = new Map<string, number>();
const json = (status: number, dados: unknown) => new Response(JSON.stringify(dados), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== BRIDGE_PATH || req.method !== "POST") return json(404, { erro: "not_found" });
    const corpo = await req.text();
    try {
      const auth = await verificarBridge({
        method: req.method, path: url.pathname, headers: req.headers, corpo,
        buscarChave: async (kid: string) => {
          const estado = estados.get(kid);
          return estado && (kid === "hml-a" || kid === "hml-b")
            ? { secret: kid === "hml-a" ? env.TEST_HMAC_A : env.TEST_HMAC_B, ativa: estado.ativo }
            : null;
        },
        replay: async (kid: string, nonce: string, exp: number) => {
          for (const [key, t] of nonces) if (t < Date.now()) nonces.delete(key);
          const key = kid + ":" + nonce;
          if (nonces.has(key)) return true;
          nonces.set(key, exp);
          return false;
        },
      });
      if (!auth.ok) return json(401, { erro: "credencial_invalida" });
      const key = auth.keyId as string;
      const estado = estados.get(key)!;
      const dados = JSON.parse(corpo);
      if (!dados || !["catalogo_resumo", "catalogo_listar"].includes(dados.operacao))
        return json(403, { erro: "operacao_nao_autorizada" });
      const loja = key === "hml-a" ? "aaaaaaaa-0000-0000-0000-000000000001" : "bbbbbbbb-0000-0000-0000-000000000002";
      const identidade = { chave_id: key, loja_id: loja, escopos: ["leitura"] as const };
      const p = [
        { sku: "FIX-" + key.toUpperCase() + "-01", nome: "Peça fictícia", precoCusto: 101, fornecedor: "INVISIVEL" },
        ...(key === "hml-a" ? [{ sku: "FIX-HML-A-02", nome: "Outra peça fictícia", estoque: 2, ncm: "0000" }] : []),
      ];
      const ctx = {
        lojaId: loja,
        userId: key === "hml-a" ? "11111111-1111-1111-1111-111111111111" : "22222222-2222-2222-2222-222222222222",
        origem: "gateway_mcp" as const,
        mcpChaveId: key,
        escopos: ["leitura"],
        dados: {
          resumo: async () => ({ produtos: p.length, publicados: 0, aguardando_aprovacao: 0, precoCusto: 555 }),
          listarProdutos: async (params: { busca?: string; limite?: number } = {}) => p
            .filter((v) => !params.busca || v.sku.includes(params.busca) || v.nome.includes(params.busca))
            .slice(0, params.limite ?? 10),
        },
        rpc: async (fn: string) => fn === "agente_chamada_registrar"
          ? { data: true, error: null } : { error: { message: "rpc_nao_autorizado" } },
      };
      const adapter = criarAdaptadorCodeModeLeitura({
        contexto: ctx as any,
        identidade, revalidarChave: async () => estado.ativo ? identidade : null,
      });
      const resultado = await adapter.executar(dados.operacao, dados.args);
      estado.chamadas++;
      // Revogação simulada APÓS duas leituras A: terceira chamada A deve falhar.
      if (key === "hml-a" && estado.chamadas >= 2) estado.ativo = false;
      return json(200, { ok: true, resultado });
    } catch {
      return json(400, { erro: "requisicao_recusada" });
    }
  },
};
