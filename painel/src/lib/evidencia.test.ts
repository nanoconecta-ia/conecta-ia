import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaCandidato, linhaFonte, resumoConclusao, rotuloSituacao, selosCandidato, type CandidatoEv, type ConclusaoEv, type FonteEv } from "./evidencia.ts";

const c: CandidatoEv = { id: "12753970402", sku: "5112", nome: "833333 KIT EMBREAGEM", situacao: "excluido", preco: 1500, estoque: 1, achado_por: ["sku_exato", "gtin"], origem: "api_bling", no_espelho: false, sincronizado_em: null };
test("candidato excluído mostra situação, origem, se está no espelho e como foi achado", () => {
  assert.equal(rotuloSituacao("excluido"), "Excluído");
  assert.deepEqual(selosCandidato(c), ["Excluído", "dado da API do Bling", "fora do espelho", "achado por: SKU exato", "achado por: GTIN"]);
  assert.match(linhaCandidato(c), /833333 KIT EMBREAGEM · SKU 5112 · ID 12753970402 · R\$ 1500\.00 · estoque 1/);
  assert.match(linhaCandidato({ ...c, sku: null, preco: null, estoque: null, nome: null }), /sem nome · SKU sem SKU · .*preço não informado · estoque não informado/);
});
test("fonte não consultada ou incompleta é dita com o motivo; nunca vira 'sem resultado'", () => {
  const api: FonteEv = { origem: "api_bling", consulta: "sku_exato", consultada: false, completa: false, total: 0, paginas: 0, motivo: "reconectar_bling" };
  assert.equal(linhaFonte(api), "API do Bling (SKU exato): NÃO consultada — Bling precisa ser reconectado");
  assert.match(linhaFonte({ ...api, consultada: true, completa: false, total: 300, paginas: 3, motivo: "paginas_limite_atingido" }), /leitura INCOMPLETA \(mais páginas do que o limite lido\)/);
  assert.match(linhaFonte({ origem: "espelho", consulta: "x", consultada: true, completa: true, total: 1, paginas: 1, motivo: null }), /Espelho do Conecta \(só produtos ativos sincronizados\): 1 resultado\(s\) em 1 página\(s\)$/);
});
test("conclusão: ausência só aparece como comprovada quando o servidor disse; criação sempre 'não'", () => {
  const base: ConclusaoEv = { ausencia_nos_filtros_pesquisados: false, api_completa: false, apenas_espelho: true, autoriza_criacao: false, aviso: "" };
  assert.match(resumoConclusao(base), /Ausência no ERP: NÃO comprovada\. Criação de cadastro autorizada por esta busca: não\./);
  assert.match(resumoConclusao({ ...base, ausencia_nos_filtros_pesquisados: true, api_completa: true }), /filtros pesquisados/);
});
