import { test } from "node:test";
import assert from "node:assert/strict";
import { IaErro } from "../ia/claude.ts";
import { avisoTroca, FERRAMENTAS_FREE, podeTrocarParaFree, PROVEDOR_FREE, URL_FREE } from "./free_automatico.ts";
import { listarProvedores, modeloDaChave, nomeProvedor, validarProvedor } from "./provedores.ts";

const base = { provedor: "gemini", erro: new IaErro(429, "x"), iniciouChamadaProvedor: true, automatico: true, anexos: 0, textoTransmitido: false, propostasCriadas: 0 };

test("troca automática: só quando é seguro refazer o turno", () => {
  assert.equal(podeTrocarParaFree(base), true);
  for (const s of [429, 502, 504]) assert.equal(podeTrocarParaFree({ ...base, erro: new IaErro(s, "x") }), true, String(s));
  // configuração (chave recusada, não configurado, limite interno) NÃO dispara a troca
  for (const s of [401, 503, 400, 409]) assert.equal(podeTrocarParaFree({ ...base, erro: new IaErro(s, "x") }), false, String(s));
  assert.equal(podeTrocarParaFree({ ...base, erro: new Error("x") }), false);
  assert.equal(podeTrocarParaFree({ ...base, automatico: false }), false, "modo manual/desligado nunca troca sozinho");
  assert.equal(podeTrocarParaFree({ ...base, provedor: PROVEDOR_FREE }), false, "o gratuito não troca para si mesmo");
  assert.equal(podeTrocarParaFree({ ...base, iniciouChamadaProvedor: false }), false, "falha antes de chamar o provedor não é do provedor");
  assert.equal(podeTrocarParaFree({ ...base, anexos: 1 }), false, "anexo nunca vai ao gratuito");
  assert.equal(podeTrocarParaFree({ ...base, textoTransmitido: true }), false, "texto já mostrado ao lojista");
  assert.equal(podeTrocarParaFree({ ...base, propostasCriadas: 1 }), false, "proposta já criada: não refaz o turno");
});
test("o gratuito só tem a leitura de produto: nenhuma proposta, gravação ou pesquisa externa", () => {
  assert.deepEqual([...FERRAMENTAS_FREE], ["bling_consultar_produto", "resumo_loja", "listar_produtos", "ver_produto"]);
  for (const t of FERRAMENTAS_FREE) assert.doesNotMatch(t, /propor|criar|gravar|buscar|alterar|reativar/);
  assert.equal(URL_FREE, "https://openrouter.ai/api/v1");
});
test("aviso de troca diz quem falhou e quem respondeu", () => {
  assert.match(avisoTroca("gemini", 429), /gemini .*sobrecarregado ou no limite.*modelo gratuito/);
  assert.match(avisoTroca("claude", 504), /sem resposta a tempo/);
});
test("lista de provedores: o gratuito aparece junto dos outros com o modo", () => {
  assert.equal(validarProvedor("openrouter_free"), "openrouter_free");
  assert.throws(() => validarProvedor("openrouter"));
  assert.equal(nomeProvedor("openrouter_free"), "Gratuito (OpenRouter)");
  assert.equal(modeloDaChave({ provedor: "openrouter_free", modelo: null }), "openrouter/free");
  const k = (o: Record<string, unknown>) => ({ provedor: "openrouter_free", ativa: true, principal: false, modelo: "openrouter/free", base_url: null, limite_mensal_tokens: null, tokens_mes: 0, mes_ref: "2026-11-01", ...o });
  const free = (cs: ReturnType<typeof k>[]) => listarProvedores(cs as never).find((p) => p.id === "openrouter_free") as { estado: string; modo: string };
  assert.equal(free([]).modo, "desligado"); assert.equal(free([]).estado, "nao_configurado");
  assert.deepEqual([free([k({})]).estado, free([k({})]).modo], ["disponivel", "manual"]);
  assert.deepEqual([free([k({ failover: true })]).estado, free([k({ failover: true })]).modo], ["disponivel", "automatico"]);
  assert.deepEqual([free([k({ ativa: false })]).estado, free([k({ ativa: false })]).modo], ["nao_configurado", "desligado"]);
});
