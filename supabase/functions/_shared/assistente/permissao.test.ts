import { test } from "node:test";
import assert from "node:assert/strict";
import { MSG_SO_LOJISTA, podeDecidir, type RpcUsuario } from "./permissao.ts";

const rpcCom = (resposta: { data: unknown; error?: unknown } | Error) => {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const usuario: RpcUsuario = { rpc: async (fn, args) => { chamadas.push({ fn, args }); if (resposta instanceof Error) throw resposta; return resposta; } };
  return { usuario, chamadas };
};

test("lojista (pode_administrar_loja = true) pode decidir; a RPC recebe a loja certa", async () => {
  const { usuario, chamadas } = rpcCom({ data: true });
  assert.equal(await podeDecidir(usuario, "loja-1"), true);
  assert.deepEqual(chamadas, [{ fn: "pode_administrar_loja", args: { p_loja_id: "loja-1" } }]);
});
test("editor (false) NÃO pode decidir", async () => { assert.equal(await podeDecidir(rpcCom({ data: false }).usuario, "loja-1"), false); });
test("qualquer resposta que não seja exatamente true nega (null, texto, 1, objeto)", async () => {
  for (const data of [null, undefined, "true", 1, {}, []]) assert.equal(await podeDecidir(rpcCom({ data }).usuario, "l").then((v) => v), false, String(data));
});
test("erro da RPC ou exceção nega (falha fechada)", async () => {
  assert.equal(await podeDecidir(rpcCom({ data: true, error: { code: "42501" } }).usuario, "l"), false);
  assert.equal(await podeDecidir(rpcCom(new Error("rede")).usuario, "l"), false);
});
test("a mensagem ao usuário é clara e não revela detalhe técnico", () => { assert.match(MSG_SO_LOJISTA, /lojista/); assert.doesNotMatch(MSG_SO_LOJISTA, /rpc|sql|policy/i); });
