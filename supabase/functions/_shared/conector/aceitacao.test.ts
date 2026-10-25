// Testes de aceitação do Gênesis (diretriz, item 9). Rodam o código de PRODUÇÃO (despacho, handlers, executor, dados)
// contra um Postgres LOCAL com todas as migrações. Os provedores de LLM e o Bling são simulados por fetch/porta; o banco NÃO.
// Rodar: supabase/tests/rodar_aceitacao.sh   (sem CONECTOR_TEST_DB os testes são ignorados, p.ex. fora do ambiente local).
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { despachar, executorParaLlm, ferramentasParaLlm, type ContextoDespacho } from "./despacho.ts";
import { executarProposta, reconciliar, simularProposta, type ItemExecucao } from "./executor.ts";
import { BlingMock } from "./bling_mock.ts";
import { buscarDefinicao, FERRAMENTAS_CONECTOR } from "./registro.ts";
import { conversar } from "../ia/claude.ts";
import { gerarSitemap } from "../seo/sitemap.ts";
import { paginaProdutoHtml } from "../seo/pagina.ts";
import type { LojaSeo, ProdutoSeo } from "../seo/dados.ts";

const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB (veja supabase/tests/rodar_aceitacao.sh)";
const db = BANCO ? criarPsql(BANCO) : (null as never);

const A = "aaaaaaaa-0000-0000-0000-00000000000a", U1 = "11111111-1111-1111-1111-111111111111", U2 = "22222222-2222-2222-2222-222222222222";
const sku = (n: number) => `TESTE-00${n}`;
const bling = new BlingMock();
const emitir = (sql: string) => db.sql(sql);

const ctx = (extra: Partial<ContextoDespacho> = {}): ContextoDespacho => ({
  origem: "chat", lojaId: A, userId: U1, dados: dadosSupabase(db as any, A), rpc: db.rpc as any, admin: db as any, bling,
  agente: { nome: "Gênesis", provedor: "compativel_openai", modelo: "modelo-de-teste", promptVersao: 1 }, ...extra,
});
const sobreescreverBlingAtivo = (id: string) => { const d = buscarDefinicao(id); return d && id.startsWith("bling.") && d.permissao === "executar" ? { ...d, estado: "ativa" as const } : d; };
const hashDe = (id: string) => db.sql(`select hash from public.agente_propostas where id = '${id}'`);
const aprovar = async (propostaId: string, extra: Record<string, unknown> = {}) =>
  db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: propostaId, p_versao: 1, p_hash: hashDe(propostaId), p_user: U1, p_decisao: "aprovada", ...extra });
