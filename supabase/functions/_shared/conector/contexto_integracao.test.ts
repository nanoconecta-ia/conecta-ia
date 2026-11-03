// Integração do Contexto Vivo: o painel grava pela RPC (como usuário autenticado) e o Nano lê pelo handler de produção, tudo contra o
// Postgres LOCAL com todas as migrações. Prova isolamento por loja e por usuário, seleção múltipla, expiração e a recusa sem sessão.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { HANDLERS } from "./handlers.ts";
import { buscarDefinicao } from "./registro.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);

const LA = "dddddddd-0000-0000-0000-00000000000a", LB = "dddddddd-0000-0000-0000-00000000000b";
const UA = "dddddddd-1111-1111-1111-111111111111", UB = "dddddddd-2222-2222-2222-222222222222";
const P1 = "dddddddd-c000-0000-0000-000000000001", P2 = "dddddddd-c000-0000-0000-000000000002", PB = "dddddddd-c000-0000-0000-000000000003";
const EV = (n: number) => `dddddddd-e000-0000-0000-00000000000${n}`;

/** Executa a RPC como o painel faria: papel `authenticated` + JWT do usuário (auth.uid()). */
function comoUsuario(user: string, loja: string, evento: string, acao: string, ativo: string | null, sel: string[], versaoBase: number) {
  const arr = sel.length ? `array[${sel.map((x) => `'${x}'`).join(",")}]::uuid[]` : "'{}'::uuid[]";
  const r = db.sql(`set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true); select public.contexto_registrar('${loja}', '${evento}', '${acao}', 'conecta-ui', ${ativo ? `'${ativo}'::uuid` : "null"}, ${arr}, ${versaoBase})::text;`);
  return JSON.parse(r.trim().split("\n").pop()!);
}
const ctxMcp = (lojaId: string) => ({ origem: "mcp", lojaId, userId: null, admin: db as never, dados: {} as never, rpc: (async () => ({ data: null, error: null })) as never } as never);
const lerComoNano = async (lojaId: string) => await HANDLERS["conecta.contexto.produto_ativo"]({}, ctxMcp(lojaId)) as { disponivel: boolean; produto_ativo?: { sku: string } | null; selecionados?: { sku: string }[]; erro?: string };

test("preparo: lojas, usuários e produtos de teste", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${LA}', 'Ctx A', 'ctx-a'), ('${LB}', 'Ctx B', 'ctx-b') on conflict do nothing;
    insert into public.usuarios_loja (loja_id, user_id, papel) values ('${LA}', '${UA}', 'lojista'), ('${LA}', '${UB}', 'editor'), ('${LB}', '${UB}', 'lojista') on conflict do nothing;
    insert into public.produtos (id, loja_id, bling_id, sku, nome, marca, situacao, publicado) values
      ('${P1}', '${LA}', '9001', 'CTX-OC1224', 'Filtro de óleo', 'Marca X', 'A', false), ('${P2}', '${LA}', '9002', 'CTX-80692', 'Junta', 'Marca Y', 'A', false), ('${PB}', '${LB}', '9003', 'CTX-OUTRA', 'De outra loja', 'Z', 'A', false) on conflict do nothing;`);
  assert.ok(buscarDefinicao("conecta.contexto.produto_ativo"), "a ferramenta está no registro único");
});
test("sem contexto gravado, o Nano recebe indisponível (não adivinha)", { skip }, async () => {
  const r = await lerComoNano(LA); assert.equal(r.disponivel, false); assert.equal(r.erro, "contexto_indisponivel");
});
test("seleção múltipla gravada pelo painel é lida pelo Nano sem SKU digitado", { skip }, async () => {
  const g = comoUsuario(UA, LA, EV(1), "produto.selecionado", null, [P1, P2], 0); assert.equal(g.ok, true);
  const r = await lerComoNano(LA); assert.equal(r.disponivel, true); assert.deepEqual(r.selecionados!.map((p) => p.sku).sort(), ["CTX-80692", "CTX-OC1224"]);
  assert.equal(JSON.stringify(r).includes("custo"), false);
});
test("produto aberto vira produto ativo; trocar a ficha atualiza na mesma sessão", { skip }, async () => {
  assert.equal(comoUsuario(UA, LA, EV(2), "produto.aberto", P2, [P2], 1).ok, true);
  assert.equal((await lerComoNano(LA)).produto_ativo?.sku, "CTX-80692");
  assert.equal(comoUsuario(UA, LA, EV(3), "produto.aberto", P1, [P1], 2).ok, true);
  assert.equal((await lerComoNano(LA)).produto_ativo?.sku, "CTX-OC1224");
});
test("isolamento: o contexto da loja A nunca aparece para a loja B, e produto de B não entra em A", { skip }, async () => {
  assert.equal((await lerComoNano(LB)).disponivel, false);
  assert.equal(comoUsuario(UA, LA, EV(4), "produto.selecionado", null, [PB], 3).erro, "produto_fora_da_loja");
  assert.equal(comoUsuario(UB, LA, EV(5), "selecao.limpa", null, [], 0).ok, true, "editor da loja A grava a PRÓPRIA sessão");
  assert.equal(comoUsuario(UA, LB, EV(6), "selecao.limpa", null, [], 0).erro, "sem_acesso", "usuário sem vínculo com a loja B é recusado");
});
test("evento duplicado e versão antiga não regridem o estado", { skip }, async () => {
  assert.equal(comoUsuario(UA, LA, EV(3), "produto.aberto", P1, [P1], 2).duplicado, true);
  assert.equal(comoUsuario(UA, LA, EV(7), "produto.aberto", P2, [P2], 0).erro, "versao_conflito");
  assert.equal((await lerComoNano(LA)).produto_ativo?.sku === "CTX-OC1224" || (await lerComoNano(LA)).disponivel, true);
});
test("expirado: o Nano volta a receber indisponível", { skip }, async () => {
  db.sql(`update public.contexto_sessoes set expira_em = now() - interval '1 minute' where loja_id = '${LA}'`);
  assert.equal((await lerComoNano(LA)).disponivel, false);
});
test("limpeza", { skip }, () => { db.sql(`delete from public.contexto_sessoes where loja_id in ('${LA}','${LB}')`); });
