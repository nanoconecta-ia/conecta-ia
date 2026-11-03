// Integração do chat do Nano com o Contexto Vivo SEM provedor de IA: o código de produção (atenderChat -> despachante -> handler) contra o Postgres local.
// Prova: dois SKUs lidos sem Gemini, troca de produto ativo, expirado, isolamento por loja e por pessoa, auditoria sem dado sigiloso, FreeLLM nunca elegível.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { atenderChat } from "../assistente/chat.ts";
import { perguntaPublica } from "../assistente/fallback_free.ts";
import { textoDoContexto } from "../contexto/ler.ts";
import { dadosSupabase as dadosDoGateway } from "../pair/gateway_dados.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);

const LA = "eeeeeeee-0000-0000-0000-00000000000a", LB = "eeeeeeee-0000-0000-0000-00000000000b";
const UA = "eeeeeeee-1111-1111-1111-111111111111", UB = "eeeeeeee-2222-2222-2222-222222222222";
const P1 = "eeeeeeee-c000-0000-0000-000000000001", P2 = "eeeeeeee-c000-0000-0000-000000000002";
const EV = (n: number) => `eeeeeeee-e000-0000-0000-00000000000${n}`;

function gravar(user: string, loja: string, ev: string, acao: string, ativo: string | null, sel: string[], base: number) {
  const arr = sel.length ? `array[${sel.map((x) => `'${x}'`).join(",")}]::uuid[]` : "'{}'::uuid[]";
  const r = db.sql(`set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true); select public.contexto_registrar('${loja}', '${ev}', '${acao}', 'conecta-ui', ${ativo ? `'${ativo}'::uuid` : "null"}, ${arr}, ${base})::text;`);
  return JSON.parse(r.trim().split("\n").pop()!);
}
/** O chat sem NENHUM provedor de IA: não há chave, fetch nem adaptador; qualquer tentativa de chamar LLM quebraria o teste. */
const perguntarAoChat = (loja: string, user: string) => atenderChat({ acao: "chat_contexto_vivo" }, {
  usuario: db as never, admin: db as never, loja: { id: loja, nome: "L" }, userId: user,
  get: () => undefined, fetch: (async () => { throw new Error("o chat sem IA não pode chamar a rede"); }) as never,
});

