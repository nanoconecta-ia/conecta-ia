import { test } from "node:test";
import assert from "node:assert/strict";
import { criarStoreNano, reduzirNano } from "./nanoEstado.ts";

test("nano: estado é por loja; trocar de loja não herda o da anterior", () => {
  const s = criarStoreNano();
  s.publicar("A", { tipo: "servidor", estado: "consultando_ferramentas" });
  assert.equal(s.ler("A"), "consultando_ferramentas");
  assert.equal(s.ler("B"), "ocioso");
  s.publicar("B", { tipo: "microfone", ouvindo: true });
  assert.equal(s.ler("A"), "consultando_ferramentas");
  assert.equal(s.ler("B"), "escutando");
});

test("nano: fim do SSE volta a ocioso, mas mantém aguardando_aprovacao/erro/concluído", () => {
  const s = criarStoreNano();
  s.publicar("A", { tipo: "servidor", estado: "interpretando" }); s.publicar("A", { tipo: "fim" });
  assert.equal(s.ler("A"), "ocioso");
  s.publicar("A", { tipo: "servidor", estado: "aguardando_aprovacao" }); s.publicar("A", { tipo: "fim" });
  assert.equal(s.ler("A"), "aguardando_aprovacao");
});

test("nano: rede caiu vira erro; cancelar vira ocioso", () => {
  const s = criarStoreNano();
  s.publicar("A", { tipo: "servidor", estado: "executando" });
  s.publicar("A", { tipo: "falha_rede" }); assert.equal(s.ler("A"), "erro");
  s.publicar("A", { tipo: "servidor", estado: "interpretando" }); s.publicar("A", { tipo: "cancelado" });
  assert.equal(s.ler("A"), "ocioso");
});

test("nano: aprovação pendente é fato do servidor; ao decidir, sai do estado", () => {
  assert.equal(reduzirNano("ocioso", { tipo: "aprovacao", pendente: true }), "aguardando_aprovacao");
  assert.equal(reduzirNano("aguardando_aprovacao", { tipo: "aprovacao", pendente: false }), "ocioso");
  assert.equal(reduzirNano("executando", { tipo: "aprovacao", pendente: false }), "executando");
});

test("nano: voz só aparece quando nada mais importante está em curso; valor desconhecido do servidor é ignorado", () => {
  assert.equal(reduzirNano("ocioso", { tipo: "fala", falando: true }), "falando");
  assert.equal(reduzirNano("sincronizando_bling", { tipo: "fala", falando: true }), "sincronizando_bling");
  assert.equal(reduzirNano("falando", { tipo: "fala", falando: false }), "ocioso");
  assert.equal(reduzirNano("ocioso", { tipo: "servidor", estado: "inventado" }), "ocioso");
});

test("nano: sincronizando_bling só entra por evento real do servidor, nunca por navegação", () => {
  const s = criarStoreNano();
  s.publicar("A", { tipo: "local", estado: "executando" });
  assert.equal(s.ler("A"), "executando");
  assert.notEqual(s.ler("A"), "sincronizando_bling");
});

test("nano: assinantes são avisados só quando o estado muda", () => {
  const s = criarStoreNano(); let n = 0; const sai = s.assinar(() => n++);
  s.publicar("A", { tipo: "servidor", estado: "erro" }); s.publicar("A", { tipo: "servidor", estado: "erro" });
  assert.equal(n, 1); sai(); s.publicar("A", { tipo: "repouso" }); assert.equal(n, 1);
});
