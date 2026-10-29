import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

type Pedido = { lojaId: string; sku: string; gtin?: string; versao: number; campos: Record<string, string> };
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return "[" + valor.map(canonico).join(",") + "]";
  if (valor && typeof valor === "object") return "{" + Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonico(v)).join(",") + "}";
  return JSON.stringify(valor);
}
function chave(p: Pedido) {
  return "nano-cadastro-" + createHash("sha256").update(canonico(p)).digest("hex").slice(0, 48);
}
function simularFila(pedidos: Pedido[]) {
  const fila = new Map<string, { chave: string; estado: "pendente"; pedido: Pedido }>();
  for (const pedido of pedidos) {
    const id = chave(pedido);
    if (!fila.has(id)) fila.set(id, { chave: id, estado: "pendente", pedido });
  }
  return [...fila.values()];
}
test("repetição exata produz uma única proposta pendente", () => {
  const p = { lojaId: "mobis", sku: "CI000016", versao: 1, campos: { marca: "X", nome: "Bomba" } };
  assert.equal(simularFila([p, p]).length, 1);
});
test("ordem dos campos não cria nova proposta", () => {
  const p = { lojaId: "mobis", sku: "CI000016", versao: 1, campos: { marca: "X", nome: "Bomba" } };
  const q = { ...p, campos: { nome: "Bomba", marca: "X" } };
  assert.equal(chave(p), chave(q));
});
test("versão ou loja diferente não reutiliza autorização", () => {
  const p = { lojaId: "mobis", sku: "CI000016", versao: 1, campos: { nome: "Bomba" } };
  assert.notEqual(chave(p), chave({ ...p, versao: 2 }));
  assert.notEqual(chave(p), chave({ ...p, lojaId: "outra" }));
});
