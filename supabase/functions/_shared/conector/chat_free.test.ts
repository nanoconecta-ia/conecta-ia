// Integração do chat com o provedor GRATUITO (OpenRouter) como provedor de verdade: manual e AUTOMÁTICO (assume quando o Gemini falha), contra o Postgres local.
// O provedor é simulado por fetch (o banco NÃO). Prova: troca só em falha de provedor, nada vai ao gratuito além de leitura, anexo/proposta/erro de configuração não trocam,
// quem respondeu fica registrado, o consumo vai para o gratuito, e o modo manual/desligado nunca troca sozinho.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { atenderChat } from "../assistente/chat.ts";
import { cifrar } from "../cripto.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);

const L = "ffffffff-0000-0000-0000-00000000000a", U = "ffffffff-1111-1111-1111-111111111111";
const CHAVE = Buffer.alloc(32, 7).toString("base64");
const get = (n: string) => (n === "CREDENCIAIS_CHAVE_CIFRA" ? CHAVE : n === "CHAT_AMBIENTE" ? "sintetico" : undefined);
interface Corpo { url: string; corpo: Record<string, unknown> }
let chamadas: Corpo[] = [];
let modoGemini: "429" | "ok" | "401" = "429";
const resp = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "content-type": "application/json" } });
const fetchFalso = (async (url: string, init: { body?: string; method?: string }) => {
  // Consulta de cota: GET somente leitura, sem inferência e sem consumir uma chamada gratuita.
  // O teste conta APENAS inferências em `chamadas` para não confundir medidor com chat.
  if (String(url) === "https://openrouter.ai/api/v1/key") {
    assert.equal(init?.method, "GET");
    return resp(200, { data: { free_model_daily_requests: { limit: 50, used: 5, remaining: 45 } } });
  }
  const corpo = init?.body ? JSON.parse(init.body) : {};
  chamadas.push({ url: String(url), corpo });
  if (String(url).includes("generativelanguage.googleapis.com")) {
    if (modoGemini === "429") return resp(429, {});
    if (modoGemini === "401") return resp(401, {});
    return resp(200, { responseId: "g1", modelVersion: "gemini-x", candidates: [{ content: { parts: [{ text: "Resposta do Gemini." }] }, finishReason: "STOP" }], usageMetadata: { totalTokenCount: 10 } });
  }
  if (String(url).startsWith("https://openrouter.ai/api/v1")) return resp(200, { id: "or1", model: "openrouter/free-modelo", choices: [{ finish_reason: "stop", message: { content: "Resposta do modelo gratuito." } }], usage: { total_tokens: 42 } });
  throw new Error("rede inesperada: " + url);
}) as unknown as typeof fetch;

let n = 0;
const perguntar = (extra: Record<string, unknown> = {}) => atenderChat({ acao: "chat_perguntar", texto: `qual o filtro do OC1224 ${++n}?`, provedor: "gemini", consentimento_ia: true, idempotency_key: `idem-free-${Date.now()}-${n}`, ...extra },
  { usuario: db as never, admin: db as never, loja: { id: L, nome: "Loja F" }, userId: U, get, fetch: fetchFalso });
const corpo = async (r: Promise<{ corpo: unknown; status: number }>) => { const x = await r; return { status: x.status, c: x.corpo as Record<string, any> }; };
const modo = (m: string) => db.sql(`select public.ia_definir_modo_free('${L}', '${m}')`);

