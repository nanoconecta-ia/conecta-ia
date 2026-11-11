// Ponta a ponta SEM produção e SEM escrita no Bling: Bling simulado (somente leitura) → sincronização real (`sincronizar`) →
// espelho no Postgres LOCAL → ferramenta do agente lê do espelho → proposta → aprovação presa a versão/hash.
// Prova que o espelho alimenta o agente e que nada é enviado ao Bling no caminho. Rodar: supabase/tests/rodar_aceitacao.sh
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql, lit } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar, type ContextoDespacho } from "./despacho.ts";
import { BlingMock } from "./bling_mock.ts";
import { sincronizar, type Existente, type ItemLista, type PortasSync } from "../bling_sync.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);

const L = "e2e2e2e2-0000-0000-0000-0000000000e2", OUTRA = "f2f2f2f2-0000-0000-0000-0000000000f2", U = "33333333-3333-3333-3333-333333333333";
const bling = new BlingMock();
const itens: ItemLista[] = [1, 2, 3].map((n) => ({ id: 8800 + n, codigo: `E2E-00${n}`, nome: `Peça E2E ${n}`, preco: 50 + n, situacao: "A", estoque: { saldoVirtualTotal: n } }));
let t = Date.parse("2026-10-25T12:00:00Z");

function portasReais(lojaId: string, lista: ItemLista[]): PortasSync {
  return {
    listarPagina: async (pg, lim) => ({ itens: lista.slice((pg - 1) * lim, pg * lim) }),
    detalhe: async (id) => { const i = lista.find((x) => x.id === id)!; return { id, codigo: i.codigo, nome: i.nome, preco: i.preco, situacao: i.situacao, estoque: i.estoque, marca: "", precoCusto: 9.99, fornecedor: { nome: "SEGREDO" } }; },
    existentes: async () => (db.json(`select coalesce(jsonb_agg(jsonb_build_object('bling_id', bling_id, 'sku', sku, 'nome', nome, 'preco', preco, 'estoque', estoque, 'situacao', situacao, 'sincronizado_em', sincronizado_em)), '[]') from public.produtos where loja_id = '${lojaId}'`) ?? []) as Existente[],
    gravar: async (linhas) => {
      for (const l of linhas) {
        const cols = Object.keys(l), vals = Object.values(l);
        db.sql(`insert into public.produtos (${cols.join(",")}) values (${vals.map((v) => lit(v)).join(",")}) on conflict (loja_id, bling_id) do update set ${cols.filter((c) => c !== "loja_id" && c !== "bling_id").map((c) => `${c} = excluded.${c}`).join(",")}`);
      }
    },
    marcarAusentes: async (ids) => { for (const id of ids) db.sql(`update public.produtos set situacao = 'ausente', publicado = false where loja_id = '${lojaId}' and bling_id = '${id}'`); },
    registrarErro: async (m) => { db.sql(`insert into public.sync_erros (loja_id, mensagem) values ('${lojaId}', ${lit(m)})`); },
    espera: async (ms) => { t += ms; }, agora: () => t,
  };
}
const ctx = (): ContextoDespacho => ({ origem: "chat", lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling,
  agente: { nome: "Conector IA", provedor: "compativel_openai", modelo: "modelo-de-teste", promptVersao: 1 } });

test("e2e 0: loja de teste", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja E2E', 'loja-e2e'), ('${OUTRA}', 'Outra loja', 'outra-e2e')`);
  db.sql(`insert into public.usuarios_loja (loja_id, user_id, papel) values ('${L}', '${U}', 'lojista')`);
  for (const i of itens) bling.semear(String(i.id), { codigo: i.codigo, nome: i.nome, preco: i.preco, situacao: "A", precoCusto: 9.99, fornecedor: { id: 1 } });
});

test("e2e 1: a sincronização grava o espelho, sem custo/fornecedor e sem publicar", { skip }, async () => {
  const r = await sincronizar(L, portasReais(L, itens));
  assert.equal(r.completo, true); assert.equal(r.gravados, 3);
  assert.equal(db.sql(`select count(*) from public.produtos where loja_id = '${L}'`), "3");
  assert.equal(db.sql(`select count(*) from public.produtos where loja_id = '${L}' and publicado`), "0", "o sync nunca publica");
  assert.equal(db.sql(`select count(*) from public.produtos where loja_id = '${OUTRA}'`), "0", "isolamento entre lojas");
  assert.ok(!db.sql(`select row_to_json(p)::text from public.produtos p where loja_id = '${L}' limit 1`).includes("SEGREDO"));
});

test("e2e 2: segunda rodada sem mudança não regrava; preço novo no Bling chega ao espelho", { skip }, async () => {
  assert.equal((await sincronizar(L, portasReais(L, itens))).detalhes, 0, "nada mudou: sem buscar detalhe");
  const novo = itens.map((i) => (i.id === 8801 ? { ...i, preco: 77 } : i));
  await sincronizar(L, portasReais(L, novo));
  assert.equal(db.sql(`select preco::float8 from public.produtos where loja_id = '${L}' and sku = 'E2E-001'`), "77");
});

test("e2e 3: o agente lê o produto do espelho e propõe enriquecimento com fonte; ninguém escreve no Bling", { skip }, async () => {
  const lido = await despachar("conecta.catalogo.ver", { sku: "E2E-002" }, ctx());
  assert.equal(lido.ok, true, JSON.stringify(lido));
  assert.match(JSON.stringify(lido.resultado), /E2E-002/);
  const prop = await despachar("bling.produtos.preparar_atualizacao", { sku: "E2E-002", campos: { marca: "Marca Teste" }, fontes: [{ url: "https://exemplo.com/catalogo" }] }, ctx());
  assert.equal(prop.ok, true, JSON.stringify(prop));
  const id = (prop.resultado as any).proposta_id as string;
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${id}'`), "pendente");
  assert.equal(bling.recebidos.length, 0, "proposta não envia nada ao Bling");
  const hash = db.sql(`select hash from public.agente_propostas where id = '${id}'`);
  const ok = await db.rpc("agente_proposta_decidir", { p_loja: L, p_proposta: id, p_versao: 1, p_hash: hash, p_user: U, p_decisao: "aprovada" });
  assert.equal(ok.error, null, JSON.stringify(ok.error));
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${id}'`), "aprovada");
  assert.equal(bling.recebidos.length, 0, "aprovar não é executar: nenhuma escrita no Bling");
  assert.equal(db.sql(`select marca from public.produtos where loja_id = '${L}' and sku = 'E2E-002'`), "", "o espelho só muda por leitura do Bling");
});

test("e2e 4: produto que some do Bling vira ausente e despublica (listagem completa)", { skip }, async () => {
  await sincronizar(L, portasReais(L, itens.filter((i) => i.id !== 8803)));
  assert.equal(db.sql(`select situacao from public.produtos where loja_id = '${L}' and sku = 'E2E-003'`), "ausente");
});
