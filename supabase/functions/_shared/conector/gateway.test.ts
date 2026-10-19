import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarMcp, type ChaveMcp, type PortasGateway } from "./gateway.ts";
import { gerarToken, sha256Hex } from "./cripto.ts";
import { criarPsql } from "./psql_cliente.testutil.ts";
import { dadosSupabase } from "./dados.ts";
import { BlingMock } from "./bling_mock.ts";

const { token } = gerarToken();
const A = "aaaaaaaa-0000-0000-0000-00000000000a", U1 = "11111111-1111-1111-1111-111111111111";
const chaveBase: ChaveMcp = { chave_id: "c0c0c0c0-0000-0000-0000-000000000001", loja_id: A, escopos: ["leitura"], criada_por: U1, nome: "ChatGPT" };

// portas falsas (sem banco) para o protocolo
function portas(chave: ChaveMcp | null, o: { limite?: boolean } = {}): PortasGateway & { chamadas: string[] } {
  const chamadas: string[] = [];
  return { chamadas,
    validarChave: async (h) => { chamadas.push(h); return chave && h === (await sha256Hex(token)) ? chave : null; },
    limite: async () => o.limite ?? true,
    contexto: () => { throw new Error("não deveria montar contexto neste teste"); } };
}
const req = (corpo: unknown, cab: Record<string, string> = { authorization: `Bearer ${token}` }, metodo = "POST") => ({ metodo, cabecalhos: cab, corpo: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
const rpc = (method: string, params?: unknown, id: number | null = 1) => ({ jsonrpc: "2.0", ...(id === null ? {} : { id }), method, params });

test("gateway: sem chave, chave malformada, desconhecida ou com Origin de navegador => recusado", async () => {
  assert.equal((await tratarMcp(req(rpc("ping"), {}), portas(chaveBase))).status, 401);
  assert.equal((await tratarMcp(req(rpc("ping"), { authorization: "Bearer qualquer" }), portas(chaveBase))).status, 401);
  assert.equal((await tratarMcp(req(rpc("ping")), portas(null))).status, 401);
  assert.equal((await tratarMcp(req(rpc("ping"), { authorization: `Bearer ${token}`, origin: "https://site.com" }), portas(chaveBase))).status, 403);
  assert.equal((await tratarMcp(req(rpc("ping"), undefined, "GET"), portas(chaveBase))).status, 405);
  const r = await tratarMcp(req(rpc("ping"), {}), portas(chaveBase));
  assert.match(r.cabecalhos["www-authenticate"] ?? "", /Bearer/);
});

test("gateway: o banco só recebe o HASH da chave, nunca o token", async () => {
  const p = portas(chaveBase);
  await tratarMcp(req(rpc("ping")), p);
  assert.deepEqual(p.chamadas, [await sha256Hex(token)]);
  assert.ok(!p.chamadas.join("").includes(token));
});

test("gateway: limite por chave devolve 429", async () => {
  const r = await tratarMcp(req(rpc("ping")), portas(chaveBase, { limite: false }));
  assert.equal(r.status, 429); assert.ok(r.cabecalhos["retry-after"]);
});

test("gateway: initialize negocia versão, anuncia só 'tools' e instrui a só propor; notificação devolve 202", async () => {
  const r = JSON.parse((await tratarMcp(req(rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "x", version: "1" } })), portas(chaveBase))).corpo);
  assert.equal(r.result.protocolVersion, "2025-03-26"); assert.deepEqual(Object.keys(r.result.capabilities), ["tools"]); assert.match(r.result.instructions, /PROPÕE|propõe|PROPOR|propor/i);
  const antiga = JSON.parse((await tratarMcp(req(rpc("initialize", { protocolVersion: "1999-01-01" })), portas(chaveBase))).corpo);
  assert.equal(antiga.result.protocolVersion, "2025-06-18");
  const n = await tratarMcp(req(rpc("notifications/initialized", undefined, null)), portas(chaveBase));
  assert.equal(n.status, 202);
});

test("gateway: tools/list respeita o escopo da chave e nunca lista execução", async () => {
  const nomes = async (escopos: any[]) => JSON.parse((await tratarMcp(req(rpc("tools/list")), portas({ ...chaveBase, escopos }))).corpo).result.tools.map((t: any) => t.name) as string[];
  const leitura = await nomes(["leitura"]); const propor = await nomes(["leitura", "propor"]);
  assert.ok(leitura.includes("conecta__catalogo__resumo")); assert.ok(!leitura.includes("conecta__proposta__criar"));
  assert.ok(propor.includes("conecta__proposta__criar"));
  for (const lista of [leitura, propor]) {
    assert.ok(lista.every((n) => /^[A-Za-z0-9_-]+$/.test(n)), "nomes aceitos por clientes de LLM");
    assert.ok(!lista.some((n) => /^bling__(produtos|categorias)__(alterar|criar)$|publicar|definir|aprov/.test(n)), "execução/aprovação nunca é listada");
  }
});

