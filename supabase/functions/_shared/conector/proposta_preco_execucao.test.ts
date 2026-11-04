// Proposta de PREÇO de venda, fim a fim contra Postgres local com todas as migrações e o Bling SIMULADO. Prova que a proposta é aceita pelo banco
// (antes preenchido, fonte, operação) e que, mesmo aprovada e com a escrita liberada no banco, o executor NÃO muda o preço. Nada vai a um Bling real.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar } from "./despacho.ts";
import { executarProposta } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { CAMPOS_ESCRITA_LIBERADOS } from "./bling_campos.ts";
import { buscarDefinicao } from "./registro.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "cccccccc-0000-0000-0000-0000000000d1", U = "99999999-9999-9999-9999-999999999971";
const bling = new BlingMock();
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);
const itemDe = (pid: string) => JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${pid}'`));
const ativoNoRegistro = (id: string) => { const d = buscarDefinicao(id); return d && id.startsWith("bling.") && d.permissao === "executar" ? { ...d, estado: "ativa" as const } : d; };
const entrada = { sku: "OC1224", preco_novo: 55, motivo: "Ajuste da tabela de venda do mês" };

test("preparação: loja, produto no espelho (R$ 48,00) e o mesmo produto no Bling simulado", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja preço', 'loja-preco')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista')`);
  db.sql(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, estoque, situacao, publicado) values ('${L}', '701', 'OC1224', 'FILTRO BLINDADO', 48, 0, 'A', false)`);
  bling.semear("701", { codigo: "OC1224", nome: "FILTRO BLINDADO", preco: 48, situacao: "A" });
});

let propostaId = "";
test("propõe o preço: o banco aceita; antes/depois, alvo e operação gravados; nada vai ao Bling", { skip }, async () => {
  bling.recebidos.length = 0;
  const r = await despachar("bling.produtos.preparar_alteracao_preco", entrada, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  propostaId = (r.resultado as any).proposta_id; assert.ok(propostaId, JSON.stringify(r));
  const it = itemDe(propostaId);
  assert.equal(it.operacao, "bling.produtos.alterar_preco"); assert.equal(it.alvo, "701");
  assert.deepEqual(it.campos, ["preco_venda"]); assert.deepEqual(it.antes, { preco_venda: 48 }); assert.deepEqual(it.depois, { preco_venda: 55 });
  assert.equal(it.risco, "MEDIUM"); assert.equal(bling.recebidos.length, 0);
});

test("preço divergente no Bling: nada é proposto", { skip }, async () => {
  const b2 = new BlingMock().semear("701", { codigo: "OC1224", nome: "FILTRO BLINDADO", preco: 52.9, situacao: "A" });
  const antes = db.sql(`select count(*) from public.agente_propostas where loja_id = '${L}'`);
  const r = await despachar("bling.produtos.preparar_alteracao_preco", { ...entrada, preco_novo: 60 }, { ...ctx(), bling: b2 });
  assert.match(JSON.stringify(r.resultado), /desatualizado/);
  assert.equal(db.sql(`select count(*) from public.agente_propostas where loja_id = '${L}'`), antes);
});

test("aprovada a versão exata, MAS sem a escrita liberada no banco, nada é executado", { skip }, async () => {
  await db.rpc("agente_proposta_decidir", { p_loja: L, p_proposta: propostaId, p_versao: 1, p_hash: hashDe(propostaId), p_user: U, p_decisao: "aprovada" });
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId, definicao: ativoNoRegistro, camposLiberados: { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.alterar_preco": ["preco_venda"] } });
  assert.ok(r.erro || r.itens.every((i) => i.estado !== "confirmada"), JSON.stringify(r));
  assert.equal(bling.recebidos.length, 0); assert.equal(bling.produtos.get("701")!.preco, 48);
});

test("mesmo liberada no banco e com o registro forçado a 'ativa', o executor recusa o preço: o Bling continua em R$ 48,00", { skip }, async () => {
  await db.rpc("agente_escrita_liberar", { p_loja: L, p_ferramenta: "bling.produtos.alterar_preco", p_user: U, p_referencia: "teste com Bling simulado" });
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId, definicao: ativoNoRegistro, camposLiberados: { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.alterar_preco": ["preco_venda"] } });
  assert.ok(r.itens.every((i) => i.estado !== "confirmada"), JSON.stringify(r));
  assert.match(JSON.stringify(r), /operacao_nao_suportada|policy|nao_liberada/);
  assert.equal(bling.recebidos.length, 0); assert.equal(bling.produtos.get("701")!.preco, 48);
});