test("preparo: loja, pessoa, recursos do chat e as chaves (Gemini principal + gratuito)", { skip }, async () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja F', 'loja-f') on conflict do nothing;
    insert into public.usuarios_loja (loja_id, user_id, papel) values ('${L}', '${U}', 'lojista') on conflict do nothing;
    insert into public.loja_recursos (loja_id, recurso, ativo) values ('${L}', 'chat_persistente', true), ('${L}', 'chat_consulta_bling', true) on conflict (loja_id, recurso) do update set ativo = true;`);
  const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
  const gem = await cifrar("AIzaFAKEFAKEFAKEFAKE", CHAVE), fre = await cifrar("sk-or-v1-FAKEFAKEFAKEFAKEFAKE", CHAVE);
  db.sql(`select public.ia_salvar_chave('${L}', 'gemini', ${q(gem)}, 'KEFA', 'gemini-2.5-flash', null, null); select public.ia_salvar_chave('${L}', 'openrouter_free', ${q(fre)}, 'FAKE', 'openrouter/free', null, null);`);
  assert.equal(db.sql(`select principal from public.loja_chaves_ia where loja_id = '${L}' and provedor = 'gemini'`), "t");
});
test("Gemini no limite + modo AUTOMÁTICO: o gratuito responde, só leitura, e fica registrado quem respondeu", { skip }, async () => {
  modo("automatico"); modoGemini = "429"; chamadas = [];
  const { status, c } = await corpo(perguntar());
  assert.equal(status, 200); assert.match(c.resposta, /^⚠ O provedor gemini estava sobrecarregado ou no limite; respondi com o modelo gratuito/); assert.match(c.resposta, /Resposta do modelo gratuito\./);
  assert.equal(c.desfecho, "contingencia_automatica"); assert.equal(c.provedor_efetivo, "openrouter-free"); assert.equal(c.troca_de, "gemini"); assert.equal(c.provedor, "openrouter_free");
  const doGratuito = chamadas.filter((x) => x.url.startsWith("https://openrouter.ai"));
  assert.equal(doGratuito.length, 1, "uma chamada ao gratuito");
  const ferramentas = ((doGratuito[0].corpo.tools ?? []) as { function: { name: string } }[]).map((t) => t.function.name);
  assert.deepEqual(ferramentas, ["bling_consultar_produto", "diagnostico_ia", "resumo_loja", "listar_produtos", "ver_produto"], "o gratuito só recebe leitura (produto e catálogo espelhado): nenhuma proposta, gravação ou pesquisa");
  assert.ok(!ferramentas.some((n) => /propor|criar|gravar|alterar|buscar/.test(n)), "nenhuma ferramenta de escrita, proposta ou pesquisa externa");
  assert.match(JSON.stringify(doGratuito[0].corpo.messages), /MODO GRATUITO/);
  assert.equal(db.sql(`select count(*) from public.mensagens where loja_id = '${L}' and metadados->>'desfecho' = 'contingencia_automatica' and metadados->>'provedor_efetivo' = 'openrouter-free'`) >= "1", true, "registrado no histórico");
  assert.equal(Number(db.sql(`select tokens_mes from public.loja_chaves_ia where loja_id = '${L}' and provedor = 'openrouter_free'`)) >= 42, true, "o consumo vai para o gratuito");
});
test("modo MANUAL ou DESLIGADO: nunca troca sozinho (o erro do Gemini aparece)", { skip }, async () => {
  for (const m of ["manual", "desligado"]) {
    modo(m); modoGemini = "429"; chamadas = [];
    const { status, c } = await corpo(perguntar());
    assert.equal(status, 429, m); assert.match(c.resposta, /sobrecarregado|limite/); assert.equal(chamadas.some((x) => x.url.includes("openrouter")), false, `${m}: nada vai ao OpenRouter`);
  }
});
test("erro de CONFIGURAÇÃO (chave do Gemini recusada, 401) não aciona o automático", { skip }, async () => {
  modo("automatico"); modoGemini = "401"; chamadas = [];
  const { status } = await corpo(perguntar()); assert.equal(status, 401); assert.equal(chamadas.some((x) => x.url.includes("openrouter")), false);
});
test("anexo nunca vai ao gratuito: sem troca; e escolher o gratuito com anexo é recusado", { skip }, async () => {
  modo("automatico"); modoGemini = "429"; chamadas = [];
  const anexo = [{ nome: "a.txt", tipo: "text/plain", dados: Buffer.from("conteúdo do lojista").toString("base64") }];
  const r1 = await corpo(perguntar({ anexos: anexo })); assert.notEqual(r1.status, 200); assert.equal(chamadas.some((x) => x.url.includes("openrouter")), false, "o anexo não foi ao OpenRouter");
  const r2 = await corpo(perguntar({ provedor: "openrouter_free", anexos: anexo })); assert.equal(r2.status, 400); assert.match(r2.c.erro, /não recebe anexos/);
});
test("escolha MANUAL do gratuito na lista de modelos: responde direto, sem aviso de troca", { skip }, async () => {
  modo("manual"); chamadas = [];
  const { status, c } = await corpo(perguntar({ provedor: "openrouter_free" }));
  assert.equal(status, 200); assert.equal(c.desfecho, "ok"); assert.equal(c.provedor, "openrouter_free"); assert.equal(c.provedor_efetivo, "openrouter-free");
  assert.doesNotMatch(c.resposta, /respondi com o modelo gratuito/); assert.equal(c.resposta, "Resposta do modelo gratuito.");
  assert.equal(chamadas.some((x) => x.url.includes("generativelanguage")), false);
});
test("gratuito DESLIGADO não responde nem manualmente", { skip }, async () => {
  modo("desligado"); const { status } = await corpo(perguntar({ provedor: "openrouter_free" })); assert.equal(status, 503);
});
test("quando o Gemini responde, o gratuito não é chamado", { skip }, async () => {
  modo("automatico"); modoGemini = "ok"; chamadas = [];
  const { status, c } = await corpo(perguntar()); assert.equal(status, 200); assert.equal(c.resposta, "Resposta do Gemini."); assert.equal(chamadas.some((x) => x.url.includes("openrouter")), false);
});
test("limpeza", { skip }, () => { db.sql(`delete from public.mensagens where loja_id = '${L}'; delete from public.conversas where loja_id = '${L}'`); });
