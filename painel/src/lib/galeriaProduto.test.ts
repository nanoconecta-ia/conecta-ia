import { test } from "node:test";
import assert from "node:assert/strict";
import { galeriaDaFicha, hostDaOrigem, LIMITE_GALERIA, pedidoDeImagens, resumirImagem, type LinhaImagem } from "./galeriaProduto.ts";

const base = (n: number, p: Partial<LinhaImagem> = {}): LinhaImagem => ({
  id: `i${n}`, url: `https://cdn.exemplo.com/${n}.jpg`, tipo: "real", origem: "busca_web", url_original: `https://www.fabricante.exemplo.com.br/pagina/${n}`, licenca_tipo: "fabricante",
  cruzamento_tipo: "oem", cruzamento_valor: "20910-4AU07", confianca: 0.9, largura_px: 1200, altura_px: 900, aprovada: false, principal: false,
  direitos_confirmados_em: "2026-11-01", removida_em: null, ordem: n, ...p });

test("a galeria mostra no máximo 8 imagens ativas, em ordem, e informa as vagas", () => {
  const linhas = Array.from({ length: 11 }, (_, i) => base(i + 1));
  const g = galeriaDaFicha(linhas);
  assert.equal(g.itens.length, LIMITE_GALERIA); assert.equal(g.cheia, true); assert.equal(g.vagas, 0);
  assert.deepEqual(g.itens.map((i) => i.id), ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"]);
  const g2 = galeriaDaFicha([base(1), base(2, { removida_em: "2026-11-02" })]);
  assert.equal(g2.itens.length, 1); assert.equal(g2.vagas, 7); assert.equal(g2.cheia, false);
});
test("nenhuma imagem pendente é publicável; aprovada sem direitos também não", () => {
  assert.equal(resumirImagem(base(1)).publicavel, false);
  const sem = resumirImagem(base(2, { aprovada: true, licenca_tipo: null, direitos_confirmados_em: null }));
  assert.equal(sem.estado, "aprovada"); assert.equal(sem.publicavel, false); assert.ok(sem.avisos.some((a) => /aprovar não publica/.test(a)));
  assert.equal(resumirImagem(base(3, { aprovada: true })).publicavel, true);
});
test("direitos: fornecedor/fabricante/web exigem confirmação registrada; própria e licenciada valem", () => {
  assert.equal(resumirImagem(base(1, { licenca_tipo: "fornecedor", direitos_confirmados_em: null })).direitos, false);
  assert.equal(resumirImagem(base(1, { licenca_tipo: "propria", direitos_confirmados_em: null })).direitos, true);
  assert.equal(resumirImagem(base(1, { licenca_tipo: "licenciada", direitos_confirmados_em: null })).direitos, true);
});
test("identidade: só sku/ean/oem/fabricante provam; similar/substituto e ausência não", () => {
  assert.equal(resumirImagem(base(1)).identidade, "confere");
  assert.equal(resumirImagem(base(1, { cruzamento_tipo: "similar" })).identidade, "nao_prova");
  assert.equal(resumirImagem(base(1, { cruzamento_tipo: null, cruzamento_valor: null })).identidade, "sem_cruzamento");
});
test("imagem servida igual à de terceiros, retirada ou não-https nunca é publicável", () => {
  assert.equal(resumirImagem(base(1, { aprovada: true, url: "https://www.fabricante.exemplo.com.br/pagina/1", url_original: "https://www.fabricante.exemplo.com.br/pagina/1" })).publicavel, false);
  assert.equal(resumirImagem(base(1, { aprovada: true, removida_em: "2026-11-02" })).publicavel, false);
  assert.equal(resumirImagem(base(1, { aprovada: true, url: "http://x.com/a.jpg" })).publicavel, false);
});
test("rótulo e avisos para imagem não real e resolução baixa/desconhecida; resolução e confiança formatadas", () => {
  const r = resumirImagem(base(1, { tipo: "ilustrativa", largura_px: 200, altura_px: 150 }));
  assert.equal(r.rotulo, "Imagem ilustrativa"); assert.ok(r.avisos.some((a) => /resolução baixa/.test(a)) && r.avisos.some((a) => /ilustrativa/.test(a)));
  assert.equal(resumirImagem(base(1, { tipo: "gerada_ia" })).rotulo, "Imagem gerada por IA, apenas ilustração");
  assert.equal(resumirImagem(base(1, { largura_px: null, altura_px: null })).resolucao, "desconhecida");
  assert.equal(resumirImagem(base(1)).resolucao, "1200×900"); assert.equal(resumirImagem(base(1)).confianca, "90%");
  assert.equal(resumirImagem(base(1, { tipo: "real" })).rotulo, null);
});
test("a origem mostra só o host (a URL de terceiros não vira link)", () => {
  assert.equal(hostDaOrigem(base(1)), "fabricante.exemplo.com.br");
  assert.equal(hostDaOrigem({ url_original: null, url: "não é url", origem: "busca_web" }), "busca_web");
  assert.equal(hostDaOrigem({ url_original: null, url: "", origem: null }), "origem não registrada");
});
test("o pedido ao Nano exige código escrito na página, descarta marca d'água e deixa a aprovação para o lojista", () => {
  const p = pedidoDeImagens("CI000016");
  for (const t of ["CI000016", "até 8", "código aparece escrito", "marca d'água", "a aprovação é minha"]) assert.ok(p.includes(t), t);
});
