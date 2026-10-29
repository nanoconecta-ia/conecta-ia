import { test } from "node:test";
import assert from "node:assert/strict";
import { enviarPropostaCadastroParaFila } from "./nanoFilaAprovacao.ts";
const id = "11111111-1111-4111-8111-111111111111";
const p = { lojaId: id, usuarioId: id, produtoId: id, chaveIdempotencia: "nano-teste-00001", camposAntes: { nome: "Antigo" }, camposDepois: { nome: "Novo" }, fonte: "catalogo-fabricante" };
test("adapter envia proposta para RPC existente sem executar escrita Bling", async () => {
  let nome = ""; let args: Record<string, unknown> = {};
  const rpc = { rpc: async (n: string, a: Record<string, unknown>) => { nome = n; args = a; return { data: { estado: "pendente", duplicado: false }, error: null }; } };
  const r = await enviarPropostaCadastroParaFila(rpc, p);
  assert.equal(nome, "aprovacao_propor");
  assert.equal(args.p_tipo, "produto_atualizacao");
  assert.equal(args.p_idempotency_key, p.chaveIdempotencia);
  assert.deepEqual(args.p_alvos, [{ tabela: "produtos", id }]);
  assert.deepEqual(r, { estado: "pendente", duplicado: false });
});
test("adapter recusa proposta sem fonte ou chave válida", async () => {
  const rpc = { rpc: async () => { throw new Error("não deveria chamar banco"); } };
  await assert.rejects(() => enviarPropostaCadastroParaFila(rpc, { ...p, fonte: "" }));
  await assert.rejects(() => enviarPropostaCadastroParaFila(rpc, { ...p, chaveIdempotencia: "x" }));
});
test("adapter propaga falha da fila", async () => {
  const rpc = { rpc: async () => ({ data: null, error: { message: "sem permissão" } }) };
  await assert.rejects(() => enviarPropostaCadastroParaFila(rpc, p), /sem permissão/);
});