const propor = async (s: string, campos: Record<string, unknown>, fonte = "https://exemplo.com/catalogo-sabo") => {
  const r = await despachar("bling.produtos.preparar_atualizacao", { sku: s, campos, fontes: [{ url: fonte }] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  return (r.resultado as any).proposta_id as string;
};
const itemDe = (propostaId: string): ItemExecucao => {
  const l = db.json(`select jsonb_build_object('item_id', id, 'produto_id', produto_id, 'operacao', operacao, 'alvo', alvo, 'campos', to_jsonb(campos), 'antes', antes, 'depois', depois, 'idempotency_key', idempotency_key) from public.agente_proposta_itens where proposta_id = '${propostaId}' order by ordem limit 1`);
  return l as ItemExecucao;
};

test("preparação: loja, produtos e Bling simulado", { skip }, () => {
  emitir(`insert into public.lojas (id, nome, slug) values ('${A}', 'Loja de teste', 'loja-a')`);
  emitir(`insert into public.usuarios_loja (loja_id, user_id, papel) values ('${A}', '${U1}', 'lojista'), ('${A}', '${U2}', 'editor')`);
  for (let n = 1; n <= 7; n++) {
    emitir(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, estoque, situacao) values ('${A}', '${700 + n}', '${sku(n)}', 'Produto de teste ${n}', ${100 + n}, 3, 'A')`);
    // O Bling simulado traz também campos que o Gênesis NUNCA pode ver ou alterar (custo, fornecedor, fiscal).
    bling.semear(String(700 + n), { codigo: sku(n), nome: `Produto de teste ${n}`, preco: 100 + n, situacao: "A", precoCusto: 55.5, fornecedor: { id: 9 }, tributacao: { ncm: "8409.91.99" } });
  }
  assert.equal(db.sql(`select count(*) from public.produtos`), "7");
});

// ---------------------------------------------------------------------------------------------------- 1. LLM chama ferramenta real
test("1a. modelo compatível com OpenAI (GPT) consulta uma ferramenta REAL do Gênesis e o resultado vem do banco", { skip }, async () => {
  const pedidos: any[] = [];
  const passos = [
    { choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "conecta__catalogo__ver", arguments: JSON.stringify({ sku: sku(1) }) } }] } }], usage: { total_tokens: 50 } },
    { choices: [{ message: { content: "O produto TESTE-001 ainda não tem marca, GTIN nem peso." } }], usage: { total_tokens: 30 } },
  ];
  let i = 0;
  const fetchFalso = (async (_u: string, init: RequestInit) => { pedidos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(passos[i++])); }) as typeof fetch;
  const r = await conversar({ chave: "chave-de-teste", modelo: "modelo-de-teste", sistema: "Você é o Gênesis.", mensagens: [{ role: "user", content: "o que falta no TESTE-001?" }],
    ferramentas: ferramentasParaLlm("chat"), executar: executorParaLlm(ctx()), fetch: fetchFalso, provedor: "compativel_openai", baseUrl: "https://api.exemplo-llm.com/v1" });
  assert.deepEqual(r.ferramentasUsadas, ["conecta__catalogo__ver"]);
  const resultadoDaFerramenta = pedidos[1].messages.find((m: any) => m.role === "tool").content;
  assert.match(resultadoDaFerramenta, /Produto de teste 1/); assert.match(resultadoDaFerramenta, /faltando_para_publicar/);
  const nomes = pedidos[0].tools.map((t: any) => t.function.name);
  assert.ok(nomes.includes("conecta__catalogo__ver"));
  assert.ok(!nomes.some((n: string) => /alterar|criar|publicar|definir/.test(n) && n.startsWith("bling")), "o LLM não enxerga ferramenta de escrita do Bling");
  assert.equal(db.sql(`select count(*) from public.agente_chamadas_ferramenta where ferramenta = 'conecta.catalogo.ver' and origem = 'chat' and decisao = 'permitida'`), "1");
});

test("1b. Gemini também consulta ferramenta real (mesmo registro, outro adaptador)", { skip }, async () => {
  const corpos: any[] = [];
  const passos = [
    { candidates: [{ content: { parts: [{ functionCall: { name: "conecta__catalogo__resumo", args: {} } }] } }], usageMetadata: { totalTokenCount: 40 } },
    { candidates: [{ content: { parts: [{ text: "A loja tem 7 produtos." }] } }], usageMetadata: { totalTokenCount: 20 } },
  ];
  let i = 0;
  const fetchFalso = (async (_u: string, init: RequestInit) => { corpos.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(passos[i++])); }) as typeof fetch;
  const r = await conversar({ chave: "k", modelo: "gemini-teste", sistema: "s", mensagens: [{ role: "user", content: "resumo" }], ferramentas: ferramentasParaLlm("chat"), executar: executorParaLlm(ctx()), fetch: fetchFalso, provedor: "gemini" });
  assert.deepEqual(r.ferramentasUsadas, ["conecta__catalogo__resumo"]);
  assert.match(JSON.stringify(corpos[1]), /"produtos":7/);
});

// ---------------------------------------------------------------------------------------------------- 2. Bling
test("2. consulta de produto no Bling devolve só campos permitidos (sem custo, fornecedor ou fiscal)", { skip }, async () => {
  const r = await despachar("bling.produtos.consultar", { sku: sku(1) }, ctx());
  assert.equal(r.ok, true);
  const p = (r.resultado as any).produto;
  assert.equal(p.codigo, sku(1)); assert.equal(p.id, 701);
  for (const proibido of ["precoCusto", "fornecedor", "tributacao"]) assert.ok(!(proibido in p), `${proibido} não pode vazar para o LLM`);
  assert.match((r.resultado as any).fonte, /Bling/);
});

// ---------------------------------------------------------------------------------------------------- 3 e 4. proposta com fontes + mapeamento nativo
let propostaA = "";
test("3/4. proposta de enriquecimento com fonte, antes lido do Bling agora e mapeamento para campos nativos", { skip }, async () => {
  propostaA = await propor(sku(1), { marca: "Sabó", descricao_curta: "Cabeçote do motor HR 2.5 16V D4CB" });
  const it = itemDe(propostaA);
  assert.equal(it.operacao, "bling.produtos.alterar"); assert.equal(it.alvo, "701");
  assert.deepEqual(it.antes, { marca: null, descricao_curta: null }, "antes vem da leitura do Bling no momento da proposta");
  assert.match(db.sql(`select fontes::text from public.agente_proposta_itens where proposta_id = '${propostaA}'`), /exemplo\.com\/catalogo-sabo/);
  assert.match(hashDe(propostaA), /^[0-9a-f]{64}$/);
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${propostaA}'`), "pendente");
  assert.equal(db.sql(`select estado from public.produto_travas where produto_id = (select id from public.produtos where sku = '${sku(1)}')`), "pendente_aprovacao");
});

test("4b. campo fiscal, de custo ou sem equivalente no Bling é recusado antes de existir proposta", { skip }, async () => {
  const fiscal = await despachar("bling.produtos.preparar_atualizacao", { sku: sku(2), campos: { ncm: "8409.91.99" }, fontes: [{ url: "https://x.com" }] }, ctx());
  assert.equal(fiscal.ok, false); assert.match(JSON.stringify(fiscal.resultado), /proibido/);
  const semEquivalente = await despachar("bling.produtos.preparar_atualizacao", { sku: sku(2), campos: { aplicacao_veicular: "HR 2.5" }, fontes: [{ url: "https://x.com" }] }, ctx());
  assert.equal(semEquivalente.ok, false); assert.match(JSON.stringify(semEquivalente.resultado), /só no Conecta\.IA/);
  const semFonte = await despachar("bling.produtos.preparar_atualizacao", { sku: sku(2), campos: { marca: "X" }, fontes: [] }, ctx());
  assert.equal(semFonte.ok, false); assert.match(semFonte.erro ?? "", /entrada_invalida/);
  assert.equal(db.sql(`select count(*) from public.agente_propostas where titulo like '%${sku(2)}%'`), "0");
});

// ---------------------------------------------------------------------------------------------------- 5. aprovação versionada
test("5. aprovação presa à versão/hash: hash errado é recusado; a versão revisada invalida a anterior; agente não aprova", { skip }, async () => {
  const errado = await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: propostaA, p_versao: 1, p_hash: "0".repeat(64), p_user: U1, p_decisao: "aprovada" });
  assert.match(errado.error?.message ?? "", /versao_ou_hash_divergente/);
  const editor = await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: propostaA, p_versao: 1, p_hash: hashDe(propostaA), p_user: U2, p_decisao: "aprovada" });
  assert.match(editor.error?.message ?? "", /sem_permissao/);
  const semHumano = await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: propostaA, p_versao: 1, p_hash: hashDe(propostaA), p_user: null, p_decisao: "aprovada" });
  assert.match(semHumano.error?.message ?? "", /sem_permissao/);
  assert.ok(!FERRAMENTAS_CONECTOR.some((f) => /aprov/.test(f.id)), "não existe ferramenta de aprovar para agente");

  // outra proposta: revisar gera a versão 2 e invalida a 1
  const p3 = await propor(sku(3), { marca: "Sabó" });
  const rev = await db.rpc("agente_proposta_revisar", { p_loja: A, p_proposta: p3, p_user: U1 });
  assert.equal(rev.error, null);
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${p3}'`), "invalidada");
  const antiga = await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: p3, p_versao: 1, p_hash: hashDe(p3), p_user: U1, p_decisao: "aprovada" });
  assert.match(antiga.error?.message ?? "", /proposta_nao_pendente/);

  const ok = await aprovar(propostaA);
  assert.equal(ok.error, null, JSON.stringify(ok));
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${propostaA}'`), "aprovada");
  assert.equal(db.sql(`select user_id from public.agente_aprovacoes where proposta_id = '${propostaA}'`), U1);
});

