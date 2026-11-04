// Cadastro de produto NOVO, fim a fim: chat propõe -> pessoa aprova a versão exata -> escrita liberada no banco -> executor cria NO BLING SIMULADO
// e confirma lendo de volta. Código de produção contra Postgres local com todas as migrações. NADA é enviado a um Bling real.
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
const L = "cccccccc-0000-0000-0000-0000000000c9", U = "99999999-9999-9999-9999-999999999989";
const bling = new BlingMock();
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const fontes = [{ url: "https://www.sabo.com.br/catalogo/bomba-oleo", consultado_em: "2026-11-04T00:00:00Z" }];
const rascunho = (codigo: string) => ({ codigo, nome: `Bomba de óleo HR 2.5 16V ${codigo}`, marca: "Sabó", preco_venda: 899.9 });
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);
const estadoDoItem = (pid: string) => db.sql(`select estado from public.agente_proposta_itens where proposta_id = '${pid}' limit 1`);
const ativoNoRegistro = (id: string) => { const d = buscarDefinicao(id); return d && id.startsWith("bling.") && d.permissao === "executar" ? { ...d, estado: "ativa" as const } : d; };
const LIBERADOS = { ...CAMPOS_ESCRITA_LIBERADOS, "bling.produtos.criar": ["codigo", "nome", "marca", "preco_venda"] };
const aprovar = (pid: string) => db.rpc("agente_proposta_decidir", { p_loja: L, p_proposta: pid, p_versao: 1, p_hash: hashDe(pid), p_user: U, p_decisao: "aprovada" });

test("preparação: loja e Bling simulado", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja cadastro novo', 'loja-cadastro-novo')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista')`);
});

let p1 = "";
test("propõe produto novo: nada vai ao Bling e o item guarda a fonte e o rascunho validado", { skip }, async () => {
  bling.recebidos.length = 0;
  const r = await despachar("bling.produtos.preparar_cadastro", { rascunho: rascunho("CI001087"), fontes }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  p1 = (r.resultado as any).proposta_id; assert.ok(p1, JSON.stringify(r));
  assert.equal(bling.recebidos.length, 0); assert.equal(bling.produtos.size, 0);
});

test("sem a liberação do dono no banco, mesmo aprovada a proposta NÃO executa e nada chega ao Bling", { skip }, async () => {
  await aprovar(p1);
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId: p1, definicao: ativoNoRegistro, camposLiberados: LIBERADOS });
  assert.notEqual(r.itens[0]?.estado, "confirmada", JSON.stringify(r)); assert.equal(bling.recebidos.length, 0); assert.equal(bling.produtos.size, 0);
});

test("estado real de hoje (nenhum campo liberado): aprovada e liberada no banco, o executor ainda recusa o campo", { skip }, async () => {
  await db.rpc("agente_escrita_liberar", { p_loja: L, p_ferramenta: "bling.produtos.criar", p_user: U, p_referencia: "teste com Bling simulado" });
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId: p1, definicao: ativoNoRegistro });
  assert.equal(r.itens[0]?.estado, "falhou", JSON.stringify(r)); assert.match(String(r.itens[0]?.motivo), /campo_nao_liberado/);
  assert.equal(bling.recebidos.length, 0);
});

let p2 = "";
test("fim a fim no Bling SIMULADO: aprovada, liberada no banco e na lista do teste, o executor cria e CONFIRMA lendo de volta", { skip }, async () => {
  const r0 = await despachar("bling.produtos.preparar_cadastro", { rascunho: rascunho("CI001088"), fontes }, ctx());
  assert.ok((r0.resultado as any)?.proposta_id, `a execução do 1º cadastro libera o piloto para o 2º: ${JSON.stringify(r0.resultado)}`);
  p2 = (r0.resultado as any).proposta_id;
  await aprovar(p2);
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId: p2, definicao: ativoNoRegistro, camposLiberados: LIBERADOS });
  assert.equal(r.itens[0]?.estado, "confirmada", JSON.stringify(r));
  assert.equal(bling.recebidos.length, 1); assert.equal([...bling.produtos.values()].filter((p) => p.codigo === "CI001088").length, 1);
  assert.match(String(bling.recebidos[0].idem), /./, "enviou a idempotency_key");
});

test("a mesma proposta não executa duas vezes: nenhum segundo produto é criado", { skip }, async () => {
  assert.ok(p2, "a proposta do teste anterior existe");
  const antes = bling.produtos.size, recebidos = bling.recebidos.length;
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: L, propostaId: p2, definicao: ativoNoRegistro, camposLiberados: LIBERADOS });
  assert.ok(r.erro || r.itens.every((i) => i.estado !== "confirmada"), JSON.stringify(r));
  assert.equal(bling.produtos.size, antes); assert.equal(bling.recebidos.length, recebidos);
});
