import { test } from "node:test";
import assert from "node:assert/strict";
import { aReconciliar, compararCampos, corpoDecisao, exigeConfirmacao, itensAprovaveis, podeDecidir, prazo, resumoOperacoes, type ItemProposta, type Proposta } from "./propostas.ts";

const P = (o: Partial<Proposta> = {}): Proposta => ({ id: "p1", loja_id: "l1", solicitante_user: "u1", agente: "Nano.ia", provedor: "claude", modelo: "m", titulo: "Enriquecer", resumo: null, risco: "MEDIUM", versao: 3, lote: false, estado: "pendente", hash: "h".repeat(64), expira_em: new Date(Date.now() + 3_600_000).toISOString(), criado_em: "2026-10-19T00:00:00Z", enviado_em: null, decidido_em: null, ...o });
const I = (o: Partial<ItemProposta> = {}): ItemProposta => ({ id: "i1", proposta_id: "p1", produto_id: "pr1", ordem: 0, operacao: "conecta.enriquecimento.definir", alvo: null, campos: ["marca_peca"], antes: { marca_peca: null }, depois: { marca_peca: "Sabó" }, fontes: [{ url: "https://x.com" }], validacoes: [], risco: "MEDIUM", estado: "pendente", motivo: null, ...o });

test("propostas: comparação antes/depois mostra '—' para vazio e marca o que mudou", () => {
  const r = compararCampos({ marca_peca: null, peso: 1 }, { marca_peca: "Sabó", peso: 1 }, ["marca_peca", "peso"]);
  assert.deepEqual(r, [{ campo: "marca_peca", antes: "—", depois: "Sabó", mudou: true }, { campo: "peso", antes: "1", depois: "1", mudou: false }]);
  assert.equal(compararCampos(null, { a: { x: 1 } }, [])[0].depois, '{"x":1}');
});

test("propostas: prazo e expiração", () => {
  const agora = Date.parse("2026-10-19T12:00:00Z");
  assert.deepEqual(prazo("2026-10-19T11:00:00Z", agora), { expirada: true, texto: "expirada" });
  assert.equal(prazo("2026-10-19T14:30:00Z", agora).texto, "expira em 2 h 30 min");
  assert.equal(prazo(null).texto, "sem prazo");
});

test("propostas: só decide se pendente, não expirada, com hash e com item aprovável", () => {
  assert.equal(podeDecidir(P(), [I()]).ok, true);
  assert.equal(podeDecidir(P({ estado: "aprovada" }), [I()]).ok, false);
  assert.equal(podeDecidir(P({ expira_em: "2020-01-01T00:00:00Z" }), [I()]).ok, false);
  assert.equal(podeDecidir(P({ hash: null }), [I()]).ok, false);
  const r = podeDecidir(P(), [I({ estado: "travado" })]); assert.equal(r.ok, false); assert.match(r.motivo!, /travados/);
  assert.equal(itensAprovaveis([I(), I({ id: "i2", estado: "travado" })]).length, 1);
});

test("propostas: o corpo da decisão leva a versão e o hash exatos", () => {
  const c = corpoDecisao(P(), "aprovada", ["i1"], false);
  assert.deepEqual(c, { acao: "decidir", loja_id: "l1", proposta_id: "p1", versao: 3, hash: "h".repeat(64), decisao: "aprovada", itens: ["i1"] });
});

test("propostas: risco alto/crítico exige confirmação explícita", () => {
  assert.equal(exigeConfirmacao("HIGH"), true); assert.equal(exigeConfirmacao("LOW"), false);
  assert.throws(() => corpoDecisao(P({ risco: "CRITICAL" }), "aprovada", null, false), /confirmação explícita/);
  assert.equal(corpoDecisao(P({ risco: "HIGH" }), "aprovada", null, true).confirmacao_explicita, true);
  assert.equal(corpoDecisao(P({ risco: "HIGH" }), "rejeitada", null, false).confirmacao_explicita, undefined); // rejeitar não precisa
  assert.throws(() => corpoDecisao(P({ hash: null }), "aprovada", null, true), /hash/);
});

test("propostas: operações desconhecidas pedem reconciliação", () => {
  const o = (estado: "confirmada" | "desconhecida" | "falhou") => ({ id: estado, item_id: "i", tentativa: 1, ferramenta: "f", estado, erro: null, evidencia: null, iniciado_em: "", concluido_em: null });
  assert.equal(aReconciliar([o("confirmada"), o("desconhecida")]).length, 1);
  assert.deepEqual(resumoOperacoes([o("confirmada"), o("falhou"), o("falhou")]), { pendente: 0, enviada: 0, confirmada: 1, falhou: 2, desconhecida: 0 });
});
