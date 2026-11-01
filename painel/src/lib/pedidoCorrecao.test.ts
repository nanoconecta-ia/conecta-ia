import { test } from "node:test";
import assert from "node:assert/strict";
import { marcaGenerica, montarPedidoCorrecao, pendenciasDaFicha, type FichaParaPedido } from "./pedidoCorrecao.ts";

const base: FichaParaPedido = { sku: "82892/", nome: "82892 JUNTA CABECOTE METALICA 0 90MM", marca: "IMPORTADO", gtin: "7891252828923", peso_kg: null, imagens: 0, categoria: "Juntas e retentores", taxonomia: "Motor › Juntas e retentores", descricaoVazia: true };

test("marca genérica: origem e termos vagos não identificam fabricante", () => {
  for (const m of ["IMPORTADO", " importada ", "Nacional", "GENÉRICO", "Sem marca", "", null, "Original"]) assert.equal(marcaGenerica(m), true, String(m));
  for (const m of ["SABÓ", "TRIM GO", "Mahle", "NGK"]) assert.equal(marcaGenerica(m), false, m);
});

test("o caso real da ficha 82892: marca IMPORTADO, peso e imagem pendentes", () => {
  const p = pendenciasDaFicha(base);
  assert.ok(p.some((x) => x.includes('"IMPORTADO"') && x.includes("fabricante")));
  assert.ok(p.some((x) => x.startsWith("Peso")) && p.some((x) => x.startsWith("Sem imagem")) && p.some((x) => x.startsWith("Descrição")));
  assert.ok(!p.some((x) => x.startsWith("GTIN")) && !p.some((x) => x.includes("taxonomia")), "GTIN e taxonomia estão preenchidos");
});

test("o pedido carrega o produto, as pendências e as regras de prova e aprovação", () => {
  const t = montarPedidoCorrecao(base);
  assert.match(t, /SKU 82892\//);
  assert.match(t, /Marca: IMPORTADO/);
  assert.match(t, /PROPOSTA, com fonte, data e nível de confiança/);
  assert.match(t, /não aprova nem grava no Bling/);
  assert.match(t, /SKU, nome do produto ou GTIN sozinhos não provam o fabricante/);
  assert.doesNotMatch(t, /precoCusto|preço de compra|NCM|CEST/i);
});

test("o que o lojista sabe entra como hipótese sem fonte, nunca como fato", () => {
  const t = montarPedidoCorrecao({ ...base, observacaoLojista: "acho que é da Sabó" });
  assert.match(t, /hipótese, SEM fonte: confirme antes de usar\): acho que é da Sabó/);
  assert.doesNotMatch(montarPedidoCorrecao(base), /Informação do lojista/);
});

test("observação enorme é cortada e produto sem lacunas não inventa pendência", () => {
  const t = montarPedidoCorrecao({ ...base, marca: "SABÓ", peso_kg: 0.2, imagens: 2, descricaoVazia: false, observacaoLojista: "x".repeat(5000) });
  assert.ok(t.length < 2500);
  assert.match(t, /Nenhuma lacuna básica detectada/);
});

test("a posição sugerida na taxonomia entra como hipótese sem fonte", () => {
  const t = montarPedidoCorrecao({ ...base, taxonomiaSugerida: "Motor › Juntas e retentores" });
  assert.match(t, /Posição na taxonomia sugerida pelo lojista \(hipótese, SEM fonte\): Motor › Juntas e retentores/);
  assert.doesNotMatch(montarPedidoCorrecao(base), /Posição na taxonomia sugerida/);
});
