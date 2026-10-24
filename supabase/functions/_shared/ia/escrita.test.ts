import { test } from "node:test";
import assert from "node:assert/strict";
import { proporAplicacao, proporCodigo, proporEnriquecimento, proporImagem } from "./escrita.ts";

function admin(produtoId: string | string[] | null, falhaRpc = false) {
  const ids = produtoId == null ? [] : Array.isArray(produtoId) ? produtoId : [produtoId];
  const chamadas: { fn: string; args: unknown }[] = [];
  return {
    chamadas,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: ids.map((id) => ({ id })) }) }) }) }) }),
    rpc: async (fn: string, args: Record<string, unknown>) => { chamadas.push({ fn, args }); return { data: falhaRpc ? null : true, error: falhaRpc ? new Error("falhou") : null }; },
  };
}

test("proporEnriquecimento: exige fonte, campo da lista e produto existente; nunca marca aprovado", async () => {
  const a = admin("p1");
  const r: any = await proporEnriquecimento(a, "L1", { sku: "80692", campo: "marca_peca", valor: "SABó", fonte: "https://fabricante.com" });
  assert.equal(r.ok, true); assert.equal(r.status, "a_confirmar");
  assert.equal(a.chamadas[0].fn, "enriquecimento_propor");
  assert.ok(!("status" in (a.chamadas[0].args as any)) || (a.chamadas[0].args as any).p_loja === "L1");
  assert.ok((await proporEnriquecimento(a, "L1", { sku: "80692", campo: "marca_peca", valor: "x" }) as any).erro.includes("fonte"));
  assert.ok((await proporEnriquecimento(a, "L1", { sku: "80692", campo: "preco", valor: "x", fonte: "f" }) as any).erro.includes("Campo"));
  assert.ok((await proporEnriquecimento(admin(null), "L1", { sku: "x", campo: "marca_peca", valor: "v", fonte: "f" }) as any).erro.includes("não encontrado"));
});

test("proporCodigo: tipo restrito (sku nunca aceito do agente)", async () => {
  const a = admin("p1");
  assert.ok((await proporCodigo(a, "L1", { sku: "80692", tipo: "sku", valor: "X", fonte: "f" }) as any).erro);
  const r: any = await proporCodigo(a, "L1", { sku: "80692", tipo: "oem", valor: "20910-4AU07", fonte: "catálogo Hyundai" });
  assert.equal(r.ok, true);
});

test("proporAplicacao: ano final antes do inicial é recusado", async () => {
  const a = admin("p1");
  assert.ok((await proporAplicacao(a, "L1", { sku: "80692", modelo: "HR", ano_inicial: 2015, ano_final: 2010, fonte: "f" }) as any).erro);
  const r: any = await proporAplicacao(a, "L1", { sku: "80692", modelo: "HR", motorizacao: "2.5 16V", ano_inicial: 2013, fonte: "manual" });
  assert.equal(r.ok, true);
});

test("proporImagem: exige https; aviso sobre direitos ainda não confirmados", async () => {
  const a = admin("p1");
  assert.ok((await proporImagem(a, "L1", { sku: "80692", url: "http://x.com/a.jpg" }) as any).erro);
  const r: any = await proporImagem(a, "L1", { sku: "80692", url: "https://x.com/a.jpg", origem: "busca_web" });
  assert.equal(r.ok, true); assert.match(r.aviso, /direitos/);
});

test("falha na gravação vira mensagem, não exceção", async () => {
  const r: any = await proporEnriquecimento(admin("p1", true), "L1", { sku: "80692", campo: "marca_peca", valor: "x", fonte: "f" });
  assert.ok(r.erro);
});

test("SKU repetido no Bling: nenhuma ferramenta de escrita escolhe um dos produtos", async () => {
  const a = admin(["p1", "p2"]);
  for (const r of [await proporEnriquecimento(a, "L1", { sku: "X", campo: "marca_peca", valor: "v", fonte: "f" }), await proporCodigo(a, "L1", { sku: "X", tipo: "oem", valor: "V", fonte: "f" }),
    await proporAplicacao(a, "L1", { sku: "X", modelo: "HR", fonte: "f" }), await proporImagem(a, "L1", { sku: "X", url: "https://x.com/a.jpg" })] as any[]) {
    assert.match(r.erro, /mais de um produto/);
  }
  assert.equal(a.chamadas.length, 0, "nada foi gravado");
});
