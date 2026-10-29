// Ação "bling.categorias.preparar_criacao" e as ferramentas bling_* do chat do painel: só PROPOSTA, nunca escrita.
// Roda o código de produção contra um Postgres local com todas as migrações e o Bling SIMULADO. Nada é enviado ao Bling.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar } from "./despacho.ts";
import { BlingMock } from "./bling_mock.ts";
import { executarFerramenta, FERRAMENTAS, SISTEMA } from "../ia/ferramentas.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "cccccccc-0000-0000-0000-0000000000c2", U = "99999999-9999-9999-9999-999999999998";
const bling = new BlingMock();
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const fontes = [{ documento: "Pedido do lojista no chat", consultado_em: "2026-10-29T00:00:00Z" }];
const chat = (nome: string, entrada: unknown, conector: any = ctx()) => executarFerramenta(nome, entrada, { usuario: null, admin: db as any, lojaId: L, plugins: [], credencial: async () => null, conector });

test("preparação: loja e categorias já existentes no Bling", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja criação de categoria', 'loja-cat-criacao')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista')`);
  bling.categorias.push({ id: 500, descricao: "Motor" }, { id: 501, descricao: "Injeção", idCategoriaPai: 500 });
});

test("cria a proposta de criação com 'antes' vazio e confere duplicidade; nada vai ao Bling", { skip }, async () => {
  bling.recebidos.length = 0;
  const r = await despachar("bling.categorias.preparar_criacao", { nome: "  Arrefecimento ", fontes }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  const res = r.resultado as any;
  assert.ok(res.proposta_id); assert.equal(res.itens, 1); assert.equal(res.risco, "MEDIUM");
  const it = JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${res.proposta_id}'`));
  assert.equal(it.operacao, "bling.categorias.criar");
  assert.deepEqual(it.depois, { descricao: "Arrefecimento" });
  assert.deepEqual(it.antes, { descricao: null }, "a categoria ainda não existia");
  assert.equal(bling.recebidos.length, 0, "nenhuma escrita chegou ao Bling");
});

test("categoria que já existe (sem acento, maiúsculas) não vira proposta; pai inexistente é recusado", { skip }, async () => {
  const dup = await despachar("bling.categorias.preparar_criacao", { nome: "motor", fontes }, ctx());
  assert.match(JSON.stringify(dup.resultado), /já existe/);
  assert.equal((dup.resultado as any).proposta_id, undefined);
  const semPai = await despachar("bling.categorias.preparar_criacao", { nome: "Novo", pai_id: "999", fontes }, ctx());
  assert.match(JSON.stringify(semPai.resultado), /não existe no Bling/);
  const filha = await despachar("bling.categorias.preparar_criacao", { nome: "Injeção", pai_id: "501", fontes }, ctx());
  assert.equal(filha.ok, true, "mesmo nome sob outro pai é permitido");
  const it = JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${(filha.resultado as any).proposta_id}'`));
  assert.deepEqual(it.depois, { descricao: "Injeção", categoria_pai_id: "501" });
});

test("sem leitura do Bling não há proposta; sem fonte ou nome vazio é recusado", { skip }, async () => {
  assert.match(JSON.stringify(await despachar("bling.categorias.preparar_criacao", { nome: "X", fontes }, { ...ctx(), bling: undefined })), /Leitura do Bling indisponível/);
  assert.equal((await despachar("bling.categorias.preparar_criacao", { nome: "X" }, ctx())).ok, false);
  assert.equal((await despachar("bling.categorias.preparar_criacao", { fontes }, ctx())).ok, false);
});

test("ferramentas do chat do painel: propõem pelo Policy Engine e a fonte é o pedido do lojista", { skip }, async () => {
  const lista = await chat("bling_categorias", { busca: "inje" }) as any[];
  assert.deepEqual(lista.map((c) => c.descricao), ["Injeção"]);
  const r = await chat("bling_propor_categoria", { nome: "Freios" }) as any;
  assert.ok(r.proposta_id, JSON.stringify(r)); assert.match(r.aviso, /Nada foi alterado/);
  const it = JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${r.proposta_id}'`));
  assert.match(JSON.stringify(it.fontes), /Pedido do lojista no chat/);
});

test("sem o motor de propostas as ferramentas bling_* respondem indisponível; nada é gravado", { skip }, async () => {
  assert.match(JSON.stringify(await chat("bling_propor_categoria", { nome: "Y" }, null)), /não está disponível/);
});

test("catálogo do chat: tem as ferramentas bling_*, nenhuma de escrita direta, e o prompt não promete o que não existe", () => {
  const nomes = FERRAMENTAS.map((f) => f.name);
  for (const n of ["bling_categorias", "bling_propor_categoria", "bling_propor_trocar_categoria"]) assert.ok(nomes.includes(n), n);
  assert.ok(!nomes.some((n) => /criar|gravar|escrever|executar/.test(n) && n.startsWith("bling_")), "nenhuma ferramenta do chat executa no Bling");
  assert.match(SISTEMA, /nunca diga que já gravou/);
  assert.match(SISTEMA, /NÃO existe ferramenta para criar produto novo/);
});
