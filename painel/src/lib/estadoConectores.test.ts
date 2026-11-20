import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoSessaoConector, permissoesConector, resumoConectores, type SessaoConector } from "./estadoConectores.ts";

const agora = Date.parse("2026-11-19T22:00:00Z");
function sessao(id: string, escopos: string[], ultimo_uso_em: string | null): SessaoConector {
  return { id, escopos, expira_em: "2026-11-19T22:05:00Z", limite_ate: "2026-11-20T06:00:00Z", ultimo_uso_em, chat_escuta_em: null, revogado_em: null };
}

test("sessão autorizada sem atividade não é apresentada como online", () => {
  assert.equal(estadoSessaoConector(sessao("1", ["mcp:leitura"], null), agora), "autorizada_sem_atividade");
  assert.equal(estadoSessaoConector(sessao("1", ["mcp:leitura"], "2026-11-19T21:59:45Z"), agora), "atividade_recente");
  assert.equal(estadoSessaoConector(sessao("1", ["mcp:leitura"], "2026-11-19T21:55:00Z"), agora), "autorizada_sem_atividade");
});

test("escopos de consulta e conversa não se misturam nem liberam Bling", () => {
  const mcp = permissoesConector(["mcp:leitura", "mcp:propor"]);
  assert.deepEqual(mcp, { consultar: true, propor: true, responderNano: false, aprovar: false, executarBling: false });
  const chat = permissoesConector(["chat:responder"]);
  assert.deepEqual(chat, { consultar: false, propor: false, responderNano: true, aprovar: false, executarBling: false });
});

test("múltiplos agentes independentes e tokens expirados", () => {
  const a = sessao("ChatGPT", ["mcp:leitura", "mcp:propor"], "2026-11-19T21:59:45Z");
  const b = sessao("Claude", ["chat:responder"], null);
  const expirado = { ...sessao("Antigo", ["mcp:leitura"], null), expira_em: "2026-11-19T21:00:00Z" };
  assert.equal(estadoSessaoConector(expirado, agora), "token_expirado");
  assert.deepEqual(resumoConectores([a, b, expirado], agora), { autorizadas: 2, emAtividade: 1, podemPropor: 1, podemResponder: 1 });
});

test("janela revogada ou expirada impede o estado ativo", () => {
  const s = sessao("a", ["chat:responder"], "2026-11-19T21:59:50Z");
  assert.equal(estadoSessaoConector({ ...s, revogado_em: "2026-11-19T21:59:59Z" }, agora), "revogada");
  assert.equal(estadoSessaoConector({ ...s, limite_ate: "2026-11-19T21:00:00Z" }, agora), "janela_expirada");
});