test("5b. chat e cliente externo nunca executam escrita, nem com tudo aprovado", { skip }, async () => {
  const chat = await despachar("bling.produtos.alterar", { id: "701", corpo: { marca: "X" } }, ctx());
  assert.equal(chat.ok, false); assert.match(chat.erro ?? "", /somente_executor/);
  const mcp = await despachar("bling.produtos.alterar", { id: "701", corpo: { marca: "X" } }, ctx({ origem: "gateway_mcp", escopos: ["leitura", "propor", "simular"] }));
  assert.equal(mcp.ok, false);
  assert.equal(bling.recebidos.length, 0, "nenhuma escrita chegou ao Bling");
  assert.ok(Number(db.sql(`select count(*) from public.agente_chamadas_ferramenta where decisao = 'negada'`)) >= 2, "negativas ficam registradas");
});

// ---------------------------------------------------------------------------------------------------- 6. trava
test("6. produto travado recebe sugestão, mas não pode ser aprovado nem sofrer escrita", { skip }, async () => {
  await db.rpc("produto_travar", { p_loja: A, p_produtos: [db.sql(`select id from public.produtos where sku = '${sku(2)}'`)], p_user: U2, p_motivo: "auditado pelo lojista" });
  const r = await despachar("conecta.proposta.criar", { titulo: "Descrição do TESTE-002", itens: [{ sku: sku(2), operacao: "conecta.enriquecimento.definir", campos: ["descricao_curta"], antes: {}, depois: { descricao_curta: "Sugestão do agente" }, fontes: [{ documento: "catalogo-2026.pdf" }] }] }, ctx());
  assert.equal(r.ok, true, JSON.stringify(r));
  const id = (r.resultado as any).proposta_id;
  assert.equal(db.sql(`select estado from public.agente_proposta_itens where proposta_id = '${id}'`), "travado");
  const tentativa = await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: id, p_versao: 1, p_hash: hashDe(id), p_user: U1, p_decisao: "aprovada" });
  assert.match(tentativa.error?.message ?? "", /nada_aprovavel/);
  assert.equal(db.sql(`select count(*) from public.produto_enriquecimento where produto_id = (select id from public.produtos where sku = '${sku(2)}')`), "0", "sugestão não virou dado");
});

