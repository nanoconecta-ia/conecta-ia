// Reativação de produto EXCLUÍDO no Bling ("bling.produtos.preparar_reativacao") e as ferramentas de produto do chat.
// Código de produção contra Postgres local com todas as migrações e o Bling SIMULADO. Nada é enviado a um Bling real.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar } from "./despacho.ts";
import { executarProposta } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { CAMPOS_ESCRITA_LIBERADOS, montarCorpoProduto } from "./bling_campos.ts";
import { buscarDefinicao } from "./registro.ts";
import { executarFerramenta, FERRAMENTAS } from "../ia/ferramentas.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "cccccccc-0000-0000-0000-0000000000c3", U = "99999999-9999-9999-9999-999999999997";
const bling = new BlingMock();
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const fontes = [{ documento: "Pedido do lojista no chat", consultado_em: "2026-10-29T00:00:00Z" }];
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);
const itemDe = (pid: string) => JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${pid}'`));
const ativoNoRegistro = (id: string) => { const d = buscarDefinicao(id); return d && id.startsWith("bling.") && d.permissao === "executar" ? { ...d, estado: "ativa" as const } : d; };

test("campos: situação só pode ir para A; inativar continua proibido; preço/custo/estoque seguem fora", () => {
  assert.deepEqual(montarCorpoProduto({ situacao: "A" }).corpo, { situacao: "A" });
  assert.match(montarCorpoProduto({ situacao: "I" }).erros.join(), /só pode ir para "A"/);
  assert.match(montarCorpoProduto({ situacao: "E" }).erros.join(), /só pode ir para "A"/);
  for (const k of ["preco", "precoCusto", "estoque", "codigo", "ncm", "fornecedor"]) assert.match(montarCorpoProduto({ [k]: 1 }).erros.join(), /proibido/, k);
  assert.ok(CAMPOS_ESCRITA_LIBERADOS["bling.produtos.alterar"].includes("situacao"));
  assert.ok(!CAMPOS_ESCRITA_LIBERADOS["bling.produtos.alterar"].some((c) => /preco|custo|estoque|ncm|fornecedor|codigo/.test(c)));
});

test("preparação: loja e Bling simulado com o 854008 excluído (como no Bling real da Mobis)", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja reativação', 'loja-reativacao')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista')`);
  bling.semear("1177890085", { codigo: "854008", nome: "Bomba de Agua Hr / K2500 (2.5 8v 06/12) 854008", situacao: "E", marca: "INDISA", gtin: "" });
  bling.semear("9171776474", { codigo: "4949", nome: "854008 BOMBA D AGUA", situacao: "E", gtin: "7898479002204" });
  bling.semear("500", { codigo: "ATIVO-1", nome: "Já ativo", situacao: "A" });
  bling.semear("501", { codigo: "DUP-1", nome: "Excluído com gêmeo ativo", situacao: "E" });
  bling.semear("502", { codigo: "DUP-1", nome: "Gêmeo ativo", situacao: "A" });
  bling.semear("503", { codigo: "GT-1", nome: "Excluído com GTIN em uso", situacao: "E", gtin: "7891234567895" });
  bling.semear("504", { codigo: "GT-2", nome: "Ativo com o mesmo GTIN", situacao: "A", gtin: "7891234567895" });
});

let propostaId = "";
test("propõe reativar o excluído SEM produto no espelho: só a situação, antes lido no Bling; nada vai ao Bling", { skip }, async () => {
  bling.recebidos.length = 0;
  const r = await despachar("bling.produtos.preparar_reativacao", { bling_id: "1177890085", fontes }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  propostaId = (r.resultado as any).proposta_id;
  const it = itemDe(propostaId);
  assert.equal(it.operacao, "bling.produtos.alterar"); assert.equal(it.alvo, "1177890085");
  assert.deepEqual(it.campos, ["situacao"]); assert.deepEqual(it.antes, { situacao: "E" }); assert.deepEqual(it.depois, { situacao: "A" });
  assert.equal(it.produto_id, null, "o espelho só tem ativos: a proposta aponta para o id do Bling");
  assert.equal(bling.recebidos.length, 0);
});

test("não propõe: produto já ativo, gêmeo ativo pelo código, GTIN já usado por ativo, id inexistente", { skip }, async () => {
  assert.match(JSON.stringify((await despachar("bling.produtos.preparar_reativacao", { bling_id: "500", fontes }, ctx())).resultado), /já está ATIVO/);
  const dup = (await despachar("bling.produtos.preparar_reativacao", { bling_id: "501", fontes }, ctx())).resultado as any;
  assert.match(dup.aviso, /duplicaria/); assert.equal(dup.conflitos[0].id, "502"); assert.equal(dup.conflitos[0].por, "codigo");
  const gt = (await despachar("bling.produtos.preparar_reativacao", { bling_id: "503", fontes }, ctx())).resultado as any;
  assert.equal(gt.conflitos[0].id, "504"); assert.equal(gt.conflitos[0].por, "gtin");
  assert.match(JSON.stringify(await despachar("bling.produtos.preparar_reativacao", { bling_id: "999", fontes }, ctx())), /não encontrado/);
  assert.equal((await despachar("bling.produtos.preparar_reativacao", { bling_id: "abc", fontes }, ctx())).ok, false);
});

test("fim a fim no Bling SIMULADO: aprovada a versão exata, o executor reativa e CONFIRMA lendo de volta", { skip }, async () => {
  await db.rpc("agente_proposta_decidir", { p_loja: L, p_proposta: propostaId, p_versao: 1, p_hash: hashDe(propostaId), p_user: U, p_decisao: "aprovada" });
  await db.rpc("agente_escrita_liberar", { p_loja: L, p_ferramenta: "bling.produtos.alterar", p_user: U, p_referencia: "teste de reativação com Bling simulado" });
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId, definicao: ativoNoRegistro });
  assert.equal(r.itens[0]?.estado, "confirmada", JSON.stringify(r));
  assert.deepEqual(bling.recebidos.map((x) => x.corpo), [{ situacao: "A" }], "só a situação foi enviada");
  assert.equal(bling.produtos.get("1177890085")!.situacao, "A");
});

test("ferramentas do chat: reativar e atualizar produto passam pelo Policy Engine; atualizar sem fonte é recusado", { skip }, async () => {
  const chat = (nome: string, entrada: unknown) => executarFerramenta(nome, entrada, { usuario: null, admin: db as any, lojaId: L, plugins: [], credencial: async () => null, conector: ctx() });
  const r = await chat("bling_propor_reativar_produto", { bling_id: "9171776474" }) as any;
  assert.ok(r.proposta_id, JSON.stringify(r));
  assert.match(JSON.stringify(await chat("bling_propor_ajuste_produto", { sku: "854008", campos: { marca: "INDISA" } })), /fonte/);
  const nomes = FERRAMENTAS.map((f) => f.name);
  assert.ok(nomes.includes("bling_propor_reativar_produto") && nomes.includes("bling_propor_ajuste_produto"));
});
