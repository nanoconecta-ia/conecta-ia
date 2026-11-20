import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidarAgentes, estadoSessaoConector, permissoesConector, resumoConectores, type SessaoConector } from "./estadoConectores.ts";

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

test("ChatGPT no MCP aparece apenas uma vez apesar de cinco tokens históricos", () => {
  const velhas = Array.from({ length: 5 }, (_, i) => ({
    id: "chatgpt-antigo-" + i, nome: "ChatGPT", tipo: "agente_externo",
    revogado_em: null, pair_sessoes: [{
      ...sessao("expirado-" + i, ["mcp:leitura", "mcp:propor"], null),
      criado_em: "2026-11-18T20:00:00Z",
      expira_em: "2026-11-19T21:00:00Z",
    }],
  }));
  const atual = {
    id: "chatgpt-atual", nome: "ChatGPT", tipo: "agente_externo",
    revogado_em: null, pair_sessoes: [{
      ...sessao("token-atual", ["mcp:leitura", "mcp:propor"], "2026-11-19T21:59:45Z"),
      criado_em: "2026-11-19T21:55:00Z",
    }],
  };
  const grupos = consolidarAgentes([...velhas, atual], agora);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].dispositivo.id, "chatgpt-atual");
  assert.equal(grupos[0].sessao.id, "token-atual");
  assert.equal(grupos[0].historicas, 5);
  assert.equal(estadoSessaoConector(grupos[0].sessao, agora), "atividade_recente");
});

test("Claude e canais MCP/chat distintos nunca herdam escopos de outra sessão", () => {
  const dispositivo = (id: string, nome: string, escopos: string[]) => ({
    id, nome, tipo: "agente_externo", revogado_em: null,
    pair_sessoes: [sessao(id, escopos, null)],
  });
  const r = consolidarAgentes([
    dispositivo("chatgpt-mcp", "ChatGPT", ["mcp:leitura", "mcp:propor"]),
    dispositivo("chatgpt-chat", "ChatGPT", ["chat:responder"]),
    dispositivo("claude-mcp", "Claude", ["mcp:leitura"]),
  ], agora);
  assert.equal(r.length, 3);
  const canal = r.find(x => x.dispositivo.id === "chatgpt-mcp")!;
  assert.equal(permissoesConector(canal.sessao.escopos).responderNano, false);
  assert.equal(r.filter(x => x.dispositivo.nome === "Claude").length, 1);
});