// ---------------------------------------------------------------------------------------------------- 7. execução simulada
test("7. ensaio com mock: Bling simulado recebe só dados válidos e NENHUM estado muda", { skip }, async () => {
  const antesEstado = db.sql(`select estado from public.agente_propostas where id = '${propostaA}'`);
  const rel = await simularProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: propostaA, userId: U1, definicao: sobreescreverBlingAtivo });
  assert.equal(rel.simulado, true); assert.equal(rel.itens.length, 1); assert.equal(rel.itens[0].ok, true, JSON.stringify(rel));
  assert.deepEqual(bling.recebidos[0].corpo, { marca: "Sabó", descricaoCurta: "Cabeçote do motor HR 2.5 16V D4CB" });
  assert.equal(bling.rejeitados.length, 0);
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${propostaA}'`), antesEstado, "ensaio não muda a proposta");
  assert.equal(db.sql(`select estado from public.agente_proposta_itens where proposta_id = '${propostaA}'`), "aprovado", "ensaio não confirma item");
  assert.equal(db.sql(`select count(*) from public.agente_simulacoes where proposta_id = '${propostaA}'`), "1");
  await assert.rejects(simularProposta({ rpc: db.rpc as any, bling: { ...bling, simulado: false } as any, lojaId: A, propostaId: propostaA, userId: U1 }), /porta simulada/);
  bling.recebidos.length = 0; bling.produtos.get("701")!.marca = undefined; delete bling.produtos.get("701")!.descricaoCurta; // desfaz o efeito do ensaio no mock
});

// ---------------------------------------------------------------------------------------------------- 8. escrita real continua bloqueada
test("8a. sem liberação explícita, o banco recusa executar escrita no Bling mesmo aprovada", { skip }, async () => {
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: propostaA, definicao: sobreescreverBlingAtivo });
  assert.match(r.erro ?? "", /escrita_real_nao_liberada/);
  assert.equal(bling.recebidos.length, 0);
});