test("preparo", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${LA}', 'Chat A', 'chat-a'), ('${LB}', 'Chat B', 'chat-b') on conflict do nothing;
    insert into public.usuarios_loja (loja_id, user_id, papel) values ('${LA}', '${UA}', 'lojista'), ('${LA}', '${UB}', 'editor'), ('${LB}', '${UB}', 'lojista') on conflict do nothing;
    insert into public.produtos (id, loja_id, bling_id, sku, nome, marca, situacao, publicado) values
      ('${P1}', '${LA}', '8001', 'CHAT-OC1224', 'Filtro de óleo', 'Marca X', 'A', false), ('${P2}', '${LA}', '8002', 'CHAT-80692', 'Junta', 'Marca Y', 'A', false) on conflict do nothing;`);
});
test("sem seleção compartilhada: resposta clara, nenhum produto inventado", { skip }, async () => {
  const r = await perguntarAoChat(LA, UA); assert.equal(r.status, 200);
  assert.match(String((r.corpo as any).resposta), /Não há produto aberto nem selecionado/); assert.equal((r.corpo as any).ia, false);
  assert.equal(/CHAT-/.test(String((r.corpo as any).resposta)), false);
});
test("dois produtos selecionados no banco -> o Nano responde os dois SKUs sem Gemini", { skip }, async () => {
  assert.equal(gravar(UA, LA, EV(1), "produto.selecionado", null, [P1, P2], 0).ok, true);
  assert.equal(db.sql(`select count(*) from public.contexto_sessoes where loja_id = '${LA}' and principal = 'u:${UA}' and cardinality(produtos_selecionados) = 2`), "1", "a seleção está no banco");
  const r = await perguntarAoChat(LA, UA); const t = String((r.corpo as any).resposta);
  assert.match(t, /CHAT-OC1224 — Filtro de óleo \(Marca X\)/); assert.match(t, /CHAT-80692 — Junta \(Marca Y\)/); assert.match(t, /Selecionados \(2\)/); assert.match(t, /sem IA/);
});
test("troca de produto ativo é refletida", { skip }, async () => {
  assert.equal(gravar(UA, LA, EV(2), "produto.aberto", P2, [P2], 1).ok, true);
  const t = String(((await perguntarAoChat(LA, UA)).corpo as any).resposta); assert.match(t, /Produto ativo:\n• CHAT-80692/); assert.equal(/CHAT-OC1224/.test(t), false);
});
test("isolamento: outra pessoa da mesma loja e outra loja NÃO leem a seleção de UA", { skip }, async () => {
  assert.match(String(((await perguntarAoChat(LA, UB)).corpo as any).resposta), /Não há produto/, "a seleção é por pessoa");
  assert.match(String(((await perguntarAoChat(LB, UB)).corpo as any).resposta), /Não há produto/, "e por loja");
});
test("auditoria: cada leitura passa pelo despachante e é registrada sem dado sigiloso", { skip }, () => {
  const n = db.sql(`select count(*) from public.agente_chamadas_ferramenta where loja_id = '${LA}' and ferramenta = 'conecta.contexto.produto_ativo' and origem = 'chat' and decisao = 'permitida'`);
  assert.ok(Number(n) >= 3, `esperava ao menos 3 registros, havia ${n}`);
  const sigiloso = db.sql(`select count(*) from public.agente_chamadas_ferramenta where loja_id = '${LA}' and ferramenta = 'conecta.contexto.produto_ativo' and (saida::text ~* '(custo|fornecedor|ncm|cest|cfop|cpf|cnpj|token|senha)')`);
  assert.equal(sigiloso, "0");
});
test("PONTE BLING: a extensão informa o SKU aberto na tela do ERP e o chat do Nano responde sem digitar SKU, sem Gemini", { skip }, async () => {
  const dados = dadosDoGateway(db as never);
  // como o gateway faz: loja e pessoa vêm da SESSÃO de pareamento (aprovada por UA); o SKU vem da tela
  const r = await dados.registrarContexto(LA, UA, "CHAT-OC1224", "aberto") as { ok?: boolean; versao?: number };
  assert.equal(r.ok, true);
  assert.equal(db.sql(`select origem from public.contexto_sessoes where loja_id = '${LA}' and principal = 'u:${UA}'`), "bling-ui");
  const t = String(((await perguntarAoChat(LA, UA)).corpo as any).resposta);
  assert.match(t, /Produto ativo:\n• CHAT-OC1224 — Filtro de óleo \(Marca X\)/); assert.match(t, /origem bling-ui/);
  assert.match(String(((await perguntarAoChat(LA, UB)).corpo as any).resposta), /Não há produto/, "outra pessoa não vê");
  assert.match(String(((await perguntarAoChat(LB, UB)).corpo as any).resposta), /Não há produto/, "outra loja não vê");
  // SKU de outra loja / inexistente nunca grava
  assert.deepEqual(await dados.registrarContexto(LB, UB, "CHAT-OC1224", "aberto"), { erro: "Produto não encontrado nesta loja." });
  // trocar de produto na tela do Bling e fechar o anterior não apaga o atual
  await dados.registrarContexto(LA, UA, "CHAT-80692", "aberto"); await dados.registrarContexto(LA, UA, "CHAT-OC1224", "fechado");
  assert.match(String(((await perguntarAoChat(LA, UA)).corpo as any).resposta), /Produto ativo:\n• CHAT-80692/);
  await dados.registrarContexto(LA, UA, "CHAT-80692", "fechado");
  assert.match(String(((await perguntarAoChat(LA, UA)).corpo as any).resposta), /nenhum produto está selecionado|Não há produto/);
});
test("contexto expirado: indisponível", { skip }, async () => {
  db.sql(`update public.contexto_sessoes set expira_em = now() - interval '1 minute' where loja_id = '${LA}'`);
  assert.match(String(((await perguntarAoChat(LA, UA)).corpo as any).resposta), /Não há produto/);
});
test("FreeLLM/OpenRouter nunca é elegível para perguntas de contexto ou de loja", { skip }, () => {
  for (const t of ["Quais produtos estão selecionados", "qual é o produto ativo", "quais produtos estão selecionados no catálogo"]) assert.equal(perguntaPublica(t), false, t);
  assert.equal(perguntaPublica("o que é turbocompressor"), true, "glossário público segue permitido");
});
test("texto direto não vaza campos além de SKU, nome e marca", { skip }, () => {
  const t = textoDoContexto({ disponivel: true, versao: 1, origem: "conecta-ui", atualizado_em: "x", produto_ativo: { id: "i", sku: "A", nome: "N", marca: null, custo: 9 } as never, selecionados: [], aviso: "" });
  assert.equal(/custo|9/.test(t.replace(/versão 1/, "")), false);
});
test("limpeza", { skip }, () => { db.sql(`delete from public.contexto_sessoes where loja_id in ('${LA}','${LB}')`); });
