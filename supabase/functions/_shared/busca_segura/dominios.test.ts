import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirDominio, marcaDaEntidade, separarReferencias, textoDeOrigem, urlLimpa, type DominioCadastrado } from "./dominios.ts";

const reg: DominioCadastrado[] = [
  { dominio: "mahle.com", entidade: "MAHLE Metal Leve", marcas: ["MAHLE", "Metal Leve"], tipo: "fabricante", status: "verificado" },
  { dominio: "fabricante-trimgo.exemplo", entidade: "Fabricante da TRIM GO", marcas: ["TRIM GO"], tipo: "fabricante", status: "verificado" },
  { dominio: "distribuidor.exemplo", entidade: "Distribuidor X", marcas: ["TRIM GO"], tipo: "distribuidor", status: "verificado" },
  { dominio: "novo.exemplo", entidade: "Novo", marcas: ["NOVA"], tipo: "fabricante", status: "nao_verificado" },
];
test("fabricante da PRÓPRIA marca, domínio verificado e código na página: origem PÚBLICA com a página", () => {
  const d = decidirDominio("https://catalogo.mahle.com/produto/bb-778-j?utm=x#a", "Metal Leve", reg, true);
  assert.equal(d.papel, "origem_do_fabricante"); assert.equal(d.publico, true);
  assert.equal(textoDeOrigem("Metal Leve", "https://catalogo.mahle.com/produto/bb-778-j?utm=x#a", d), "Fabricante: Metal Leve. Origem e garantia do fabricante: https://catalogo.mahle.com/produto/bb-778-j");
});
test("domínio de OUTRA marca (concorrente) é só referência técnica: sem propaganda", () => {
  const d = decidirDominio("https://catalogo.mahle.com/produto/x", "Sabó", reg, true);
  assert.equal(d.publico, false); assert.equal(d.papel, "referencia_tecnica"); assert.match(d.motivo, /sem propaganda/);
  assert.equal(textoDeOrigem("Sabó", "https://catalogo.mahle.com/produto/x", d), null);
});
test("distribuidor, marketplace, domínio não cadastrado ou não verificado nunca viram origem pública", () => {
  for (const u of ["https://distribuidor.exemplo/p", "https://produto.mercadolivre.com.br/MLB-1", "https://desconhecido.exemplo/p", "https://novo.exemplo/p"]) {
    assert.equal(decidirDominio(u, u.includes("novo") ? "NOVA" : "TRIM GO", reg, true).publico, false, u);
  }
  assert.match(decidirDominio("https://distribuidor.exemplo/p", "TRIM GO", reg, true).motivo, /não é o fabricante que responde pela garantia/);
});
test("sem o código confirmado na página, nem o fabricante certo vira origem pública", () => {
  assert.equal(decidirDominio("https://fabricante-trimgo.exemplo/p", "TRIM GO AUTOPARTS", reg, false).publico, false);
  assert.equal(decidirDominio("https://fabricante-trimgo.exemplo/p", "TRIM GO AUTOPARTS", reg, true).publico, true, "TRIM GO AUTOPARTS casa com a marca TRIM GO");
});
test("subdomínio do fabricante vale; domínio parecido (sufixo enganoso) não", () => {
  assert.equal(decidirDominio("https://loja.mahle.com/x", "MAHLE", reg, true).publico, true);
  assert.equal(decidirDominio("https://naomahle.com/x", "MAHLE", reg, true).publico, false);
  assert.equal(decidirDominio("https://mahle.com.falso.exemplo/x", "MAHLE", reg, true).publico, false);
});
test("marca: casa com variações da própria marca, nunca com outra", () => {
  assert.ok(marcaDaEntidade("SABO", ["Sabó"])); assert.ok(marcaDaEntidade("TRIM GO AUTOPARTS", ["TRIM GO"]));
  assert.ok(!marcaDaEntidade("Jusa", ["Sabó"])); assert.ok(!marcaDaEntidade("Metal", ["Metal Leve"])); assert.ok(!marcaDaEntidade("", ["X"]));
});
test("URL só https e sem rastreadores", () => {
  assert.equal(urlLimpa("http://x.com/a"), null); assert.equal(urlLimpa("lixo"), null);
  assert.equal(urlLimpa("https://x.com/a?srsltid=ABC&utm=1#frag"), "https://x.com/a");
});
test("separarReferencias: no máximo UMA origem pública (do fabricante da marca); o resto vira referência interna", () => {
  const r = separarReferencias([
    { url: "https://catalogo.mahle.com/p/1", codigoConfirmado: true },
    { url: "https://loja.mahle.com/p/1", codigoConfirmado: true },
    { url: "https://concorrente.exemplo/p/1", codigoConfirmado: true },
    { url: "https://produto.mercadolivre.com.br/MLB-1", codigoConfirmado: true },
  ], "Metal Leve", reg);
  assert.equal(r.publicas.length, 1); assert.equal(r.publicas[0].host, "catalogo.mahle.com");
  assert.equal(r.internas.length, 3);
  assert.ok(r.internas.some((i) => /já existe uma origem pública/.test(i.motivo)));
  assert.ok(!JSON.stringify(r.publicas).includes("concorrente") && !JSON.stringify(r.publicas).includes("mercadolivre"));
});