test("8b. com liberação no banco, o registro (ferramenta desligada) ainda bloqueia: nada chega ao Bling", { skip }, async () => {
  await db.rpc("agente_escrita_liberar", { p_loja: A, p_ferramenta: "bling.produtos.alterar", p_user: U1, p_referencia: "teste de aceitação com Bling simulado" });
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: propostaA });
  assert.equal(r.itens[0].estado, "falhou"); assert.match(r.itens[0].motivo ?? "", /desligada/);
  assert.equal(bling.recebidos.length, 0, "ferramenta desligada no registro: o Bling nunca foi chamado");
});

// ---------------------------------------------------------------------------------------------------- 9. execução com verificação
test("9. execução aprovada (mock liberado): escreve, LÊ DE VOLTA, confirma com evidência e sincroniza o produto", { skip }, async () => {
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: propostaA, definicao: sobreescreverBlingAtivo });
  assert.equal(r.erro, undefined, JSON.stringify(r)); assert.equal(r.itens[0].estado, "confirmada"); assert.equal(r.estado_final, "executada");
  assert.equal(bling.produtos.get("701")!.marca, "Sabó");
  assert.ok(bling.leituras >= 1, "houve leitura de confirmação");
  const ev = db.json(`select evidencia from public.agente_operacoes where proposta_id = '${propostaA}' order by tentativa desc limit 1`);
  assert.equal(ev.leitura.marca, "Sabó");
  assert.equal(db.sql(`select estado from public.produto_travas where produto_id = (select id from public.produtos where sku = '${sku(1)}')`), "sincronizado");
  assert.equal(db.sql(`select estado from public.agente_tarefas where id = (select tarefa_id from public.agente_propostas where id = '${propostaA}')`), "concluida");
  assert.ok(!JSON.stringify(bling.recebidos).match(/precoCusto|fornecedor|tributacao|ncm/), "o Bling recebeu somente campos válidos");
});

test("9b. leitura de confirmação diverge do enviado => falha registrada, produto em divergência (não 'sucesso')", { skip }, async () => {
  const p = await propor(sku(5), { marca: "Sabó" });
  assert.equal((await aprovar(p)).error, null);
  bling.falhas.push("leitura_diverge");
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(r.itens[0].estado, "falhou"); assert.match(r.itens[0].motivo ?? "", /divergência/);
  assert.equal(r.estado_final, "falhou");
  assert.equal(db.sql(`select estado from public.produto_travas where produto_id = (select id from public.produtos where sku = '${sku(5)}')`), "erro_divergencia");
});

// ---------------------------------------------------------------------------------------------------- 10. recuperação sem duplicar
test("10a. timeout que GRAVOU: vira 'desconhecida', não repete às cegas, reconcilia por leitura e conclui sem duplicar", { skip }, async () => {
  const p = await propor(sku(4), { marca: "Sabó" });
  assert.equal((await aprovar(p)).error, null);
  const antes = bling.recebidos.length;
  bling.falhas.push("timeout_gravou");
  const r1 = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(r1.itens[0].estado, "desconhecida");
  assert.equal(bling.recebidos.length - antes, 1, "uma única escrita enviada");
  const r2 = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.match(r2.erro ?? "", /reconciliar_antes/);
  assert.equal(bling.recebidos.length - antes, 1, "nenhuma repetição às cegas");
  const opId = db.sql(`select id from public.agente_operacoes where proposta_id = '${p}' order by tentativa desc limit 1`);
  assert.equal(await reconciliar({ rpc: db.rpc as any, bling, lojaId: A, operacaoId: opId, userId: U1, item: itemDe(p) }), "gravado");
  const r3 = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(r3.estado_final, "executada", JSON.stringify(r3));
  assert.equal(bling.recebidos.length - antes, 1, "ainda uma única escrita: sem duplicar");
  assert.equal(db.sql(`select estado from public.produto_travas where produto_id = (select id from public.produtos where sku = '${sku(4)}')`), "sincronizado");
});

