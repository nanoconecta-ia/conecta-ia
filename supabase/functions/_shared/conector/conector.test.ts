import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTRATOS, PROIBIDAS_AO_PUBLICO, validarContrato } from "./contratos.ts";
import { COLUNAS_CONTROLE, MATRIZ } from "./matriz_bling.ts";
import { FERRAMENTAS } from "../ia/ferramentas.ts";
import { FERRAMENTAS as FERRAMENTAS_BLING } from "../bling_ferramentas.ts";
import { mapearProduto } from "../bling_sync.ts";

test("contratos: todo contrato é coerente (aprovação, risco, escopo público, escrita no ERP)", () => {
  const violacoes = CONTRATOS.flatMap(validarContrato);
  assert.deepEqual(violacoes, []);
});

test("contratos: nomes únicos", () => {
  const nomes = CONTRATOS.map((c) => c.nome);
  assert.equal(new Set(nomes).size, nomes.length);
});

test("contratos x código: as ferramentas do agente admin são exatamente as implementadas no contrato", () => {
  const noCodigo = FERRAMENTAS.map((f) => f.name).sort();
  const noContrato = CONTRATOS.filter((c) => c.escopo === "admin" && c.estado === "implementada").map((c) => c.nome).sort();
  assert.deepEqual(noContrato, noCodigo);
});

test("contratos x código: campos obrigatórios do contrato batem com o input_schema real", () => {
  for (const f of FERRAMENTAS) {
    const c = CONTRATOS.find((x) => x.nome === f.name)!;
    const real = ((f.input_schema as { required?: string[] }).required ?? []).slice().sort();
    // propor_* exigem fonte no schema; as demais só o que o schema exige
    assert.deepEqual(c.obrigatorios.slice().sort(), real, `${f.name}: obrigatórios divergem do schema`);
  }
});

test("agente admin implementado não escreve no ERP nem tem verbo de escrita/aprovação", () => {
  for (const c of CONTRATOS.filter((x) => x.estado === "implementada")) {
    assert.notEqual(c.operacao, "escrita_erp", c.nome);
    assert.doesNotMatch(c.nome, /^(aprovar|publicar|alterar|criar|apagar|excluir|gravar|enviar)/);
  }
  for (const c of CONTRATOS.filter((x) => x.operacao === "proposta" && x.estado === "implementada")) {
    assert.ok(c.aprovacaoHumana, `${c.nome} precisa de aprovação humana`);
  }
});

test("toda escrita do catálogo Bling está desligada e exige aprovação e idempotency_key", () => {
  for (const f of FERRAMENTAS_BLING.filter((x) => x.metodo !== "GET")) {
    assert.equal(f.ativa, false, `${f.nome} deveria estar desligada`);
    assert.equal(f.exigeAprovacao, true, f.nome);
    assert.equal(f.exigeIdempotencyKey, true, f.nome);
    assert.equal(f.retry, "nenhum", f.nome);
  }
});

test("agente público: só leitura LOW, sem tabela proibida, e a lista de proibidas não é vazia", () => {
  const pub = CONTRATOS.filter((c) => c.escopo === "publico");
  assert.ok(pub.length >= 2);
  assert.ok(PROIBIDAS_AO_PUBLICO.includes("auditoria") && PROIBIDAS_AO_PUBLICO.includes("bling_conexoes"));
  for (const c of pub) { assert.equal(c.risco, "LOW"); assert.equal(c.operacao, "leitura"); }
});

test("validarContrato recusa contratos perigosos (sanidade do próprio validador)", () => {
  const base = CONTRATOS[0];
  assert.ok(validarContrato({ ...base, nome: "x", operacao: "escrita_erp", risco: "LOW", aprovacaoHumana: false, idempotencyKey: false }).length >= 2);
  assert.ok(validarContrato({ ...base, nome: "y", escopo: "publico", le: ["auditoria"] }).some((m) => m.includes("proibida")));
  assert.ok(validarContrato({ ...base, nome: "z", escopo: "publico", operacao: "proposta" }).length >= 1);
  assert.ok(validarContrato({ ...base, nome: "w", operacao: "escrita_erp", risco: "MEDIUM", aprovacaoHumana: true, idempotencyKey: true, estado: "implementada" })
    .some((m) => m.includes("implementada")));
});

test("matriz: cada coluna que o espelho grava tem linha implementada bling->conecta", () => {
  const linha = mapearProduto("loja", { id: 1 }, {}, "2026-01-01T00:00:00Z");
  const colunas = Object.keys(linha).filter((k) => !COLUNAS_CONTROLE.includes(k));
  const cobertas = new Set(MATRIZ.filter((m) => m.estado === "implementado" && m.direcao === "bling->conecta").map((m) => m.destino.replace("produtos.", "")));
  for (const c of colunas) assert.ok(cobertas.has(c), `coluna ${c} do espelho sem linha na matriz`);
});

test("matriz: nenhuma linha implementada escreve no Bling; proibidos sem destino; custo/fornecedor fora do espelho", () => {
  assert.equal(MATRIZ.filter((m) => m.direcao === "conecta->bling" && m.estado === "implementado").length, 0);
  for (const m of MATRIZ.filter((x) => x.estado === "proibido")) { assert.equal(m.destino, "-"); assert.equal(m.direcao, "proibida"); }
  const colunas = Object.keys(mapearProduto("l", { id: 1 }, { precoCusto: 9, fornecedor: { id: 1 } }, "2026-01-01T00:00:00Z"));
  assert.ok(!colunas.some((c) => /custo|fornec/.test(c)));
  for (const nome of ["preco_custo", "fornecedor", "ncm_cest_cst_cfop_no_bling", "preco_venda_por_ia", "estoque_por_ia"])
    assert.ok(MATRIZ.some((m) => m.campo === nome && m.estado === "proibido"), nome);
});

test("matriz: nada afirma ter conferido a documentação do Bling (conferidoDoc só vira true com evidência)", () => {
  assert.ok(MATRIZ.every((m) => m.conferidoDoc === false));
});
