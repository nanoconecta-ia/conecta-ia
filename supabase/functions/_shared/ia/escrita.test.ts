import { test } from "node:test";
import assert from "node:assert/strict";
import { proporAplicacao, proporCodigo, proporEnriquecimento, proporImagem } from "./escrita.ts";

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

const aplicacaoOk = (extra: Record<string, unknown> = {}) => ({
  sku: "80692", marca_veiculo: "Hyundai", modelo: "HR", motorizacao: "2.5 16V D4CB", ano_inicial: 2013, ano_final: 2017, tipo_ano: "comercializacao_brasil", regime: "importado",
  base: "versao_do_veiculo", fonte_tipo: "catalogo_fabricante", fonte_url: "https://fabricante.example/catalogo/80692", fonte_data: "2026-10-30", ...extra,
});
test("proporAplicacao: versão completa com fonte forte entra a_confirmar, com confiança limitada", async () => {
  const a = admin("p1");
  const r: any = await proporAplicacao(a, "L1", aplicacaoOk({ confianca: 1 }));
  assert.equal(r.ok, true); assert.equal(r.status, "a_confirmar"); assert.equal(r.nivel, "confirmavel");
  const args: any = a.chamadas[0].args; assert.equal(a.chamadas[0].fn, "aplicacao_propor");
  assert.ok(args.p_confianca <= 0.7, "a confiança do agente nunca passa do limite");
  assert.match(args.p_fonte, /catalogo_fabricante \| https:\/\/fabricante\.example\/catalogo\/80692 \| 2026-10-30/);
  assert.match(args.p_fonte, /ano=comercializacao_brasil/); assert.match(args.p_fonte, /marca=Hyundai/);
});
test("proporAplicacao: sem fonte datada, sem versão, só motor/modelo ou ano inválido são recusados e nada é gravado", async () => {
  const casos: [Record<string, unknown>, string][] = [
    [{ ano_final: 2010 }, "anos_invertidos"], [{ fonte_data: "" }, "fonte_ausente"], [{ fonte_url: "", fonte_documento: "" }, "fonte_ausente"], [{ motorizacao: "" }, "versao_incompleta"],
    [{ marca_veiculo: "" }, "versao_incompleta"], [{ base: "somente_motor" }, "motor_nao_prova_aplicacao"], [{ base: "somente_modelo" }, "modelo_sem_versao"], [{ base: undefined }, "modelo_sem_versao"],
    [{ tipo_ano: undefined }, "tipo_ano_ausente"], [{ tipo_ano: "lancamento_mundial" }, "ano_lancamento_mundial_nao_vale"], [{ modelo: "HR / Bongo" }, "veiculos_misturados"],
    [{ fonte_data: "2099-01-01" }, "data_da_fonte_invalida"], [{ fonte_tipo: "cruzamento_codigo_oem", codigo_conferido: "XYZ-1" }, "produto_sem_codigo_tecnico"],
  ];
  for (const [extra, codigo] of casos) {
    const a = admin("p1");
    const r: any = await proporAplicacao(a, "L1", aplicacaoOk(extra));
    assert.ok(r.erro, JSON.stringify(extra)); assert.ok(r.bloqueios.some((b: any) => b.codigo === codigo), `${JSON.stringify(extra)} → ${codigo}`);
    assert.equal(a.chamadas.length, 0, "nada gravado quando recusada");
  }
});
test("proporAplicacao: o formato antigo (fonte em texto livre, sem versão) deixa de ser aceito", async () => {
  const a = admin("p1");
  const r: any = await proporAplicacao(a, "L1", { sku: "80692", modelo: "HR", motorizacao: "2.5 16V", ano_inicial: 2013, fonte: "manual" });
  assert.ok(r.erro); assert.equal(a.chamadas.length, 0);
  assert.ok((await proporAplicacao(admin(null), "L1", aplicacaoOk()) as any).erro.includes("não encontrado"));
  assert.ok((await proporAplicacao(admin("p1"), "L1", { ...aplicacaoOk(), sku: "" }) as any).erro);
});
test("proporAplicacao: fonte fraca entra como hipótese (confiança ≤ 0,4); falha do banco devolve erro", async () => {
  const a = admin("p1");
  const r: any = await proporAplicacao(a, "L1", aplicacaoOk({ fonte_tipo: "anuncio_marketplace", fonte_url: "https://loja.example/a/1", confianca: 0.95 }));
  assert.equal(r.ok, true); assert.equal(r.nivel, "hipotese"); assert.ok((a.chamadas[0].args as any).p_confianca <= 0.4);
  assert.ok((await proporAplicacao(admin("p1", true), "L1", aplicacaoOk()) as any).erro.includes("Não foi possível"));
});

