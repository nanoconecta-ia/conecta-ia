// Ações humanas do painel contra o banco real local: aprovar/rejeitar, revisar, travar, ensaio, execução, reconciliação, chaves e anexos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { acaoAprovacoes, acaoChaves, acaoConversas, nomeSeguro } from "./acoes.ts";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar } from "./despacho.ts";
import { BlingMock } from "./bling_mock.ts";
import { sha256Hex } from "./cripto.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "eeeeeeee-0000-0000-0000-00000000000e", U = "66666666-6666-6666-6666-666666666666", ED = "77777777-7777-7777-7777-777777777777";
const bling = new BlingMock();
const deps = (extra = {}) => ({ rpc: db.rpc as any, dados: db as any, blingLeitura: bling, ...extra });
const lojista = { userId: U, lojaId: L }, editor = { userId: ED, lojaId: L };
const ctx = () => ({ origem: "chat" as const, lojaId: L, userId: U, dados: dadosSupabase(db as any, L), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: "Nano.ia" } });
const prod = (sku: string) => db.sql(`select id from public.produtos where sku = '${sku}'`);
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);

async function proposta(sku: string, campos: Record<string, unknown>) {
  const r = await despachar("bling.produtos.preparar_atualizacao", { sku, campos, fontes: [{ url: "https://exemplo.com/f" }] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r)); return (r.resultado as any).proposta_id as string;
}
async function interna(sku: string, depois: Record<string, unknown>, risco = "MEDIUM") {
  const r = await despachar("conecta.proposta.criar", { titulo: "Enriquecer " + sku, itens: [{ sku, operacao: "conecta.enriquecimento.definir", campos: Object.keys(depois), antes: {}, depois, fontes: [{ documento: "catalogo.pdf" }], risco }] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r)); return (r.resultado as any).proposta_id as string;
}

test("preparação", { skip }, () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja ações', 'loja-acoes')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U}', 'lojista'), ('${L}', '${ED}', 'editor')`);
  for (let n = 1; n <= 5; n++) { db.sql(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao) values ('${L}', '${1000 + n}', 'ACAO-00${n}', 'Peça ${n}', 10, 'A')`); bling.semear(String(1000 + n), { codigo: `ACAO-00${n}`, nome: `Peça ${n}`, preco: 10, situacao: "A" }); }
});

test("decidir: validação de entrada, hash errado, editor sem permissão, aprovação, duplicidade e risco alto", { skip }, async () => {
  const p = await proposta("ACAO-001", { marca: "Sabó" });
  const base = { acao: "decidir", proposta_id: p, versao: 1, hash: hashDe(p), decisao: "aprovada" };
  assert.equal((await acaoAprovacoes({ acao: "decidir" }, lojista, deps())).status, 400);
  assert.equal((await acaoAprovacoes({ ...base, hash: "x" }, lojista, deps())).status, 400);
  const errado = await acaoAprovacoes({ ...base, hash: "0".repeat(64) }, lojista, deps());
  assert.equal(errado.status, 409); assert.match(String(errado.corpo.erro), /mudou/);
  assert.equal((await acaoAprovacoes(base, editor, deps())).status, 403);
  const ok = await acaoAprovacoes(base, lojista, deps());
  assert.equal(ok.status, 200, JSON.stringify(ok)); assert.equal(ok.corpo.estado, "aprovada");
  assert.equal((await acaoAprovacoes(base, lojista, deps())).status, 409);

  const alto = await interna("ACAO-002", { descricao_curta: "x" }, "HIGH");
  const semConf = await acaoAprovacoes({ acao: "decidir", proposta_id: alto, versao: 1, hash: hashDe(alto), decisao: "aprovada" }, lojista, deps());
  assert.equal(semConf.status, 422);
  assert.equal((await acaoAprovacoes({ acao: "decidir", proposta_id: alto, versao: 1, hash: hashDe(alto), decisao: "aprovada", confirmacao_explicita: true }, lojista, deps())).status, 200);
});

