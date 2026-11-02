// Fixture = trecho REAL da 1ª página do Bling em 02/11/2026 (criterio "todos", ordem alfabética): só campos públicos (id, código, nome, situação).
import { test } from "node:test";
import assert from "node:assert/strict";
import { finalizarDiagnostico, novoDiagnostico, somarPagina, type ProdutoResumo } from "./diagnostico_cadastro.ts";

const PAGINA_REAL: ProdutoResumo[] = [
  { id: 16242466090, codigo: "82892/", nome: "-JUNTA DE CABEÇOTE METALICA  HYUNDAI HR STD 2.5 CRDI D4CB SABO 82892 HYUNDAI HR", situacao: "E" },
  { id: 15953412834, codigo: "82892", nome: "-JUNTA DE CABEÇOTE METALICA  HYUNDAI HR STD 2.5 CRDI D4CB SABO 82892", situacao: "E" },
  { id: 16366986207, codigo: "03044-BREF", nome: "03044-BREF - RETENTOR DE VALVULA MOTOR", situacao: "E" },
  { id: 16622651020, codigo: "03044-BREF", nome: "03044-BREF - RETENTOR DE VALVULA MOTOR", situacao: "E" },
  ...[1743, 1808, 1839, 2003, 4021].map((c, i) => ({ id: 100 + i, codigo: String(c), nome: "05775 BRGF RETENTOR DIANT VIRAB (MD343563)44X60X7", situacao: "E" })),
  { id: 16564565007, codigo: "190191", nome: "05794BRGEF RETENTOR DIANT VIRABREQUIM - SAB", situacao: "E" },
  { id: 16622651167, codigo: "190191", nome: "05794BRGEF RETENTOR DIANT VIRABREQUIM - SAB", situacao: "E" },
  { id: 16721657772, codigo: "CI000016", nome: "Bomba d'água TRIM GO HR/K2500 2.5 8V Euro III com juntas", situacao: "A" },
  { id: 1, codigo: "", nome: "PRODUTO SEM CODIGO", situacao: "I" },
  { id: 2, codigo: "CI001086", nome: null, situacao: "A" },
];
test("conta por situação, sem SKU, sem nome e a maior sequência CI", () => {
  const r = finalizarDiagnostico(somarPagina(novoDiagnostico(), PAGINA_REAL));
  assert.equal(r.total, 14); assert.deepEqual(r.porSituacao, { excluido: 11, ativo: 2, inativo: 1 });
  assert.equal(r.semSku, 1); assert.equal(r.semNome, 1); assert.equal(r.maiorSequenciaCi, 1086); assert.equal(r.proximoSkuSugerido, "CI001087");
});
test("acha o MESMO código repetido em registros diferentes (candidato a duplicidade), com os ids", () => {
  const r = finalizarDiagnostico(somarPagina(novoDiagnostico(), PAGINA_REAL));
  const cod = Object.fromEntries(r.skusDuplicados.map((d) => [d.codigo, d]));
  assert.deepEqual(cod["03044-BREF"].ids, ["16366986207", "16622651020"]); assert.deepEqual(cod["190191"].situacoes, ["excluido", "excluido"]);
  assert.equal(r.resumo.codigosRepetidos, 2);
});
test("acha o MESMO nome sob códigos diferentes (ex.: retentor 05775 com 5 códigos) e conta os ativos do grupo", () => {
  const r = finalizarDiagnostico(somarPagina(novoDiagnostico(), PAGINA_REAL));
  const g = r.nomesDuplicados.find((n) => /05775 BRGF/.test(n.nome))!;
  assert.equal(g.registros, 5); assert.deepEqual(g.codigos, ["1743", "1808", "1839", "2003", "4021"]); assert.equal(g.ativosNoGrupo, 0);
  assert.ok(r.resumo.gruposDeNomeRepetido >= 3); assert.equal(r.resumo.gruposComAtivo, 0);
});
test("em PÁGINAS dá o mesmo resultado que de uma vez (estado carregado entre chamadas)", () => {
  const tudo = finalizarDiagnostico(somarPagina(novoDiagnostico(), PAGINA_REAL));
  let e = novoDiagnostico(); for (let i = 0; i < PAGINA_REAL.length; i += 4) e = somarPagina(e, PAGINA_REAL.slice(i, i + 4));
  assert.deepEqual(finalizarDiagnostico(e), tudo);
});
test("o relatório é só leitura: avisa que são candidatos, não decisão, e que nada é apagado", () => {
  const r = finalizarDiagnostico(somarPagina(novoDiagnostico(), PAGINA_REAL), 1);
  assert.match(r.aviso, /Nada foi apagado, mesclado ou gravado/); assert.equal(r.skusDuplicados.length, 1); assert.equal(r.nomesDuplicados.length, 1);
});
test("catálogo vazio: totais zerados e próximo SKU CI000001", () => {
  const r = finalizarDiagnostico(novoDiagnostico());
  assert.equal(r.total, 0); assert.equal(r.proximoSkuSugerido, "CI000001");
});