test("10b. timeout que NÃO gravou: reconcilia com prova de que não gravou e retoma com a MESMA chave de idempotência", { skip }, async () => {
  const p = await propor(sku(6), { marca: "Sabó" });
  assert.equal((await aprovar(p)).error, null);
  const antes = bling.recebidos.length;
  bling.falhas.push("timeout_nao_gravou");
  const r1 = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(r1.itens[0].estado, "desconhecida");
  const opId = db.sql(`select id from public.agente_operacoes where proposta_id = '${p}' order by tentativa desc limit 1`);
  assert.equal(await reconciliar({ rpc: db.rpc as any, bling, lojaId: A, operacaoId: opId, userId: U1, item: itemDe(p) }), "nao_gravado");
  const r2 = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(r2.estado_final, "executada", JSON.stringify(r2));
  const novos = bling.recebidos.slice(antes);
  assert.equal(novos.length, 2); assert.equal(novos[0].idem, novos[1].idem, "mesma chave de idempotência nas duas tentativas");
  assert.equal(db.sql(`select max(tentativa) from public.agente_operacoes where proposta_id = '${p}'`), "2");
});

test("10c. parada de emergência: itens restantes não são executados e ficam recuperáveis", { skip }, async () => {
  const p = await propor(sku(7), { marca: "Sabó" });
  assert.equal((await aprovar(p)).error, null);
  const antes = bling.recebidos.length;
  const r = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo, parar: () => true });
  assert.equal(r.itens[0].estado, "falhou"); assert.match(r.itens[0].motivo ?? "", /parada_de_emergencia/);
  assert.equal(bling.recebidos.length, antes);
  const retomada = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: p, definicao: sobreescreverBlingAtivo });
  assert.equal(retomada.estado_final, "executada");
});

