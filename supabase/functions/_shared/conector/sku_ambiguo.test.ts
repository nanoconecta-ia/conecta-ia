// SKU repetido no Bling: as leituras por SKU distinguem "não encontrado" de "SKU ambíguo", nunca escolhem um dos produtos e nunca olham outra loja.
// Roda o código de produção contra Postgres local (supabase/tests/rodar_aceitacao.sh). Sem CONECTOR_TEST_DB é ignorado.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { proporEnriquecimento } from "../ia/escrita.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const X = "cccccccc-0000-0000-0000-0000000000c1", Y = "dddddddd-0000-0000-0000-0000000000d1";

before(() => {
  if (skip) return;
  db.sql(`insert into public.lojas (id, nome, slug) values ('${X}', 'Loja X sku', 'loja-x-sku'), ('${Y}', 'Loja Y sku', 'loja-y-sku')`);
  db.sql(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao) values
    ('${X}','9001','DUP-1','Retentor A',5,'A'), ('${X}','9002','DUP-1','Retentor B',6,'A'), ('${X}','9003','UNI-1','Único',7,'A'),
    ('${Y}','9001','DUP-1','Retentor da loja Y',8,'A')`);
});
after(() => { if (!skip) db.sql(`delete from public.lojas where id in ('${X}', '${Y}')`); });

test("verProduto: ok, não encontrado e ambíguo são respostas diferentes", { skip }, async () => {
  const d = dadosSupabase(db as any, X);
  assert.equal(((await d.verProduto("UNI-1")) as any).nome, "Único");
  assert.deepEqual(await d.verProduto("NAO-EXISTE"), { erro: "Produto não encontrado nesta loja.", motivo: "nao_encontrado" });
  const amb: any = await d.verProduto("DUP-1");
  assert.equal(amb.motivo, "sku_ambiguo"); assert.match(amb.erro, /mais de um produto/);
  assert.ok(!JSON.stringify(amb).includes("Retentor"), "não vaza dados de nenhum dos dois produtos");
});

test("produtoPorSku, prontoPublicacao e travas: ambíguo nunca vira produto escolhido", { skip }, async () => {
  const d = dadosSupabase(db as any, X);
  assert.equal((await d.produtoPorSku("DUP-1")).estado, "ambiguo");
  assert.equal((await d.produtoPorSku("NAO-EXISTE")).estado, "nao_encontrado");
  const ok = await d.produtoPorSku("UNI-1"); assert.equal(ok.estado, "ok");
  assert.equal(((await d.prontoPublicacao({ sku: "DUP-1" })) as any).motivo, "sku_ambiguo");
  assert.equal(((await d.travas({ sku: "DUP-1" })) as any).motivo, "sku_ambiguo");
  assert.equal(((await d.travas({ sku: "NAO-EXISTE" })) as any).erro.includes("Informe produto_id ou sku"), true);
});

test("isolamento: o mesmo SKU em outra loja não conta como repetição nem aparece", { skip }, async () => {
  const y = dadosSupabase(db as any, Y);
  assert.equal(((await y.verProduto("DUP-1")) as any).nome, "Retentor da loja Y");
  assert.equal((await y.produtoPorSku("DUP-1")).estado, "ok");
  assert.equal((await y.produtoPorSku("UNI-1")).estado, "nao_encontrado", "UNI-1 é da loja X");
});

test("ferramentas de escrita do agente recusam SKU ambíguo e não gravam nada", { skip }, async () => {
  const antes = db.sql(`select count(*) from public.produto_enriquecimento where loja_id = '${X}'`);
  const r: any = await proporEnriquecimento(db as any, X, { sku: "DUP-1", campo: "marca_peca", valor: "Teste", fonte: "https://fonte.exemplo/x" });
  assert.match(r.erro, /mais de um produto/);
  assert.equal(db.sql(`select count(*) from public.produto_enriquecimento where loja_id = '${X}'`), antes);
});
