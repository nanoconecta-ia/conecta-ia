// Ação "bling.categorias.preparar_alteracao_lote": lê as sugestões de categoria APROVADAS e cria a proposta de troca de categoria.
// Roda o código de produção contra um Postgres local com todas as migrações e o Bling SIMULADO. Nada é enviado ao Bling.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar } from "./despacho.ts";
import { acaoAprovacoes } from "./acoes.ts";
import { BlingMock } from "./bling_mock.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "cccccccc-0000-0000-0000-0000000000c1", U = "99999999-9999-9999-9999-999999999999";
const N_MOTOR = "dddddddd-0000-0000-0000-000000000001", N_VISC = "dddddddd-0000-0000-0000-000000000002", N_PIVO = "dddddddd-0000-0000-0000-000000000003", N_INJ = "dddddddd-0000-0000-0000-000000000004", N_ARREF = "dddddddd-0000-0000-0000-000000000005";
const bling = new BlingMock();
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const deps = () => ({ rpc: db.rpc as any, dados: db as any, blingLeitura: bling });
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);
const prod = (sku: string) => db.sql(`select id from public.produtos where sku = '${sku}'`);

function produto(n: number, sku: string, situacao: string, no: string | null, cat: string | null = "1072643") {
  db.sql(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao, categoria_bling_id, taxonomia_no_id) values ('${L}', '${2000 + n}', '${sku}', 'Peça ${sku}', 10, '${situacao}', ${cat ? `'${cat}'` : "null"}, ${no ? `'${no}'` : "null"})`);
  bling.semear(String(2000 + n), { codigo: sku, categoria: { id: Number(cat ?? 0) } });
}
function aprovar(sku: string, valor: string, status = "aprovado", conf = 0.9) {
  db.sql(`insert into public.produto_enriquecimento (loja_id, produto_id, campo, valor, fonte, coletado_em, confianca, status) values ('${L}', '${prod(sku)}', 'categoria_sugerida', to_jsonb('${valor}'::text), 'teste', now(), ${conf}, '${status}')`);
}

test("preparação: loja, taxonomia, categorias do Bling, ponte e produtos", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja categorias', 'loja-categorias')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista')`);
  db.sql(`insert into public.taxonomia_nos (id, perfil_ramo, pai_id, nome, slug, status) values
    ('${N_ARREF}', 'autopecas', null, 'Arrefecimento', 'arref-lote', 'aprovado'), ('${N_VISC}', 'autopecas', '${N_ARREF}', 'Embreagens viscosas', 'visc-lote', 'aprovado'),
    ('${N_MOTOR}', 'autopecas', null, 'Motor', 'motor-lote', 'aprovado'),
    ('${N_PIVO}', 'autopecas', null, 'Pivôs e terminais', 'pivo-lote', 'aprovado'), ('${N_INJ}', 'autopecas', null, 'Bicos injetores', 'inj-lote', 'proposto')`);
  db.sql(`insert into public.bling_categorias (loja_id, bling_id, nome) values ('${L}', '14668464', 'Embreagens viscosas'), ('${L}', '14668460', 'Motor'), ('${L}', '14676575', 'Pivôs'), ('${L}', '14676577', 'Terminais de direção')`);
  db.sql(`insert into public.bling_categoria_taxonomia (loja_id, bling_categoria_id, taxonomia_no_id) values ('${L}', '14668464', '${N_VISC}'), ('${L}', '14668460', '${N_MOTOR}'), ('${L}', '14676575', '${N_PIVO}'), ('${L}', '14676577', '${N_PIVO}')`);
  produto(1, "LOTE-001", "A", N_VISC);            // destino único
  produto(2, "LOTE-002", "A", N_PIVO);            // ambíguo: Pivôs ou Terminais
  produto(3, "LOTE-003", "I", N_VISC);            // inativo
  produto(4, "LOTE-004", "A", N_INJ);             // sem categoria equivalente no Bling
  produto(5, "LOTE-005", "A", N_MOTOR);           // decisão aprovada ainda não aplicada ao nó (produto está em outro nó)
  produto(6, "LOTE-006", "A", N_VISC);            // pendente (não aprovada)
  produto(7, "LOTE-007", "A", N_VISC, "14668464"); // já está na categoria de destino no Bling
  aprovar("LOTE-001", "Arrefecimento › Embreagens viscosas");
  aprovar("LOTE-002", "Pivôs e terminais");
  aprovar("LOTE-003", "Arrefecimento › Embreagens viscosas");
  aprovar("LOTE-004", "Bicos injetores");
  aprovar("LOTE-005", "Arrefecimento › Embreagens viscosas");   // aprovada para Viscosas, mas o produto está em Motor
  aprovar("LOTE-006", "Arrefecimento › Embreagens viscosas", "a_confirmar");
  aprovar("LOTE-007", "Arrefecimento › Embreagens viscosas");
});

