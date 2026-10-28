import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarDispositivo, type PortasDispositivo } from "./rotas_dispositivo.ts";

const TOKEN = "T".repeat(45) + "." + "S".repeat(45);
const UUID = "11111111-1111-4111-8111-111111111111";
const portas = (rpcRet: unknown, over: Partial<PortasDispositivo> = {}): PortasDispositivo & { chamadas: [string, Record<string, unknown>][]; limites: string[] } => {
  const chamadas: [string, Record<string, unknown>][] = []; const limites: string[] = [];
  return { chamadas, limites, rpc: async (fn, args) => { chamadas.push([fn, args]); return rpcRet; }, limite: async (k) => { limites.push(k); return true; }, ...over } as never;
};
const req = (caminho: string, o: Partial<{ metodo: string; authorization: string | null; corpo: string; ip: string }> = {}) =>
  ({ metodo: "POST", caminho, authorization: `Bearer ${TOKEN}`, corpo: "{}", ip: "1.2.3.4", ...o });

test("proximo: tarefa => 200; fila vazia => 204; sessão inválida/revogada (null) => 401; só hashes vão ao banco", async () => {
  const p = portas({ job_id: UUID, argv: ["x"] });
  const r = await tratarDispositivo(req("/dispositivo/proximo"), p); assert.equal(r.status, 200);
  const [fn, args] = p.chamadas[0]; assert.equal(fn, "exec_local_puxar");
  assert.match(String(args.p_token_hash), /^[0-9a-f]{64}$/); assert.match(String(args.p_sal_hash), /^[0-9a-f]{64}$/); assert.ok(!JSON.stringify(args).includes("TTTT"));
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo"), portas({}))).status, 204);
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo"), portas(null))).status, 401);
});
test("resultado: valida job_id e ok; repassa saída e erro; nulo => 401", async () => {
  const p = portas("CONCLUIDA");
  const r = await tratarDispositivo(req("/dispositivo/resultado", { corpo: JSON.stringify({ job_id: UUID, ok: true, saida: "abc" }) }), p);
  assert.deepEqual([r.status, (r.corpo as { estado: string }).estado], [200, "CONCLUIDA"]);
  assert.equal(p.chamadas[0][1].p_saida, "abc"); assert.equal(p.chamadas[0][1].p_tarefa, UUID);
  for (const corpo of [{ job_id: "x", ok: true }, { job_id: UUID }, { job_id: UUID, ok: "sim" }]) assert.equal((await tratarDispositivo(req("/dispositivo/resultado", { corpo: JSON.stringify(corpo) }), portas("x"))).status, 400);
  assert.equal((await tratarDispositivo(req("/dispositivo/resultado", { corpo: JSON.stringify({ job_id: UUID, ok: true }) }), portas(null))).status, 401);
});
test("sem token, token malformado, método errado, rota desconhecida e corpo grande são recusados antes do banco", async () => {
  const p = portas({});
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo", { authorization: null }), p)).status, 401);
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo", { authorization: "Bearer abc" }), p)).status, 401);
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo", { metodo: "GET" }), p)).status, 405);
  assert.equal((await tratarDispositivo(req("/dispositivo/x"), p)).status, 404);
  assert.equal((await tratarDispositivo(req("/dispositivo/resultado", { corpo: "x".repeat(430_000) }), p)).status, 413);
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo", { corpo: "{" }), p)).status, 400);
  assert.equal(p.chamadas.length, 0);
});
test("limites: falhas de credencial contam por IP (429 ao estourar); sessão válida é limitada por hash", async () => {
  const p = portas(null, { limite: async (k) => !k.startsWith("dev401:") });
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo"), p)).status, 429);              // credencial inválida + IP estourado
  const q = portas({}, { limite: async (k) => !k.startsWith("dev:") });
  assert.equal((await tratarDispositivo(req("/dispositivo/proximo"), q)).status, 429); assert.equal(q.chamadas.length, 0);   // sessão estourou: nem consulta o banco
  const ok = portas({}); await tratarDispositivo(req("/dispositivo/proximo"), ok);
  assert.ok(ok.limites.some((k) => /^dev:[0-9a-f]{16}$/.test(k)));
});
