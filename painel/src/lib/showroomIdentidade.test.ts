import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("mesmo arquivo MA oficial em todas as páginas do showroom", () => {
  const marca = ler("../componentes/MarcaMobisOficial.tsx");
  const produto = ler("../componentes/ShowroomProdutoMobis.tsx");
  const aplicacao = ler("../paginas/PaginaAplicacaoMobis.tsx");
  const destaque = ler("../componentes/BannerMobis.tsx");
  assert.match(marca, /mobis-mstyle-v3-sem-slogan\.svg/);
  assert.match(marca, /<img src=\{logoOficial\}/);
  assert.match(produto, /<MarcaMobisOficial/);
  assert.match(aplicacao, /<MarcaMobisOficial/);
  assert.match(destaque, /mobis-mstyle-v3-sem-slogan\.svg/);
  assert.doesNotMatch(destaque, /aria-hidden="true">M<\/span>/);
});

test("banner de SKU na vitrine não inventa logo nem troca o nome do revendedor", () => {
  const produto = ler("../componentes/ShowroomProdutoMobis.tsx");
  const marca = ler("../componentes/MarcaMobisOficial.tsx");
  assert.match(marca, /Loja revendedora independente/);
  assert.match(produto, /revendedora independente/);
  assert.match(produto, /rotuloOemConjunto\(null, false\)/);
  assert.doesNotMatch(produto, /OEM Original Hyundai|OEM Original Kia|Homologado automaticamente/);
});

test("foto preservada em fundo branco e aplicações sem link quando pendentes", () => {
  const estilo = ler("../componentes/showroom-mobis.css");
  const produto = ler("../componentes/ShowroomProdutoMobis.tsx");
  assert.match(estilo, /background:#fff/);
  assert.match(estilo, /object-fit:contain/);
  assert.match(produto, /destino && homologada/);
  assert.match(produto, /Foto real da peça em preparação/);
});

test("páginas públicas exigem aplicação indexável e homologada", () => {
  const pagina = ler("../paginas/ProdutoPublico.tsx");
  const aplicacao = ler("../paginas/PaginaAplicacaoMobis.tsx");
  assert.match(pagina, /a\.status === "aprovado" && a\.indexavel === true/);
  assert.match(aplicacao, /p\.status==="aprovado" && p\.indexavel===true/);
});