test("cria a proposta SÓ de categoria, com o 'antes' lido no Bling agora; nada vai ao Bling", { skip }, async () => {
  bling.recebidos.length = 0;
  const r = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-001"] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  const res = r.resultado as any;
  assert.equal(res.itens, 1); assert.ok(res.proposta_id);
  const it = JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${res.proposta_id}'`));
  assert.equal(it.operacao, "bling.produtos.alterar"); assert.equal(it.alvo, "2001");
  assert.deepEqual(it.campos, ["categoria_bling_id"]);
  assert.deepEqual(it.antes, { categoria_bling_id: "1072643" }, "antes vem da leitura do Bling");
  assert.deepEqual(it.depois, { categoria_bling_id: "14668464" });
  assert.equal(it.risco, "MEDIUM");
  assert.equal(bling.recebidos.length, 0, "nenhuma escrita chegou ao Bling");
});

test("cada caso fora do lote volta como pendência com o motivo certo", { skip }, async () => {
  const r = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-002", "LOTE-003", "LOTE-004", "LOTE-005", "LOTE-006", "LOTE-007", "LOTE-999"] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  const res = r.resultado as any;
  assert.equal(res.proposta_id, undefined, "nenhum item entrou");
  const por = Object.fromEntries(res.pendencias.map((p: any) => [p.sku, p.motivo]));
  assert.deepEqual(por, { "LOTE-002": "escolha_pendente", "LOTE-003": "inativo", "LOTE-004": "sem_equivalente", "LOTE-005": "excluido", "LOTE-006": "sem_sugestao_aprovada", "LOTE-007": "ja_na_categoria", "LOTE-999": "sem_sugestao_aprovada" });
  assert.equal(res.pendencias.find((p: any) => p.sku === "LOTE-002").candidatas.length, 2);
});

test("com a escolha do lojista o caso ambíguo entra; escolha fora das candidatas é recusada", { skip }, async () => {
  const ruim = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-002"], escolhas: { "LOTE-002": "14668464" } }, ctx());
  assert.equal((ruim.resultado as any).pendencias[0].motivo, "escolha_invalida");
  const r = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-002"], escolhas: { "LOTE-002": "14676577" } }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  const res = r.resultado as any;
  const it = JSON.parse(db.sql(`select to_jsonb(i) from public.agente_proposta_itens i where proposta_id = '${res.proposta_id}'`));
  assert.deepEqual(it.depois, { categoria_bling_id: "14676577" });
});

test("sem leitura do Bling não há proposta (o 'antes' precisa ser real)", { skip }, async () => {
  const r = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-001"] }, { ...ctx(), bling: undefined });
  assert.match(JSON.stringify(r), /Leitura do Bling indisponível/);
});

test("entrada inválida é recusada: lista de SKUs vazia ou grande demais", { skip }, async () => {
  assert.equal((await despachar("bling.categorias.preparar_alteracao_lote", { skus: [] }, ctx())).ok, false);
  assert.equal((await despachar("bling.categorias.preparar_alteracao_lote", {}, ctx())).ok, false);
  assert.equal((await despachar("bling.categorias.preparar_alteracao_lote", { skus: Array.from({ length: 51 }, (_, i) => `S${i}`) }, ctx())).ok, false);
});

test("fim a fim: o lojista aprova a versão exata, o ensaio passa com a lista liberada e a execução real segue barrada", { skip }, async () => {
  const lojista = { userId: U, lojaId: L };
  const r = await despachar("bling.categorias.preparar_alteracao_lote", { skus: ["LOTE-001"] }, ctx());
  const id = (r.resultado as any).proposta_id as string;
  assert.equal((await acaoAprovacoes({ acao: "decidir", proposta_id: id, versao: 1, hash: hashDe(id), decisao: "aprovada" }, lojista, deps())).status, 200);
  const ensaio = await acaoAprovacoes({ acao: "executar_simulado", proposta_id: id }, lojista, deps());
  assert.equal(ensaio.status, 200, JSON.stringify(ensaio));
  assert.equal((ensaio.corpo.relatorio as any).itens[0].ok, true, "categoria passa na lista fechada de campos");
  const antes = bling.recebidos.length;
  const real = await acaoAprovacoes({ acao: "executar", proposta_id: id }, lojista, deps());
  assert.equal(real.status, 403); assert.match(String(real.corpo.erro), /desligada/);
  assert.equal(bling.recebidos.length, antes, "nada foi enviado ao Bling");
  assert.equal(bling.produtos.get("2001")!.categoria.id, 1072643, "o Bling simulado não mudou");
});
