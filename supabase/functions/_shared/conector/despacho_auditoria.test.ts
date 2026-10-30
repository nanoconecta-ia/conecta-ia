import { test } from "node:test";
import assert from "node:assert/strict";
import { despachar, type ContextoDespacho } from "./despacho.ts";

test("auditoria indisponível nunca devolve sucesso ao GPT, mesmo após leitura bem-sucedida", async () => {
  const contexto = {
    origem: "chat", lojaId: "dddddddd-0000-0000-0000-000000000001", userId: "44444444-4444-4444-4444-444444444444",
    dados: { resumo: async () => ({ produtos: 2, publicados: 0, aguardando_aprovacao: 1 }) },
    rpc: async (fn: string) => {
      assert.equal(fn, "agente_chamada_registrar");
      return { data: null, error: { message: "auditoria indisponível" } };
    },
  } as unknown as ContextoDespacho;
  const r = await despachar("conecta.catalogo.resumo", {}, contexto);
  assert.equal(r.ok, false);
  assert.equal(r.auditoria_falhou, true);
  assert.match(r.erro ?? "", /auditoria_nao_confirmada/);
  assert.equal(r.resultado, undefined, "o LLM não recebe um resultado como se fosse validado");
});
