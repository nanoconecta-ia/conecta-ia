/**
 * Host de homologação SOMENTE 127.0.0.1, sem Supabase, Bling ou credenciais reais.
 * Recebe chamadas HMAC do Worker pai, verifica replay e aciona despachar() REAL
 * sobre um mock de banco com auditoria. NÃO reutilizar como serviço de produção.
 */
import { createServer } from "node:http";
import { verificarBridge, BRIDGE_PATH } from "../src/bridge-auth.mjs";
import { criarAdaptadorCodeModeLeitura } from "../../../supabase/functions/_shared/conector/codemode_bridge.ts";

const PORT = 8799;
const control = process.env.TEST_CONTROL;
const keys = new Map([
  ["hml-a", { secret: process.env.TEST_HMAC_A, loja: "aaaaaaaa-0000-0000-0000-000000000001", uid: "11111111-1111-1111-1111-111111111111", ativa: true }],
  ["hml-b", { secret: process.env.TEST_HMAC_B, loja: "bbbbbbbb-0000-0000-0000-000000000002", uid: "22222222-2222-2222-2222-222222222222", ativa: true }],
]);
if (!control || control.length < 32 || [...keys.values()].some((k) => typeof k.secret !== "string" || k.secret.length < 32))
  throw Error("credenciais_de_teste_ausentes");
const vistos = new Map();
let autorizadas = 0, negadas = 0, auditorias = 0;
async function receber(req) {
  const partes = [];
  for await (const parte of req) {
    partes.push(parte);
    if (partes.reduce((a,b)=>a+b.length,0)>4096) throw Error("corpo_grande");
  }
  return Buffer.concat(partes).toString("utf8");
}
const enviar = (res, status, v) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(v));
};
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/test/status" && req.method === "GET" && req.headers["x-test-control"] === control)
      return enviar(res, 200, { autorizadas, negadas, auditorias });
    if (req.url === "/test/revogar" && req.method === "POST" && req.headers["x-test-control"] === control) {
      const c = keys.get(req.headers["x-test-key"]);
      if (!c) return enviar(res, 404, { erro: "not_found" });
      c.ativa = false;
      return enviar(res, 200, { ok: true });
    }
    if (req.url !== BRIDGE_PATH) return enviar(res, 404, { erro: "not_found" });
    const corpo = await receber(req);
    const auth = await verificarBridge({
      method: req.method, path: req.url, headers: new Headers(req.headers), corpo,
      buscarChave: async (keyId) => {
        const c = keys.get(keyId);
        return c ? { secret: c.secret, ativa: c.ativa } : null;
      },
      replay: async (keyId, nonce, expiration) => {
        const now = Date.now();
        for (const [k, t] of vistos) if (t < now) vistos.delete(k);
        const k = keyId + ":" + nonce;
        if (vistos.has(k)) return true;
        vistos.set(k, expiration);
        return false;
      },
    });
    if (!auth.ok) { negadas++; return enviar(res, 401, { erro: auth.motivo }); }
    const k = keys.get(auth.keyId);
    let p;
    try { p = JSON.parse(corpo); } catch { return enviar(res, 400, { erro: "argumento_invalido" }); }
    if (!p || !["catalogo_resumo", "catalogo_listar"].includes(p.operacao))
      return enviar(res, 403, { erro: "operacao_nao_autorizada" });
    const base = [
      { sku: "FIX-" + auth.keyId.toUpperCase() + "-01", nome: "Peça de teste", fornecedor: "NUNCA", precoCusto: 99, ncm: "000" },
      ...(auth.keyId === "hml-a" ? [{ sku: "FIX-HML-A-02", nome: "Outro item de teste", estoque: 3 }] : []),
    ];
    const identidade = { chave_id: auth.keyId, loja_id: k.loja, escopos: ["leitura"] };
    const contexto = {
      origem: "gateway_mcp", lojaId: k.loja, userId: k.uid, mcpChaveId: auth.keyId, escopos: ["leitura"],
      dados: {
        resumo: async () => ({ produtos: base.length, publicados: 0, aguardando_aprovacao: 0, precoCusto: 999 }),
        listarProdutos: async (params = {}) => base
          .filter(x=> !params.busca || x.sku.includes(params.busca) || x.nome.includes(params.busca))
          .slice(0, params.limite ?? 10),
      },
      rpc: async (fn) => {
        if (fn !== "agente_chamada_registrar") return { error: { message: "rpc_nao_permitido" } };
        auditorias++;
        return { data: true, error: null };
      },
    };
    const adaptador = criarAdaptadorCodeModeLeitura({
      contexto, identidade,
      revalidarChave: async () => k.ativa ? identidade : null,
      limite: 12, prazoMs: 12_000,
    });
    const resultado = await adaptador.executar(p.operacao, p.args);
    autorizadas++;
    return enviar(res, 200, { ok: true, resultado });
  } catch {
    negadas++;
    return enviar(res, 400, { erro: "requisicao_recusada" });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log("HOST_FIXTURE_READY:" + PORT));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