function adminComAprovados(apps: unknown[], codigos: unknown[]) {
  const chamadas: { fn: string; args: unknown }[] = [];
  return {
    chamadas,
    from: (t: string) => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: { id: "p1" } }),
      eq: () => (t === "produtos" ? ({ maybeSingle: async () => ({ data: { id: "p1" } }) }) : Promise.resolve({ data: t === "produto_aplicacoes" ? apps : codigos })),
    }) }) }),
    rpc: async (fn: string, args: Record<string, unknown>) => { chamadas.push({ fn, args }); return { data: true, error: null }; },
  };
}
test("proporEnriquecimento: texto de SEO só cita aplicações e códigos APROVADOS; sem aplicação aprovada, não afirma compatibilidade", async () => {
  const vazio = adminComAprovados([], []);
  const r1: any = await proporEnriquecimento(vazio, "L1", { sku: "80692", campo: "seo_descricao", valor: "Bomba de óleo compatível com Hyundai HR 2013 a 2017, peça original.", fonte: "f" });
  assert.ok(r1.erro && r1.bloqueios.length >= 2); assert.equal(vazio.chamadas.length, 0);
  const com = adminComAprovados([{ modelo: "HR", motorizacao: "2.5 D4CB", ano_inicial: 2013, ano_final: 2017 }], [{ valor: "FIX-OEM-100" }]);
  const ok: any = await proporEnriquecimento(com, "L1", { sku: "80692", campo: "seo_descricao", valor: "Bomba de óleo para motor 2.5 D4CB. Compatível com HR, de 2013 a 2017. Código FIX-OEM-100.", fonte: "f" });
  assert.equal(ok.ok, true); assert.equal(com.chamadas.length, 1);
  const errado: any = await proporEnriquecimento(adminComAprovados([{ modelo: "HR", motorizacao: "2.5 D4CB", ano_inicial: 2013, ano_final: 2017 }], []), "L1", { sku: "80692", campo: "seo_descricao", valor: "Compatível com Pajero e com o código ZZ-98765 para descrição maior que cinquenta caracteres.", fonte: "f" });
  assert.ok(errado.bloqueios.some((b: any) => b.codigo === "seo_veiculo_nao_aprovado") && errado.bloqueios.some((b: any) => b.codigo === "seo_codigo_nao_aprovado"));
});
test("proporEnriquecimento: campos que não são texto de SEO (marca da peça) não passam pelo validador de texto", async () => {
  const a = adminComAprovados([], []);
  assert.equal(((await proporEnriquecimento(a, "L1", { sku: "80692", campo: "marca_peca", valor: "Peça original", fonte: "https://fabricante.com" })) as any).ok, true);
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

test("proporImagem: recusa endereço interno antes de qualquer gravação", async () => {
  const a = admin("p1");
  for (const url of ["https://169.254.169.254/latest", "https://127.0.0.1/a.jpg", "https://intranet/a.jpg"]) assert.ok((await proporImagem(a, "L1", { sku: "80692", url }) as any).erro, url);
  assert.equal(a.chamadas.length, 0);
});
test("proporImagem com verificação: devolve SHA-256 e dimensões do original, atualiza a linha e nunca marca editada", async () => {
  const atualizacoes: Record<string, unknown>[] = [];
  const a: any = admin("p1");
  const cadeia: any = { eq: () => cadeia, then: (r: (v: unknown) => void) => r({ error: null }) };
  const base = a.from; a.from = (t: string) => (t === "produto_imagens" ? { update: (v: Record<string, unknown>) => { atualizacoes.push(v); return cadeia; } } : base());
  const imagem = { sha256: "a".repeat(64), bytes: 1234, mime: "image/png" as const, largura_px: 1200, altura_px: 900, url_final: "https://x.com/a.png", avisos: [] };
  const r: any = await proporImagem(a, "L1", { sku: "80692", url: "https://x.com/a.png" }, async () => ({ ok: true, imagem }));
  assert.equal(r.ok, true); assert.equal(r.original.sha256, "a".repeat(64)); assert.equal(r.original.editada, false);
  assert.deepEqual(atualizacoes[0], { largura_px: 1200, altura_px: 900 });
  assert.equal(a.chamadas[0].fn, "imagem_propor");
});
test("proporImagem com verificação reprovada: devolve o erro e NÃO grava a proposta", async () => {
  const a = admin("p1");
  const r: any = await proporImagem(a, "L1", { sku: "80692", url: "https://x.com/a.png" }, async () => ({ ok: false, erro: "O arquivo não é uma imagem JPEG, PNG ou WebP válida." }));
  assert.match(r.erro, /não é uma imagem/); assert.equal(a.chamadas.length, 0);
});