test("gateway: protocolo — JSON inválido, lote, método desconhecido e parâmetros inválidos", async () => {
  const p = portas(chaveBase);
  assert.equal(JSON.parse((await tratarMcp(req("{não é json"), p)).corpo).error.code, -32700);
  assert.equal(JSON.parse((await tratarMcp(req([rpc("ping")]), p)).corpo).error.code, -32600);
  assert.equal(JSON.parse((await tratarMcp(req(rpc("resources/list")), p)).corpo).error.code, -32601);
  assert.equal(JSON.parse((await tratarMcp(req(rpc("tools/call", { name: "../../etc" })), p)).corpo).error.code, -32602);
  assert.equal((await tratarMcp(req("x".repeat(100_001)), p)).status, 413);
});

// ---------------------------------------------------------------------------------------------- com banco real (local)
const BANCO = process.env.CONECTOR_TEST_DB;
const skip = BANCO ? false : "defina CONECTOR_TEST_DB";
const db = BANCO ? criarPsql(BANCO) : (null as never);
const L = "bbbbbbbb-0000-0000-0000-00000000000b", L2 = "cccccccc-0000-0000-0000-00000000000c";

test("gateway + banco: ciclo da chave (criar, validar, usar, revogar) e ferramentas reais por cliente externo", { skip }, async () => {
  db.sql(`insert into public.lojas (id, nome, slug) values ('${L}', 'Loja MCP', 'loja-mcp'), ('${L2}', 'Outra loja', 'outra-loja')`);
  db.sql(`insert into public.usuarios_loja values ('${L}', '${U1}', 'lojista')`);
  db.sql(`insert into public.produtos (loja_id, bling_id, sku, nome, preco, situacao) values ('${L}', '801', 'MCP-001', 'Peça da loja MCP', 10, 'A'), ('${L2}', '802', 'OUTRA-001', 'Peça de outra loja', 10, 'A')`);
  const bling = new BlingMock().semear("801", { codigo: "MCP-001", nome: "Peça da loja MCP", preco: 10, situacao: "A" });

  const { token: t, prefixo } = gerarToken();
  const criar = await db.rpc("mcp_chave_criar", { p_loja: L, p_user: U1, p_nome: "ChatGPT conector", p_cliente: "GPT", p_hash: await sha256Hex(t), p_prefixo: prefixo, p_escopos: ["leitura", "propor"], p_expira_em: new Date(Date.now() + 86_400_000).toISOString() });
  assert.equal(criar.error, null, JSON.stringify(criar));
  const p: PortasGateway = {
    validarChave: async (h) => ((await db.rpc("mcp_chave_validar", { p_hash: h })).data as any[] | null)?.[0] ?? null,
    limite: async () => true,
    contexto: (c) => ({ origem: "gateway_mcp", lojaId: c.loja_id, userId: c.criada_por, dados: dadosSupabase(db as any, c.loja_id), rpc: db.rpc as any, admin: db as any, bling, agente: { nome: `Cliente externo: ${c.nome}` } }),
  };
  const chamar = async (name: string, args: unknown, tk = t) => JSON.parse((await tratarMcp(req(rpc("tools/call", { name, arguments: args }), { authorization: `Bearer ${tk}` }), p)).corpo);

  // leitura real do banco, restrita à loja da chave
  const lista = await chamar("conecta__catalogo__listar", {});
  const itens = JSON.parse(lista.result.content[0].text);
  assert.equal(lista.result.isError, false, JSON.stringify(lista)); assert.deepEqual(itens.map((x: any) => x.sku), ["MCP-001"], "a chave só enxerga a própria loja");
  const outra = await chamar("conecta__catalogo__ver", { sku: "OUTRA-001" });
  assert.match(outra.result.content[0].text, /não encontrado/);

  // consulta real (simulada) ao Bling + proposta com fonte pelo cliente externo
  const b = await chamar("bling__produtos__consultar", { sku: "MCP-001" });
  assert.equal(JSON.parse(b.result.content[0].text).produto.codigo, "MCP-001");
  const prop = await chamar("bling__produtos__preparar_atualizacao", { sku: "MCP-001", campos: { marca: "Sabó" }, fontes: [{ url: "https://exemplo.com/f" }] });
  assert.equal(prop.result.isError, false, JSON.stringify(prop));
  const pid = JSON.parse(prop.result.content[0].text).proposta_id;
  assert.equal(db.sql(`select agente from public.agente_propostas where id = '${pid}'`), "Cliente externo: ChatGPT conector");
  assert.equal(db.sql(`select estado from public.agente_propostas where id = '${pid}'`), "pendente", "proposta não está aprovada: cliente externo não aprova");

  // execução e aprovação não existem para o cliente externo
  const exec = await chamar("bling__produtos__alterar", { id: "801", corpo: { marca: "X" } });
  assert.equal(exec.result.isError, true); assert.match(exec.result.content[0].text, /somente_executor|escopo/);
  assert.equal(bling.recebidos.length, 0);

  // auditoria: origem gateway_mcp com a chave registrada
  assert.ok(Number(db.sql(`select count(*) from public.agente_chamadas_ferramenta where origem = 'gateway_mcp' and mcp_chave_id is not null`)) >= 4);

  // revogar corta o acesso na hora
  const chaveId = db.sql(`select id from public.loja_mcp_chaves where loja_id = '${L}' limit 1`);
  assert.equal((await db.rpc("mcp_chave_revogar", { p_loja: L, p_chave: chaveId, p_user: U1 })).data, true);
  const depois = await tratarMcp(req(rpc("ping"), { authorization: `Bearer ${t}` }), p);
  assert.equal(depois.status, 401);
});