// ---------------------------------------------------------------------------------------------------- 11. página comercial válida
test("11. produto completo vira página comercial válida: publicação exige descrição e imagem aprovada; página só com dado aprovado", { skip }, async () => {
  const alvo = sku(3);
  let pronto = await despachar("conecta.publicacao.preparar", { sku: alvo }, ctx());
  assert.equal((pronto.resultado as any).pronto, false); assert.match(JSON.stringify(pronto.resultado), /imagem principal aprovada/);

  // 1) enriquecimento aprovado e executado (camada Conecta.IA)
  const e = await despachar("conecta.proposta.criar", { titulo: "Descrição do TESTE-003", itens: [{ sku: alvo, operacao: "conecta.enriquecimento.definir", campos: ["descricao_curta"], antes: {}, depois: { descricao_curta: "Cabeçote do motor para HR 2.5 16V." }, fontes: [{ url: "https://exemplo.com/catalogo", versao: "2026" }] }] }, ctx());
  const pe = (e.resultado as any).proposta_id as string;
  assert.equal((await aprovar(pe)).error, null);
  const re = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: pe });
  assert.equal(re.estado_final, "executada", JSON.stringify(re));
  assert.equal(db.sql(`select status::text || '|' || (fonte is not null) from public.produto_enriquecimento where campo = 'descricao_curta' and produto_id = (select id from public.produtos where sku = '${alvo}')`), "aprovado|true");

  // 2) imagem real aprovada (a url original de terceiros, quando existir, nunca é servida)
  emitir(`insert into public.produto_imagens (produto_id, loja_id, url, tipo, origem, aprovada, principal, alt_texto) select id, loja_id, 'https://cdn.loja.com/teste-003.jpg', 'real', 'foto própria', true, true, 'Cabeçote HR (cód. TESTE-003)' from public.produtos where sku = '${alvo}'`);
  pronto = await despachar("conecta.publicacao.preparar", { sku: alvo }, ctx());
  assert.equal((pronto.resultado as any).pronto, true, JSON.stringify(pronto.resultado));

  // 3) publicação aprovada e executada
  const pub = await despachar("conecta.proposta.criar", { titulo: "Publicar TESTE-003", itens: [{ sku: alvo, operacao: "conecta.publicacao.publicar", campos: ["publicado"], antes: { publicado: false }, depois: { publicado: true }, fontes: [{ documento: "revisão do lojista" }], risco: "HIGH" }] }, ctx());
  const pp = (pub.resultado as any).proposta_id as string;
  assert.match((await db.rpc("agente_proposta_decidir", { p_loja: A, p_proposta: pp, p_versao: 1, p_hash: hashDe(pp), p_user: U1, p_decisao: "aprovada" })).error?.message ?? "", /confirmacao_explicita_obrigatoria/);
  assert.equal((await aprovar(pp, { p_confirmacao_explicita: true })).error, null);
  const rp = await executarProposta({ rpc: db.rpc as any, bling, lojaId: A, propostaId: pp });
  assert.equal(rp.estado_final, "executada", JSON.stringify(rp));

  // 4) página pública montada SÓ com dados aprovados
  const l = db.json(`select to_jsonb(t) from (select p.sku, p.nome, p.preco, p.estoque, p.publicado, p.situacao, (select valor #>> '{}' from public.produto_enriquecimento e where e.produto_id = p.id and e.campo = 'descricao_curta' and e.status = 'aprovado') descricao,
    (select jsonb_agg(jsonb_build_object('url', i.url, 'principal', i.principal, 'ordem', i.ordem, 'tipo', i.tipo, 'alt_texto', i.alt_texto, 'largura_px', i.largura_px, 'altura_px', i.altura_px, 'fundo_branco', i.fundo_branco)) from public.produto_imagens i where i.produto_id = p.id and i.aprovada and i.removida_em is null) imagens
    from public.produtos p where p.sku = '${alvo}') t`);
  const loja: LojaSeo = { nome: "Loja de teste", slug: "loja-a", ativa: true, dominio: "www.exemplo-teste.com.br", whatsapp: null, politicas: null };
  const prod: ProdutoSeo = { sku: l.sku, nome: l.nome, descricao: l.descricao, descricao_longa: null, marca: null, gtin: null, mpn: null, preco: Number(l.preco), estoque: Number(l.estoque), publicado: l.publicado, situacao: l.situacao, atualizado_em: null, categoria: null, imagens: l.imagens ?? [] };
  const html = paginaProdutoHtml(loja, prod);
  assert.match(html, /<h1>Produto de teste 3<\/h1>/); assert.match(html, /Cabeçote do motor para HR 2\.5 16V\./); assert.match(html, /application\/ld\+json/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.exemplo-teste\.com\.br\//);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
  assert.ok(JSON.stringify(ld).includes("TESTE-003"));
  assert.ok(!html.includes("exemplo.com/catalogo"), "a fonte de pesquisa não aparece na página pública");
  const sitemap = gerarSitemap(loja.dominio, [prod]);
  assert.match(sitemap ?? "", /<loc>https:\/\/www\.exemplo-teste\.com\.br\//);
  const semDominio = gerarSitemap(null, [prod]);
  assert.equal(semDominio, null, "loja sem domínio ativo não gera URL absoluta");
  assert.equal(gerarSitemap(loja.dominio, [{ ...prod, publicado: false }])?.includes("TESTE-003") ?? false, false, "produto despublicado sai do sitemap");
});

// ---------------------------------------------------------------------------------------------------- 12. auditoria
test("12. auditoria completa: cada etapa do ciclo deixou rastro imutável", { skip }, () => {
  const acoes = db.sql(`select string_agg(distinct acao, ',' order by acao) from public.auditoria`);
  for (const a of ["agente.proposta.enviada", "agente.proposta.aprovada", "agente.proposta.revisada", "agente.execucao.iniciada", "agente.execucao.finalizada", "agente.operacao.reconciliada", "agente.simulacao.registrada", "agente.escrita.liberada", "produto.travado"]) {
    assert.ok(acoes.includes(a), `faltou auditar ${a}`);
  }
  assert.ok(Number(db.sql(`select count(*) from public.agente_chamadas_ferramenta where origem = 'chat'`)) >= 10, "chamadas de ferramenta registradas");
  assert.equal(db.sql(`select count(*) from public.agente_operacoes where estado = 'confirmada' and evidencia is null`), "0", "toda confirmação tem evidência");
  assert.equal(db.sql(`select count(*) from public.agente_chamadas_ferramenta where entrada::text ~* '(authorization|token|secret)'`), "0", "log sem segredo");
  assert.throws(() => db.sql(`update public.auditoria set acao = 'x'`), /imutável/);
});