test("rejeitar solta o produto; revisar cria nova versão e invalida a anterior", { skip }, async () => {
  const p = await proposta("ACAO-003", { marca: "Sabó" });
  const rej = await acaoAprovacoes({ acao: "decidir", proposta_id: p, versao: 1, hash: hashDe(p), decisao: "rejeitada" }, lojista, deps());
  assert.equal(rej.status, 200); assert.equal(db.sql(`select estado from public.produto_travas where produto_id = '${prod("ACAO-003")}'`), "liberado_propostas");
  const p2 = await proposta("ACAO-003", { marca: "Outra" });
  const rev = await acaoAprovacoes({ acao: "revisar", proposta_id: p2 }, lojista, deps());
  assert.equal(rev.status, 200); assert.equal(db.sql(`select versao from public.agente_propostas where id = '${rev.corpo.proposta_id}'`), "2");
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${p2}'`), "invalidada");
});

test("travar/destravar em lote: editor trava, só lojista destrava", { skip }, async () => {
  const ids = [prod("ACAO-004"), prod("ACAO-005")];
  assert.equal((await acaoAprovacoes({ acao: "travar", produtos: ids, motivo: "auditado" }, editor, deps())).corpo.produtos_afetados, 2);
  assert.equal((await acaoAprovacoes({ acao: "destravar", produtos: ids, motivo: "ok" }, editor, deps())).status, 403);
  assert.equal((await acaoAprovacoes({ acao: "destravar", produtos: ids, motivo: "ok" }, lojista, deps())).corpo.produtos_afetados, 2);
  assert.equal((await acaoAprovacoes({ acao: "travar", produtos: ["x"] }, lojista, deps())).status, 400);
});

test("ensaio (executar_simulado) parte do produto real lido e não muda estado; sem leitura real, avisa a origem do mock", { skip }, async () => {
  const p = await proposta("ACAO-005", { marca: "Sabó" });
  assert.equal((await acaoAprovacoes({ acao: "decidir", proposta_id: p, versao: 1, hash: hashDe(p), decisao: "aprovada" }, lojista, deps())).status, 200);
  const r = await acaoAprovacoes({ acao: "executar_simulado", proposta_id: p }, lojista, deps());
  assert.equal(r.status, 200, JSON.stringify(r)); assert.equal((r.corpo.relatorio as any).itens[0].ok, true);
  assert.match(String((r.corpo.semeado_de as string[])[0]), /leitura real do Bling/);
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${p}'`), "aprovada");
  assert.equal(bling.produtos.get("1005")!.marca, undefined, "o Bling (mock de leitura) não foi tocado pelo ensaio");
  const sem = await acaoAprovacoes({ acao: "executar_simulado", proposta_id: p }, lojista, deps({ blingLeitura: undefined }));
  assert.match(String((sem.corpo.semeado_de as string[])[0]), /'antes' da proposta/);
});

test("executar: item interno aprovado executa; escrita no Bling é barrada; nada vai ao Bling", { skip }, async () => {
  const pi = await interna("ACAO-004", { descricao_curta: "Peça de teste" });
  await acaoAprovacoes({ acao: "decidir", proposta_id: pi, versao: 1, hash: hashDe(pi), decisao: "aprovada" }, lojista, deps());
  const r = await acaoAprovacoes({ acao: "executar", proposta_id: pi }, lojista, deps());
  assert.equal(r.status, 200, JSON.stringify(r)); assert.equal((r.corpo.relatorio as any).estado_final, "executada");
  assert.equal(db.sql(`select status::text from public.produto_enriquecimento where produto_id = '${prod("ACAO-004")}' and campo = 'descricao_curta'`), "aprovado");

  const antes = bling.recebidos.length;
  const bl = await proposta("ACAO-004", { marca: "Sabó" });
  await acaoAprovacoes({ acao: "decidir", proposta_id: bl, versao: 1, hash: hashDe(bl), decisao: "aprovada" }, lojista, deps());
  const bloqueada = await acaoAprovacoes({ acao: "executar", proposta_id: bl }, lojista, deps());
  assert.equal(bloqueada.status, 403); assert.match(String(bloqueada.corpo.erro), /desligada/);
  assert.equal(bling.recebidos.length, antes);
});

