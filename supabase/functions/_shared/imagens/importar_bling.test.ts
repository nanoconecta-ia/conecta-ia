import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoBase, extrairMidia, importarProduto, type PortasImportacao } from "./importar_bling.ts";

const L = "aaaaaaaa-0000-0000-0000-00000000000a", P = "c0000000-0000-0000-0000-000000000001";
const assinado = "https://bling-bucket.s3.amazonaws.com/imagens/a/b.jpg?AWSAccessKeyId=AKIASEGREDO&Signature=ASSINATURA&Expires=1";
const bytes = new Uint8Array([1, 2, 3]);
function portas(o: Partial<PortasImportacao> = {}) {
  const guardados: { caminho: string; mime: string }[] = [], linhas: Record<string, unknown>[] = [], descartados: string[] = []; let n = 0;
  const base: PortasImportacao = {
    produtoPorSku: async (_l, sku) => (sku === "OC1224" ? { id: P, loja_id: L, sku, bling_id: "16622651283" } : null),
    lerProdutoBling: async () => ({ id: "16622651283", codigo: "OC1224", midia: { interna: [assinado], externa: [] } }),
    baixar: async (url) => ({ ok: true, imagem: { sha256: "a".repeat(64), bytes: 3, mime: "image/jpeg", largura_px: 800, altura_px: 800, url_final: url, avisos: [], conteudo: bytes } }),
    guardar: async (caminho, _b, mime) => { guardados.push({ caminho, mime }); return { ok: true }; },
    gravarLinha: async (l) => { linhas.push(l); return { ok: true }; }, descartar: async (c) => { descartados.push(c); },
    novoId: () => `e0000000-0000-0000-0000-00000000000${++n}`, agora: () => new Date("2026-11-03T12:00:00Z"), ...o,
  };
  return { base, guardados, linhas, descartados };
}

test("importa a imagem: original guardado, linha NÃO aprovada, sem direitos, sem confiança, sem URL assinada", async () => {
  const { base, guardados, linhas } = portas();
  const r = await importarProduto(base, L, "OC1224");
  assert.equal(r[0].estado, "importada");
  assert.equal(guardados[0].caminho, `lojas/${L}/produtos/${P}/e0000000-0000-0000-0000-000000000001/original.jpg`);
  const l = linhas[0];
  assert.equal(l.aprovada, false); assert.equal(l.tipo, "ilustrativa"); assert.equal(l.principal, false);
  assert.equal("confianca" in l, false); assert.equal("licenca_tipo" in l, false); assert.equal("direitos_confirmados_em" in l, false);
  const texto = JSON.stringify(l);
  assert.equal(/AKIASEGREDO|Signature|AWSAccessKeyId|Expires/.test(texto), false, "a credencial do link do Bling não pode ser gravada");
  assert.equal(l.url, "https://bling-bucket.s3.amazonaws.com/imagens/a/b.jpg");
  assert.equal(l.arquivo_original_sha256, "a".repeat(64));
});
test("identidade divergente (SKU ou id do Bling diferentes do espelho): nada é baixado nem gravado", async () => {
  let baixou = false;
  for (const lido of [{ id: "999", codigo: "OC1224" }, { id: "16622651283", codigo: "OUTRO" }]) {
    const { base, guardados, linhas } = portas({ lerProdutoBling: async () => ({ ...lido, midia: { interna: [assinado], externa: [] } }), baixar: async () => { baixou = true; throw new Error("não deveria baixar"); } });
    const r = await importarProduto(base, L, "OC1224");
    assert.equal(r[0].motivo, "identidade_divergente_espelho_x_bling"); assert.equal(guardados.length + linhas.length, 0);
  }
  assert.equal(baixou, false);
});
test("produto fora da loja ou inexistente é recusado", async () => {
  const { base } = portas();
  assert.equal((await importarProduto(base, L, "NAO-EXISTE"))[0].motivo, "produto_nao_encontrado_na_loja");
  const { base: b2 } = portas({ produtoPorSku: async () => ({ id: P, loja_id: "bbbbbbbb-0000-0000-0000-00000000000b", sku: "OC1224", bling_id: "1" }) });
  assert.equal((await importarProduto(b2, L, "OC1224"))[0].motivo, "produto_nao_encontrado_na_loja");
});
test("download recusado (rede interna, tipo inválido): não guarda nem grava", async () => {
  const { base, guardados, linhas } = portas({ baixar: async () => ({ ok: false, erro: "O arquivo não é uma imagem JPEG, PNG ou WebP válida." }) });
  const r = await importarProduto(base, L, "OC1224"); assert.equal(r[0].estado, "recusada"); assert.equal(guardados.length + linhas.length, 0);
});
test("mesmo conteúdo de novo: índice único responde duplicada => ja_existia (idempotente)", async () => {
  const { base, descartados } = portas({ gravarLinha: async () => ({ ok: false, duplicada: true }) });
  assert.equal((await importarProduto(base, L, "OC1224"))[0].estado, "ja_existia");
  assert.equal(descartados.length, 1, "o objeto recém-guardado fica órfão e deve ser removido");
});
test("mídia externa (CDN) também entra, marcada como bling_externa, sem direitos", async () => {
  const { base, linhas } = portas({ lerProdutoBling: async () => ({ id: "16622651283", codigo: "OC1224", midia: { interna: [], externa: ["https://http2.mlstatic.com/D_NQ_NP_x.webp"] } }) });
  const r = await importarProduto(base, L, "OC1224"); assert.equal(r[0].origem, "bling_externa"); assert.equal(linhas[0].importada_de, "bling_externa");
});
test("sem imagem no Bling: recusa explícita; extrairMidia e caminhoBase", async () => {
  const { base } = portas({ lerProdutoBling: async () => ({ id: "16622651283", codigo: "OC1224", midia: { interna: [], externa: [] } }) });
  assert.equal((await importarProduto(base, L, "OC1224"))[0].motivo, "bling_sem_imagem");
  assert.deepEqual(extrairMidia({ data: { midia: { imagens: { internas: [{ link: "a" }, { x: 1 }], externas: [{ link: "b" }] } } } }), { interna: ["a"], externa: ["b"] });
  assert.equal(extrairMidia({}), null); assert.equal(caminhoBase("não é url"), "");
});
