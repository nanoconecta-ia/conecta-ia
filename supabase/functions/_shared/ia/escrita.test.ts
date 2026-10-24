import { test } from "node:test";
import assert from "node:assert/strict";
import { proporAplicacao, proporCodigo, proporBanner, proporEnriquecimento, proporImagem } from "./escrita.ts";

function admin(produtoId: string | null, falhaRpc = false) {
  const chamadas: { fn: string; args: unknown }[] = [];
  return {
    chamadas,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: produtoId ? { id: produtoId } : null }) }) }) }) }),
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

test("proporBanner: só rascunho, estilo e datas validados, produto da loja", async () => {
  const a = admin("p1");
  const r: any = await proporBanner(a, "L1", { sku: "CI003696", estilo: "flash", chamada: " Só hoje ", fim: "2026-11-01T00:00:00Z" });
  assert.equal(r.ok, true); assert.equal(r.status, "rascunho");
  const args: any = a.chamadas[0].args;
  assert.equal(a.chamadas[0].fn, "banner_propor"); assert.equal(args.p_chamada, "Só hoje"); assert.equal(args.p_estilo, "flash"); assert.ok(!("p_ativo" in args));
  assert.ok((await proporBanner(a, "L1", { sku: "x", estilo: "piscante" }) as any).erro.includes("Estilo"));
  assert.ok((await proporBanner(a, "L1", { sku: "x", inicio: "ontem" }) as any).erro.includes("Data"));
  assert.ok((await proporBanner(a, "L1", { sku: "x", inicio: "2026-11-02T00:00:00Z", fim: "2026-11-01T00:00:00Z" }) as any).erro.includes("fim"));
  assert.ok((await proporBanner(admin(null), "L1", { sku: "x" }) as any).erro.includes("não encontrado"));
  assert.ok((await proporBanner(admin("p1", true), "L1", { sku: "x" }) as any).erro);
});