test("reconciliar: operação desconhecida com prova de que gravou", { skip }, async () => {
  const p = await proposta("ACAO-003", { marca: "Sabó" });
  await acaoAprovacoes({ acao: "decidir", proposta_id: p, versao: 1, hash: hashDe(p), decisao: "aprovada" }, lojista, deps());
  // simula timeout que gravou: abre a operação à mão e fecha como desconhecida; o Bling (mock) já tem o valor
  await db.rpc("agente_escrita_liberar", { p_loja: L, p_ferramenta: "bling.produtos.alterar", p_user: U, p_referencia: "teste das ações do painel" });
  await db.rpc("agente_proposta_iniciar_execucao", { p_loja: L, p_proposta: p });
  const item = db.sql(`select id from public.agente_proposta_itens where proposta_id = '${p}'`);
  const op = (await db.rpc("agente_operacao_abrir", { p_loja: L, p_item: item, p_ferramenta: "bling.produtos.alterar", p_requisicao: {} })).data as string;
  await db.rpc("agente_operacao_marcar_enviada", { p_loja: L, p_operacao: op });
  await db.rpc("agente_operacao_fechar", { p_loja: L, p_operacao: op, p_estado: "desconhecida", p_resposta: null, p_evidencia: null, p_erro: "timeout" });
  bling.produtos.get("1003")!.marca = "Sabó";
  const r = await acaoAprovacoes({ acao: "reconciliar", operacao_id: op }, lojista, deps());
  assert.equal(r.status, 200); assert.equal(r.corpo.resultado, "gravado");
  assert.equal(db.sql(`select estado from public.agente_proposta_itens where id = '${item}'`), "confirmado");
  assert.equal((await acaoAprovacoes({ acao: "reconciliar", operacao_id: "11111111-1111-1111-1111-111111111111" }, lojista, deps())).status, 404);
});

test("chaves MCP: token aparece uma vez, só o hash vai ao banco; 'aprovar'/'executar' não existem; só lojista; revogar", { skip }, async () => {
  const exp = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const c = await acaoChaves({ acao: "criar", nome: "ChatGPT", cliente: "GPT", escopos: ["leitura", "propor"], expira_em: exp }, lojista, deps());
  assert.equal(c.status, 200, JSON.stringify(c)); const token = String(c.corpo.token);
  assert.match(token, /^cia_mcp_/);
  assert.equal(db.sql(`select hash_chave from public.loja_mcp_chaves where id = '${c.corpo.id}'`), await sha256Hex(token));
  assert.ok(!db.sql(`select to_jsonb(k)::text from public.loja_mcp_chaves k where id = '${c.corpo.id}'`).includes(token), "o token não está no banco");
  assert.equal((await acaoChaves({ acao: "criar", nome: "Xx", escopos: ["aprovar"], expira_em: exp }, lojista, deps())).status, 400);
  assert.equal((await acaoChaves({ acao: "criar", nome: "Xx", escopos: ["executar"], expira_em: exp }, lojista, deps())).status, 400);
  assert.equal((await acaoChaves({ acao: "criar", nome: "Xx", escopos: ["leitura"], expira_em: exp }, editor, deps())).status, 403);
  assert.equal((await acaoChaves({ acao: "criar", nome: "Xx", escopos: ["leitura"], expira_em: new Date(Date.now() + 400 * 86_400_000).toISOString() }, lojista, deps())).status, 422);
  assert.equal((await acaoChaves({ acao: "revogar", id: c.corpo.id }, editor, deps())).status, 403);
  assert.equal((await acaoChaves({ acao: "revogar", id: c.corpo.id }, lojista, deps())).status, 200);
  assert.equal((await acaoChaves({ acao: "revogar", id: c.corpo.id }, lojista, deps())).status, 404);
});

