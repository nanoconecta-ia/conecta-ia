import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarAplicacaoCronologica, avaliarVinculoCronologico,
  type GeracaoDocumentada, type ProdutoCruzar, type PropostaAplicacaoCronologica,
  type PropostaVinculoCronologico,
} from "./regras_cronologia_fabrica.ts";

const geracao = (projeto_geracao: string | null = "PROJETO-DOCUMENTADO"): GeracaoDocumentada => ({
  montadora: "Hyundai", modelo: "HR", mercado: "BR", projeto_geracao,
  fase: "revisao documentada", codigo_motor: "D4CB",
  ano_inicio: 2014, ano_fim: 2017, tipo_ano: "ano_modelo",
  fonte_versao: "Ficha montadora para esta versao e periodo",
});
const aplicacao = (ger: GeracaoDocumentada = geracao()): PropostaAplicacaoCronologica => ({
  sku: "CI003696", conjunto: "motor_parcial_com_cabecote", versao: ger,
  fonte_compatibilidade_sku: "Catalogo tecnico do fabricante por codigo deste SKU",
  status: "a_confirmar",
});
const produto = (sku: string, nivel: ProdutoCruzar["nivel"]): ProdutoCruzar => ({
  sku, nivel, bling_id: "bling-" + sku,
  fonte_identidade_fisica: "NF e lista fisica documentada deste SKU",
});
const vinculo = (): PropostaVinculoCronologico => ({
  origem: produto("CI003696", "motor_parcial_com_cabecote"),
  destino: produto("IMPORTADO-B", "motor_parcial_com_cabecote"),
  tipo: "equivalencia_conjunto",
  evidencia_direta: "Cotejo de codigos, packing lists e interfaces dos dois SKUs",
  composicao_conferida: true, interfaces_conferidas: true,
  versoes_comparadas: [aplicacao()],
});

test("aplicacao cronologica documentada fica revisavel, nao homologada automaticamente", () => {
  const r = avaliarAplicacaoCronologica(aplicacao());
  assert.equal(r.estado, "revisavel");
  assert.deepEqual(r.bloqueios, []);
});

test("HR no mesmo ano com duas geracoes exige duas provas independentes", () => {
  const anterior = aplicacao(geracao("PROJETO-A"));
  const posterior = aplicacao({ ...geracao("PROJETO-B"), fonte_versao: null });
  assert.equal(avaliarAplicacaoCronologica(anterior).estado, "revisavel");
  assert.equal(avaliarAplicacaoCronologica(posterior).estado, "a_confirmar");
  assert.deepEqual(anterior.versao.ano_inicio, posterior.versao.ano_inicio);
});

test("mesmo nome de motor, sem geracao e sem fonte do SKU, nao autoriza aplicacao", () => {
  const p = aplicacao({ ...geracao(null), fonte_versao: null });
  p.fonte_compatibilidade_sku = null;
  const r = avaliarAplicacaoCronologica(p);
  assert.equal(r.estado, "a_confirmar");
  assert.ok(r.pendencias.includes("geracao_fabrica_nao_comprovada"));
  assert.ok(r.pendencias.includes("prova_aplicacao_desse_sku_ausente"));
});

test("cobertura de catalogo de reposicao nao comprova cronologia da fabrica", () => {
  const p = aplicacao({ ...geracao(), tipo_ano: "cobertura_catalogo" });
  assert.equal(avaliarAplicacaoCronologica(p).estado, "a_confirmar");
});

test("fim de aplicacao ausente nao significa fabricacao vigente", () => {
  const r = avaliarAplicacaoCronologica(aplicacao({ ...geracao(), ano_fim: null }));
  assert.equal(r.estado, "a_confirmar");
  assert.ok(r.pendencias.includes("fim_nao_comprovado"));
});

test("aprovado sem provas cronologicas bloqueia declaracao", () => {
  const p = aplicacao({ ...geracao(), fonte_versao: null });
  p.status = "aprovado";
  assert.equal(avaliarAplicacaoCronologica(p).estado, "bloqueado");
});

test("ano de fim anterior ao de inicio bloqueia", () => {
  const r = avaliarAplicacaoCronologica(aplicacao({ ...geracao(), ano_inicio: 2020, ano_fim: 2013 }));
  assert.ok(r.bloqueios.includes("periodo_invalido"));
});

test("dois SKUs de mesmo conjunto so ficam revisaveis com documentos diretos e geracoes", () => {
  assert.equal(avaliarVinculoCronologico(vinculo()).estado, "revisavel");
  assert.equal(avaliarVinculoCronologico({ ...vinculo(), interfaces_conferidas: false }).estado, "a_confirmar");
  assert.equal(avaliarVinculoCronologico({ ...vinculo(), evidencia_direta: null }).estado, "a_confirmar");
});

test("motor curto sem cabecote nao equivale ao parcial com cabecote", () => {
  const v = vinculo(); v.destino.nivel = "motor_curto_sem_cabecote";
  const r = avaliarVinculoCronologico(v);
  assert.equal(r.estado, "bloqueado");
  assert.ok(r.bloqueios.includes("nivel_do_conjunto_diferente"));
});

test("cabecote avulso nao pode substituir motor parcial completo", () => {
  const v = vinculo(); v.destino.nivel = "cabecote_avulso";
  const r = avaliarVinculoCronologico(v);
  assert.equal(r.estado, "bloqueado");
});

test("avulso com SKU/NF proprios e inclusao nao comprovada fica a confirmar", () => {
  const v = vinculo();
  v.destino.nivel = "cabecote_avulso";
  v.tipo = "componente_avulso";
  v.composicao_conferida = false;
  const r = avaliarVinculoCronologico(v);
  assert.equal(r.estado, "a_confirmar");
  assert.ok(r.pendencias.includes("inclusao_fisica_do_avulso_nao_documentada"));
  assert.equal(v.origem.bling_id === v.destino.bling_id, false);
});

test("sucessao entre codigos exige boletim, sentido e periodo documentados", () => {
  const v = vinculo(); v.tipo = "sucessao_codigo"; v.boletim_sucessao = null;
  assert.equal(avaliarVinculoCronologico(v).estado, "a_confirmar");
});

test("mesmo SKU nao constitui relacao independente nem cria estoque novo", () => {
  const v = vinculo(); v.destino.sku = v.origem.sku;
  assert.equal(avaliarVinculoCronologico(v).estado, "bloqueado");
});
