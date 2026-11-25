import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ler = (s: string) => readFileSync(new URL(s, import.meta.url), "utf8");

test("showroom segue referência com abas reais e três quadros técnicos", () => {
  const componente=ler("../componentes/ShowroomProdutoMobis.tsx");
  const estilo=ler("../componentes/showroom-catalogo-referencia.css");
  for(const token of ["O que acompanha","Ficha técnica","Índice OEM / SKU","Aplicações","Dados logísticos","Bula técnica"]){
    assert.ok(componente.includes(token), "faltou aba: "+token);
  }
  assert.match(componente,/role="tablist"/);
  assert.match(componente,/setAba\(t\.id\)/);
  assert.match(componente,/sm-ref-grade/);
  assert.match(estilo,/grid-template-columns:minmax\(250px/);
  assert.match(estilo,/@media\(max-width:480px\)/);
});

test("logotipo corporativo é o MA original do projeto e não letra improvisada", () => {
  const componente=ler("../componentes/ShowroomProdutoMobis.tsx");
  const marca=ler("../componentes/MarcaMobisOficial.tsx");
  assert.match(componente,/<MarcaMobisOficial/);
  assert.match(marca,/mobis-mstyle-v3-sem-slogan\.svg/);
});

test("arte de referência não autoriza OEM, SKUs avulsos ou aplicações comerciais", () => {
  const componente=ler("../componentes/ShowroomProdutoMobis.tsx");
  assert.match(componente,/c\.status === "aprovado"/);
  assert.match(componente,/c\.inclusao_no_conjunto === "confirmada"/);
  assert.match(componente,/c\.fonte\?\.trim\(\)/);
  assert.match(componente,/faixasPublicasPorAplicacao\(aplicacoes\)/);
  assert.match(componente,/rotuloOemConjunto\(null, false\)/);
  assert.doesNotMatch(componente,/CI003697|CI003698|CI003699|CI003700|CI003714|22100-4A701|24100-4A100/);
  assert.doesNotMatch(componente,/aplicações homologadas|Motor NOVO \||Bloco Virgem \|/i);
});

test("fotos não são substituídas por vistas artificiais da arte", () => {
  const componente=ler("../componentes/ShowroomProdutoMobis.tsx");
  const estilo=ler("../componentes/showroom-catalogo-referencia.css");
  assert.match(componente,/fotos_publicas_aprovadas/);
  assert.match(componente,/Foto real da peça em preparação/);
  assert.match(estilo,/object-fit:contain/);
  assert.match(estilo,/filter:none!important/);
});

test("dados de foto, preço e bula são condicionais, e avulsos mantêm escopo próprio", () => {
  const componente=ler("../componentes/ShowroomProdutoMobis.tsx");
  assert.match(componente,/produto\.preco !== null/);
  assert.match(componente,/bula\?\.descricao && bula\?\.fonte/);
  assert.match(componente,/SKU avulso, quando houver, possui estoque próprio/);
});