test("conversas e anexos: URL assinada só para o dono, caminho na pasta da loja/usuário, tipo e tamanho validados", { skip }, async () => {
  const assinados: string[] = [];
  const dc = deps({ assinarUpload: async (path: string) => { assinados.push(path); return { path, token: "tk" }; }, assinarDownload: async (p: string) => `https://exemplo.supabase.co/assinada/${p}?t=1` });
  const conv = (await acaoConversas({ acao: "criar", titulo: "Anexos" }, lojista, dc)).corpo.id as string;
  assert.equal((await acaoConversas({ acao: "renomear", conversa_id: conv, titulo: "Cabeçote HR", projeto: "Motor" }, lojista, dc)).status, 200);
  assert.equal(db.sql(`select titulo || '|' || projeto from public.agente_conversas where id = '${conv}'`), "Cabeçote HR|Motor");
  assert.equal((await acaoConversas({ acao: "renomear", conversa_id: conv, titulo: "roubada" }, editor, dc)).status, 404, "outro usuário não renomeia");
  assert.equal((await acaoConversas({ acao: "preparar_anexo", conversa_id: conv, nome: "x.exe", mime: "application/x-msdownload", bytes: 10 }, lojista, dc)).status, 422);
  assert.equal((await acaoConversas({ acao: "preparar_anexo", conversa_id: conv, nome: "x.pdf", mime: "application/pdf", bytes: 30 * 1024 * 1024 }, lojista, dc)).status, 422);
  assert.equal((await acaoConversas({ acao: "preparar_anexo", conversa_id: conv, nome: "x.pdf", mime: "application/pdf", bytes: 100 }, editor, dc)).status, 404);
  const prep = await acaoConversas({ acao: "preparar_anexo", conversa_id: conv, nome: "Catálogo ../../etc.pdf", mime: "application/pdf", bytes: 1000 }, lojista, dc);
  assert.equal(prep.status, 200); const path = String(prep.corpo.path);
  assert.ok(path.startsWith(`${L}/${U}/`) && !path.includes(".."), path); assert.deepEqual(assinados, [path]);
  const reg = (p: string) => acaoConversas({ acao: "registrar_anexo", conversa_id: conv, nome: "Catálogo.pdf", mime: "application/pdf", bytes: 1000, sha256: "a".repeat(64), path: p }, lojista, dc);
  assert.equal((await reg(`${L}/${ED}/outro.pdf`)).status, 422, "pasta de outro usuário é recusada");
  assert.equal((await reg(`bbbbbbbb-0000-0000-0000-00000000000b/${U}/x.pdf`)).status, 422, "pasta de outra loja é recusada");
  const ok = await reg(path); assert.equal(ok.status, 200, JSON.stringify(ok));
  assert.match(String((await acaoConversas({ acao: "baixar_anexo", anexo_id: ok.corpo.id }, lojista, dc)).corpo.url), /assinada/);
  assert.equal((await acaoConversas({ acao: "baixar_anexo", anexo_id: ok.corpo.id }, editor, dc)).status, 404, "anexo alheio não baixa");
  assert.equal((await acaoConversas({ acao: "excluir", conversa_id: conv }, editor, dc)).status, 404);
  assert.equal((await acaoConversas({ acao: "excluir", conversa_id: conv }, lojista, dc)).status, 200);
  assert.equal(db.sql(`select count(*) from public.agente_anexos where conversa_id = '${conv}'`), "0");
});

test("nomeSeguro remove caminho e caracteres perigosos", () => {
  assert.equal(nomeSeguro("../../etc/passwd"), "etc_passwd");
  assert.equal(nomeSeguro("Catálogo Sabó 2026.pdf"), "Catalogo_Sabo_2026.pdf");
  assert.equal(nomeSeguro("///"), "arquivo");
});
