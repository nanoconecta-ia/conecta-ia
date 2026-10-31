import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aleatorioB64u, codigoDaUrl, codigoVerificacao, iguais, montarUrlPareamento, SEGREDO_RE, separarToken, sha256Hex } from "./cripto.ts";
import { ESCOPOS, escoposValidos, ROTULOS } from "./escopos.ts";
import { tratarPair, type PortasPair } from "./servico.ts";
import { FERRAMENTAS, MAX_SAIDA, tratar, urlHttps, type Dados, type EventoAuditoria, type Portas, type PropostaAprovacao, type Sessao } from "./gateway.ts";
import { dadosSupabase } from "./gateway_dados.ts";

// ------------------------------------------------------------------------------------------------ cripto / QR
test("cripto: aleatório de 256 bits, único e no formato aceito", () => {
  const a = aleatorioB64u(), b = aleatorioB64u();
  assert.notEqual(a, b);
  assert.match(a, SEGREDO_RE);
  assert.equal(a.length, 43);
});
test("cripto: SHA-256 bate com o vetor conhecido", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("cripto: código de verificação tem 6 dígitos e cobre a faixa (sem viés grosseiro)", () => {
  const vistos = new Set<string>(); let primeiroDigito = 0;
  for (let i = 0; i < 3000; i++) { const c = codigoVerificacao(); assert.match(c, /^\d{6}$/); vistos.add(c); if (c[0] === "0") primeiroDigito++; }
  assert.ok(vistos.size > 2900, "praticamente sem repetição em 3000 amostras");
  assert.ok(primeiroDigito > 200 && primeiroDigito < 400, `~10% começam com 0 (veio ${primeiroDigito})`);
});
test("cripto: comparação em tempo constante", () => { assert.ok(iguais("abc", "abc")); assert.ok(!iguais("abc", "abd")); assert.ok(!iguais("abc", "ab")); });

test("QR: leva só a URL com o código de uso único — nenhum token, segredo, hash ou credencial", async () => {
  const codigo = aleatorioB64u();
  const url = montarUrlPareamento("https://nanoconecta-ia.github.io/conecta-ia/", codigo);
  assert.equal(url, `https://nanoconecta-ia.github.io/conecta-ia/#/parear?c=${codigo}`);
  assert.equal(codigoDaUrl(url), codigo);
  assert.doesNotMatch(url, /token|segredo|senha|secret|bearer|service_role|bling/i);
  assert.ok(url.length < 200, "URL curta: QR simples e legível");
});
test("QR: recusa APP_URL insegura ou com credenciais/query e código fora do formato", () => {
  const c = aleatorioB64u();
  assert.throws(() => montarUrlPareamento("http://exemplo.com", c));
  assert.throws(() => montarUrlPareamento("https://user:pass@exemplo.com", c));
  assert.throws(() => montarUrlPareamento("https://exemplo.com/?t=1", c));
  assert.throws(() => montarUrlPareamento("https://exemplo.com", "curto"));
  assert.ok(montarUrlPareamento("http://localhost:5173", c).startsWith("http://localhost:5173/#/parear?c="));
  assert.equal(codigoDaUrl("https://x.com/#/parear?c=curto"), null);
  assert.equal(codigoDaUrl(`https://x.com/#/parear?c=${c}&token=abc`), null);
});

// ------------------------------------------------------------------------------------------------ escopos
test("escopos: mesma lista da migração (private.pair_escopos_validos) e nenhum aprova/executa/administra", () => {
  const sql = readFileSync(new URL("../../../migrations/20261018230659_pair_consulta_bling.sql", import.meta.url), "utf8");
  const bloco = /pair_escopos_validos\(\) returns text\[\][\s\S]*?array\[([\s\S]*?)\];/.exec(sql)![1];
  const daMigracao = [...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...ESCOPOS].sort(), daMigracao.sort());
  for (const e of ESCOPOS) { assert.doesNotMatch(e, /aprovar|executar|admin/); assert.ok(ROTULOS[e], `rótulo de ${e}`); }
});
test("escopos: validação recusa vazio, repetido, desconhecido e não-lista", () => {
  assert.ok(escoposValidos(["produtos:ler"]));
  assert.ok(!escoposValidos([])); assert.ok(!escoposValidos(["produtos:ler", "produtos:ler"]));
  assert.ok(!escoposValidos(["aprovacoes:aprovar"])); assert.ok(!escoposValidos("produtos:ler")); assert.ok(!escoposValidos(null));
});

// ------------------------------------------------------------------------------------------------ serviço do solicitante
function portasPair(opcoes: { limite?: boolean; rpc?: (fn: string, a: Record<string, unknown>) => { data: unknown; error: { code?: string } | null } } = {}) {
  const chamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const p: PortasPair = {
    appUrl: "https://painel.exemplo.com.br/conecta",
    rpc: async (fn, args) => { chamadas.push({ fn, args }); return (opcoes.rpc ?? (() => ({ data: { id: "d1", expira_em: "2026-10-18T12:02:00Z" }, error: null })))(fn, args); },
    limite: async () => opcoes.limite ?? true,
  };
  return { p, chamadas };
}
const corpoIniciar = async (extra: Record<string, unknown> = {}) => JSON.stringify({ acao: "iniciar", nome: "Notebook da loja", tipo: "navegador", escopos: ["produtos:ler"], token_hash: await sha256Hex("TOKEN-DO-DISPOSITIVO"), ...extra });

test("pair/iniciar: devolve código, URL de QR, verificação e segredo; ao banco vão SÓ hashes", async () => {
  const { p, chamadas } = portasPair();
  const r = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar(), ip: "1.2.3.4" }, p);
  assert.equal(r.status, 200);
  const b = r.corpo as Record<string, string>;
  assert.match(b.codigo, SEGREDO_RE); assert.match(b.segredo, SEGREDO_RE); assert.match(b.verificacao, /^\d{6}$/);
  assert.equal(b.url, `https://painel.exemplo.com.br/conecta/#/parear?c=${b.codigo}`);
  assert.notEqual(b.codigo, b.segredo, "QR e segredo de consulta são valores diferentes");
  const args = JSON.stringify(chamadas[0].args);
  for (const secreto of [b.codigo, b.segredo, b.verificacao]) assert.ok(!args.includes(secreto), "valor em claro não vai ao banco");
  assert.equal(chamadas[0].args.p_codigo_hash, await sha256Hex(b.codigo));
  assert.equal(chamadas[0].args.p_ttl_s, 120);
  assert.ok(!JSON.stringify(b).includes("TOKEN-DO-DISPOSITIVO"));
});
test("pair/iniciar: entradas inválidas são recusadas antes de tocar o banco", async () => {
  const { p, chamadas } = portasPair();
  const casos: Record<string, unknown>[] = [
    { nome: "" }, { nome: "x".repeat(81) }, { nome: "<script>" }, { tipo: "root" }, { escopos: ["aprovacoes:aprovar"] }, { escopos: [] },
    { duracao_min: 4 }, { duracao_min: 9999 }, { duracao_min: 1.5 }, { token_hash: "abc" }, { capacidades: ["teclado.digitar"] },
  ];
  for (const extra of casos) { const r = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar(extra) }, p); assert.equal(r.status, 400, JSON.stringify(extra)); }
  assert.equal(chamadas.length, 0);
  assert.equal((await tratarPair({ metodo: "GET", authorization: null, corpo: "" }, p)).status, 405);
  assert.equal((await tratarPair({ metodo: "POST", authorization: null, corpo: "{" }, p)).status, 400);
  assert.equal((await tratarPair({ metodo: "POST", authorization: null, corpo: "x".repeat(9000) }, p)).status, 413);
});
test("pair/iniciar: agente desktop pode pedir capacidades; nenhum outro tipo", async () => {
  const { p } = portasPair();
  const ok = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar({ tipo: "agente_desktop", capacidades: ["janela.listar"] }) }, p);
  assert.equal(ok.status, 200);
});
test("pair/iniciar: limite de taxa por IP", async () => {
  const { p, chamadas } = portasPair({ limite: false });
  const r = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar(), ip: "9.9.9.9" }, p);
  assert.equal(r.status, 429); assert.equal(chamadas.length, 0);
});
test("pair/iniciar: token já usado => 409 sem vazar detalhe do banco", async () => {
  const { p } = portasPair({ rpc: () => ({ data: null, error: { code: "23505" } }) });
  const r = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar() }, p);
  assert.equal(r.status, 409);
});
test("pair/consultar: exige código e segredo válidos; resposta não carrega token nem hash", async () => {
  const { p, chamadas } = portasPair({ rpc: () => ({ data: { estado: "pendente" }, error: null }) });
  assert.equal((await tratarPair({ metodo: "POST", authorization: null, corpo: JSON.stringify({ acao: "consultar", codigo: "x", segredo: "y" }) }, p)).status, 400);
  const codigo = aleatorioB64u(), segredo = aleatorioB64u();
  const r = await tratarPair({ metodo: "POST", authorization: null, corpo: JSON.stringify({ acao: "consultar", codigo, segredo }) }, p);
  assert.equal(r.status, 200);
  assert.equal(chamadas[0].args.p_codigo_hash, await sha256Hex(codigo));
  assert.equal(chamadas[0].args.p_segredo_hash, await sha256Hex(segredo));
});
test("pair/renovar e encerrar: exigem Bearer no formato; token inválido => 401", async () => {
  const { p } = portasPair({ rpc: () => ({ data: { ok: false }, error: null }) });
  const novo = await sha256Hex("novo");
  assert.equal((await tratarPair({ metodo: "POST", authorization: null, corpo: JSON.stringify({ acao: "renovar", novo_token_hash: novo }) }, p)).status, 400);
  assert.equal((await tratarPair({ metodo: "POST", authorization: `Bearer ${aleatorioB64u()}.${aleatorioB64u()}`, corpo: JSON.stringify({ acao: "renovar", novo_token_hash: novo }) }, p)).status, 401);
  // token SEM a 2ª metade (sal) nem chega ao banco
  assert.equal((await tratarPair({ metodo: "POST", authorization: `Bearer ${aleatorioB64u()}`, corpo: JSON.stringify({ acao: "renovar", novo_token_hash: novo }) }, p)).status, 400);
  assert.equal((await tratarPair({ metodo: "POST", authorization: null, corpo: JSON.stringify({ acao: "encerrar" }) }, p)).status, 401);
});

// ------------------------------------------------------------------------------------------------ gateway MCP
const LOJA_A = "aaaaaaaa-0000-0000-0000-000000000001", LOJA_B = "bbbbbbbb-0000-0000-0000-000000000002";
const sessao = (escopos: string[], extra: Partial<Sessao> = {}): Sessao => ({
  sessao_id: "s-1", loja_id: LOJA_A, usuario_id: "u-1", dispositivo_id: "dev-1", nome: "Agente de testes", tipo: "agente_externo", escopos, capacidades: [], ...extra,
});

function ambiente(s: Sessao | null, opcoes: { limite?: (c: string) => boolean; dados?: Partial<Dados> } = {}) {
  const auditoria: EventoAuditoria[] = [];
  const chamadasDados: { metodo: string; loja: string; args: unknown }[] = [];
  const propostas: PropostaAprovacao[] = [];
  const dados: Dados = {
    listarProdutos: async (loja, f) => { chamadasDados.push({ metodo: "listarProdutos", loja, args: f }); return [{ nome: "Pastilha", sku: "P1" }]; },
    consultarProdutoBling: async (s, sku) => { chamadasDados.push({ metodo: "consultarProdutoBling", loja: s.loja_id, args: sku }); return { origem: "api_bling", simulado: true, dados: { sku } }; },
    obterProduto: async (loja, sku) => { chamadasDados.push({ metodo: "obterProduto", loja, args: sku }); return sku === "P1" ? { nome: "Pastilha", sku } : null; },
    skuParaId: async (loja, sku) => { chamadasDados.push({ metodo: "skuParaId", loja, args: sku }); return sku === "P1" ? "id-p1" : null; },
    proporEnriquecimento: async (loja, a) => { chamadasDados.push({ metodo: "proporEnriquecimento", loja, args: a }); return { ok: true, status: "a_confirmar" }; },
    consultarPeca: async (loja, termo) => { chamadasDados.push({ metodo: "consultarPeca", loja, args: termo }); return { produtos_da_loja: [] }; },
    proporCodigo: async (loja, a) => { chamadasDados.push({ metodo: "proporCodigo", loja, args: a }); return { ok: true, status: "a_confirmar" }; },
    proporAplicacao: async (loja, a) => { chamadasDados.push({ metodo: "proporAplicacao", loja, args: a }); return { ok: true, status: "a_confirmar" }; },
    proporImagem: async (loja, a) => { chamadasDados.push({ metodo: "proporImagem", loja, args: a }); return { ok: true, status: "a_confirmar" }; },
    proporBula: async (loja, a) => { chamadasDados.push({ metodo: "proporBula", loja, args: a }); return { ok: true, status: "rascunho" }; },
    proporAprovacao: async (p) => { propostas.push(p); return { id: "ap-1", versao: 1, hash_proposta: "h".repeat(64), estado: "pendente" }; },
    aprovacoesPendentes: async (loja, l) => { chamadasDados.push({ metodo: "aprovacoesPendentes", loja, args: l }); return []; },
    statusTarefa: async (loja, id) => { chamadasDados.push({ metodo: "statusTarefa", loja, args: id }); return null; },
    camposAprovados: async (loja, sku) => { chamadasDados.push({ metodo: "camposAprovados", loja, args: sku }); return sku === "P1" ? { sku, campos: [{ id: "e1", campo: "marca_peca", valor: "Cobreq", fonte: "https://fab.exemplo", aprovado_em: "2026-10-30T00:00:00Z" }] } : null; },
    ...opcoes.dados,
  };
  const validadas: [string, string][] = [];
  const portas: Portas = {
    validar: async (h, sal) => { validadas.push([h, sal]); return s; },
    limite: async (c) => opcoes.limite?.(c) ?? true,
    auditar: async (e) => { auditoria.push(e); },
    dados,
  };
  return { portas, auditoria, chamadasDados, propostas, validadas };
}
const TOKEN_PARTE = aleatorioB64u(), SAL = aleatorioB64u();
const TOKEN = `${TOKEN_PARTE}.${SAL}`; // token completo = <token>.<sal>
const rpc = (method: string, params?: unknown, id: number | string | undefined = 1) => JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params });
const chamar = (a: ReturnType<typeof ambiente>, corpo: string, extra: { auth?: string | null; metodo?: string; ip?: string } = {}) =>
  tratar({ metodo: extra.metodo ?? "POST", authorization: extra.auth === undefined ? `Bearer ${TOKEN}` : extra.auth, corpo, ip: extra.ip ?? "5.5.5.5" }, a.portas);
const tool = (nome: string, args?: unknown) => rpc("tools/call", { name: nome, arguments: args });
const resultado = (r: { corpo?: unknown }) => (r.corpo as { result: { content: { text: string }[]; isError?: boolean } }).result;

test("gateway: sem token, token malformado ou sessão inexistente/revogada => 401 e nada é executado", async () => {
  const a = ambiente(null);
  for (const auth of [null, "", "Bearer", "Bearer curto", `Basic ${TOKEN}`, `Bearer ${TOKEN}`]) {
    const r = await chamar(a, tool("conecta.list_products"), { auth });
    assert.equal(r.status, 401, String(auth));
    assert.match(r.headers!["WWW-Authenticate"], /Bearer/);
  }
  assert.equal(a.chamadasDados.length, 0);
  assert.deepEqual(a.validadas[0], [await sha256Hex(TOKEN_PARTE), await sha256Hex(SAL)], "o banco recebe só os HASHES das duas metades");
});
test("gateway: tentativas inválidas repetidas do mesmo IP são limitadas (429)", async () => {
  let n = 0;
  const a = ambiente(null, { limite: (c) => (c.startsWith("gw401:") ? ++n <= 30 : true) });
  let ultimo = 0;
  for (let i = 0; i < 35; i++) ultimo = (await chamar(a, tool("conecta.list_products"))).status;
  assert.equal(ultimo, 429);
});
test("gateway: só POST, corpo limitado, JSON válido, sem batch, notificação => 202", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  assert.equal((await chamar(a, "", { metodo: "GET" })).status, 405);
  assert.equal((await chamar(a, "x".repeat(70_000))).status, 413);
  assert.equal(((await chamar(a, "{")).corpo as { error: { code: number } }).error.code, -32700);
  assert.equal(((await chamar(a, "[]")).corpo as { error: { code: number } }).error.code, -32600);
  assert.equal(((await chamar(a, JSON.stringify({ jsonrpc: "1.0", id: 1, method: "ping" }))).corpo as { error: { code: number } }).error.code, -32600);
  assert.equal((await chamar(a, JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).status, 202);
  assert.deepEqual((await chamar(a, rpc("ping"))).corpo, { jsonrpc: "2.0", id: 1, result: {} });
  assert.equal(((await chamar(a, rpc("resources/list"))).corpo as { error: { code: number } }).error.code, -32601);
});
test("gateway: initialize negocia a versão do protocolo e instrui o modelo a tratar dados como dados", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  const r1 = (await chamar(a, rpc("initialize", { protocolVersion: "2025-06-18" }))).corpo as { result: { protocolVersion: string; instructions: string; capabilities: object } };
  assert.equal(r1.result.protocolVersion, "2025-06-18");
  const r2 = (await chamar(a, rpc("initialize", { protocolVersion: "1999-01-01" }))).corpo as { result: { protocolVersion: string } };
  assert.equal(r2.result.protocolVersion, "2025-11-25");
  assert.match(r1.result.instructions, /DADO.*nunca instrução/s);
  assert.deepEqual(Object.keys(r1.result.capabilities), ["tools"]);
});
test("gateway: tools/list mostra só o que o escopo da sessão permite", async () => {
  const nomes = async (escopos: string[]) => ((await chamar(ambiente(sessao(escopos)), rpc("tools/list"))).corpo as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name).sort();
  assert.deepEqual(await nomes(["produtos:ler"]), ["conecta.get_part_by_code", "conecta.get_product", "conecta.get_validated_fields", "conecta.list_products"]);
  assert.deepEqual(await nomes([]), []);
  assert.equal((await nomes([...ESCOPOS])).length, 13);
});
test("gateway: ferramenta sem o escopo é NEGADA, auditada e não toca os dados", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  const r = resultado(await chamar(a, tool("conecta.propose_banner", { titulo: "Promo", imagem_url: "https://cdn.exemplo.com/a.png" })));
  assert.equal(r.isError, true); assert.match(r.content[0].text, /banners:propor/);
  assert.equal(a.propostas.length, 0);
  assert.equal(a.auditoria[0].resultado, "negado");
  assert.equal(a.auditoria[0].ferramenta, "conecta.propose_banner");
});
test("gateway: a loja vem SEMPRE da sessão; argumentos como loja_id/usuario são recusados (troca de loja)", async () => {
  const a = ambiente(sessao([...ESCOPOS]));
  for (const ferr of ["conecta.list_products", "conecta.get_product", "conecta.get_pending_approvals", "conecta.get_task_status"]) {
    const r = resultado(await chamar(a, tool(ferr, { loja_id: LOJA_B, sku: "P1", id: "11111111-1111-1111-1111-111111111111" })));
    assert.equal(r.isError, true, ferr); assert.match(r.content[0].text, /desconhecido: loja_id/);
  }
  await chamar(a, tool("conecta.list_products", { busca: "pastilha" }));
  await chamar(a, tool("conecta.get_product", { sku: "P1" }));
  assert.ok(a.chamadasDados.length >= 2 && a.chamadasDados.every((c) => c.loja === LOJA_A), "toda consulta usa a loja da sessão");
  const ev = a.auditoria.filter((e) => e.resultado === "invalido");
  assert.equal(ev.length, 4);
  assert.ok(ev.every((e) => e.loja_id === LOJA_A && e.usuario_id === "u-1" && e.sessao_id === "s-1" && e.dispositivo_id === "dev-1"), "auditoria carrega usuário, loja, sessão e dispositivo");
});
test("gateway: validação de argumentos (tipos, limites, https, datas, uuid)", async () => {
  const a = ambiente(sessao([...ESCOPOS]));
  const erro = async (nome: string, args: unknown) => resultado(await chamar(a, tool(nome, args))).isError === true;
  assert.ok(await erro("conecta.list_products", { limite: 99 }));
  assert.ok(await erro("conecta.list_products", { limite: "5" }));
  assert.ok(await erro("conecta.list_products", { busca: "x".repeat(81) }));
  assert.ok(await erro("conecta.list_products", "texto"));
  assert.ok(await erro("conecta.get_product", {}));
  assert.ok(await erro("conecta.get_product", { sku: "a\u0000b" }));
  assert.ok(await erro("conecta.get_task_status", { id: "nao-uuid" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "http://inseguro.com/a.png" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "https://localhost/a.png" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "https://10.0.0.1/a.png" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "https://user:pw@cdn.exemplo.com/a.png" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "javascript:alert(1)" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "https://cdn.exemplo.com/a.png", inicio: "2026-02-01T00:00:00Z", fim: "2026-01-01T00:00:00Z" }));
  assert.ok(await erro("conecta.propose_banner", { titulo: "T", imagem_url: "https://cdn.exemplo.com/a.png", link_sku: "NAO-EXISTE" }));
  assert.ok(await erro("conecta.propose_enrichment", { sku: "P1", campo: "marca_peca", valor: "X" }));            // falta fonte
  assert.ok(await erro("conecta.propose_enrichment", { sku: "P1", campo: "marca_peca", valor: "X", fonte: "f", confianca: 2 }));
  assert.equal(a.propostas.length, 0);
  assert.ok(urlHttps("https://cdn.exemplo.com/a.png?w=800") && !urlHttps("ftp://x.com/a"));
});
test("gateway: propose_banner NÃO publica — cria pedido de aprovação MEDIUM ligado à sessão, usuário e dispositivo", async () => {
  const a = ambiente(sessao(["banners:propor"]));
  const r = resultado(await chamar(a, tool("conecta.propose_banner", { titulo: "Promo de freios", imagem_url: "https://cdn.exemplo.com/a.png?w=800" })));
  assert.equal(r.isError, undefined);
  assert.match(r.content[0].text, /hash_proposta/);
  const p = a.propostas[0];
  assert.equal(p.tipo, "banner_publicacao"); assert.equal(p.risco, "MEDIUM"); assert.equal(p.loja_id, LOJA_A);
  assert.equal(p.sessao_id, "s-1"); assert.equal(p.dispositivo_id, "dev-1"); assert.equal(p.usuario_id, "u-1"); assert.equal(p.agente, "Agente de testes");
  assert.equal(p.antes, null); assert.ok(p.riscos.some((x) => /direitos/.test(x)));
  assert.match(p.idempotency_key, /^auto:[0-9a-f]{40}$/);
  assert.equal(a.auditoria.at(-1)!.resultado, "ok");
});
test("gateway: solicitação duplicada gera a MESMA chave de idempotência; conteúdo diferente, chave diferente", async () => {
  const a = ambiente(sessao(["banners:propor"]));
  const args = { titulo: "Promo", imagem_url: "https://cdn.exemplo.com/a.png" };
  await chamar(a, tool("conecta.propose_banner", args));
  await chamar(a, tool("conecta.propose_banner", { imagem_url: args.imagem_url, titulo: args.titulo })); // ordem das chaves não importa
  await chamar(a, tool("conecta.propose_banner", { ...args, titulo: "Outra" }));
  await chamar(a, tool("conecta.propose_banner", { ...args, idempotency_key: "minha-chave-123" }));
  assert.equal(a.propostas[0].idempotency_key, a.propostas[1].idempotency_key);
  assert.notEqual(a.propostas[0].idempotency_key, a.propostas[2].idempotency_key);
  assert.equal(a.propostas[3].idempotency_key, "minha-chave-123");
  const b = ambiente(sessao(["banners:propor"], { sessao_id: "s-2" }));
  await chamar(b, tool("conecta.propose_banner", args));
  assert.notEqual(b.propostas[0].idempotency_key, a.propostas[0].idempotency_key, "a chave automática é por sessão");
});
test("gateway: link_sku vira alvo resolvido NA LOJA da sessão; versao_de gera nova versão", async () => {
  const a = ambiente(sessao(["banners:propor"]));
  await chamar(a, tool("conecta.propose_banner", { titulo: "T", imagem_url: "https://cdn.exemplo.com/a.png", link_sku: "P1", versao_de: "11111111-1111-1111-1111-111111111111" }));
  assert.deepEqual(a.propostas[0].alvos, [{ tabela: "banners" }, { tabela: "produtos", id: "id-p1", sku: "P1" }]);
  assert.equal(a.propostas[0].grupo, "11111111-1111-1111-1111-111111111111");
  assert.equal(a.chamadasDados.find((c) => c.metodo === "skuParaId")!.loja, LOJA_A);
});
test("gateway: propose_enrichment reaproveita o fluxo existente (a_confirmar) na loja da sessão", async () => {
  const a = ambiente(sessao(["enriquecimento:propor"]));
  const r = resultado(await chamar(a, tool("conecta.propose_enrichment", { sku: "P1", campo: "marca_peca", valor: "Sabó", fonte: "https://catalogo.exemplo.com/p1", confianca: 0.8 })));
  assert.match(r.content[0].text, /a_confirmar/);
  assert.equal(a.chamadasDados[0].loja, LOJA_A);
});
test("gateway: erro interno vira mensagem genérica (sem SQL, credencial ou stack) e é auditado", async () => {
  const a = ambiente(sessao(["produtos:ler"]), { dados: { listarProdutos: async () => { throw new Error("select * from private.bling_credenciais -- SERVICE_ROLE_KEY=eyJ..."); } } });
  const r = resultado(await chamar(a, tool("conecta.list_products")));
  assert.equal(r.isError, true);
  assert.doesNotMatch(r.content[0].text, /select|private|SERVICE_ROLE|eyJ/i);
  assert.equal(a.auditoria[0].resultado, "erro"); assert.equal(a.auditoria[0].detalhe, "falha interna");
});
test("gateway: saída grande é cortada; ferramenta desconhecida é erro de protocolo", async () => {
  const a = ambiente(sessao(["produtos:ler"]), { dados: { listarProdutos: async () => [{ nome: "x".repeat(MAX_SAIDA * 2) }] } });
  assert.ok(resultado(await chamar(a, tool("conecta.list_products"))).content[0].text.length <= MAX_SAIDA + 20);
  assert.equal(((await chamar(a, tool("conecta.drop_everything"))).corpo as { error: { code: number } }).error.code, -32602);
});
test("gateway: limite por sessão (429) e chamadas concorrentes não furam a verificação", async () => {
  let n = 0;
  const a = ambiente(sessao(["produtos:ler"]), { limite: (c) => (c.startsWith("gw:") ? ++n <= 10 : true) });
  const rs = await Promise.all(Array.from({ length: 25 }, () => chamar(a, tool("conecta.list_products"))));
  assert.equal(rs.filter((r) => r.status === 200).length, 10);
  assert.equal(rs.filter((r) => r.status === 429).length, 15);
});
test("gateway: cada chamada revalida a sessão no banco (revogação vale na próxima chamada)", async () => {
  let viva = true;
  const a = ambiente(sessao(["produtos:ler"]));
  a.portas.validar = async () => (viva ? sessao(["produtos:ler"]) : null);
  assert.equal((await chamar(a, tool("conecta.list_products"))).status, 200);
  viva = false;
  assert.equal((await chamar(a, tool("conecta.list_products"))).status, 401);
});
test("gateway: o catálogo NÃO tem ferramenta que aprove, execute, publique, altere preço/estoque ou grave no Bling", () => {
  for (const f of FERRAMENTAS) {
    assert.match(f.nome, /^conecta\.(list_|get_|propose_|bling_consultar_produto$)/, f.nome);
    // regra do sistema: o agente nunca apaga nota fiscal nem o cadastro espelhado do Bling; não existe ferramenta nem escopo para isso
    assert.doesNotMatch(f.nome + " " + f.escopo, /delete|remove|destroy|excluir|apagar|nfe|nota|invoice|emit|cancel/i, f.nome);
    assert.equal(f.inputSchema.type, "object");
    assert.doesNotMatch(f.nome + f.descricao.split(".")[0], /approve|execute|publish|delete|price|stock/i, f.nome);
    assert.ok(ESCOPOS.includes(f.escopo), f.nome);
    assert.equal(f.somenteLeitura, !f.nome.includes("propose_"), `${f.nome}: leitura x proposta`);
    assert.equal(JSON.stringify(f.inputSchema).includes("loja_id"), false, `${f.nome} não aceita loja`);
    assert.equal((f.inputSchema as { additionalProperties: boolean }).additionalProperties, false);
  }
});

test("token em duas metades: separarToken exige <token>.<sal> no formato; aceita só o que o servidor entrega", () => {
  const t = aleatorioB64u(), sal = aleatorioB64u();
  assert.deepEqual(separarToken(`${t}.${sal}`), { token: t, sal });
  for (const ruim of [t, `${t}.`, `.${sal}`, `${t}.${sal}.x`, "curto.curto", "", null, undefined, `${t} .${sal}`]) assert.equal(separarToken(ruim as string), null, String(ruim));
});
test("gateway: só a 1ª metade do token (token fraco/vazado) é 401 e NÃO chega ao banco", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  const fraco = "A".repeat(43);
  assert.equal((await chamar(a, tool("conecta.list_products"), { auth: `Bearer ${fraco}` })).status, 401);
  assert.equal(a.validadas.length, 0, "sem as duas metades nem consulta o banco");
  assert.equal((await chamar(a, tool("conecta.list_products"), { auth: `Bearer ${fraco}.${SAL}` })).status, 200, "com sal do servidor autentica (o banco decide)");
});
test("pair/iniciar: gera o SAL no servidor (256 bits, único, só o hash vai ao banco) e o devolve uma vez", async () => {
  const { p, chamadas } = portasPair();
  const r1 = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar(), ip: "1.1.1.1" }, p);
  const r2 = await tratarPair({ metodo: "POST", authorization: null, corpo: await corpoIniciar({ token_hash: await sha256Hex("OUTRO") }), ip: "1.1.1.1" }, p);
  const a = r1.corpo as Record<string, string>, b = r2.corpo as Record<string, string>;
  assert.match(a.sal, SEGREDO_RE); assert.notEqual(a.sal, b.sal); assert.notEqual(a.sal, a.segredo); assert.notEqual(a.sal, a.codigo);
  assert.equal(a.token_formato, "<token>.<sal>");
  assert.equal(chamadas[0].args.p_sal_hash, await sha256Hex(a.sal));
  assert.ok(!JSON.stringify(chamadas[0].args).includes(a.sal), "o sal em claro não vai ao banco");
});
test("dadosSupabase: erro de teto de propostas (54000) vira mensagem útil para o agente", async () => {
  const { admin } = adminFalso();
  const d = dadosSupabase({ ...admin, rpc: async () => ({ data: null, error: { code: "54000", message: "limite" } }) } as never);
  const base: PropostaAprovacao = { loja_id: LOJA_A, usuario_id: "u", sessao_id: "s", dispositivo_id: "d", agente: "A", tipo: "banner_publicacao", ferramenta: "conecta.propose_banner",
    alvos: [], antes: null, depois: {}, riscos: [], risco: "MEDIUM", idempotency_key: "k".repeat(10), ttl_min: 60 };
  assert.match(JSON.stringify(await d.proporAprovacao(base)), /pendentes demais/);
});

// ------------------------------------------------------------------------------------------------ isolamento por loja nas consultas reais
function adminFalso() {
  const log: { tabela?: string; rpc?: string; filtros: [string, ...unknown[]][] }[] = [];
  const builder = (tabela: string) => {
    const reg = { tabela, filtros: [] as [string, ...unknown[]][] }; log.push(reg);
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gt", "or", "order", "limit", "in"]) b[m] = (...a: unknown[]) => { reg.filtros.push([m, ...a]); return b; };
    b.maybeSingle = async () => ({ data: tabela === "produtos" ? { id: "id-1", nome: "Pastilha", sku: "P1", preco: 10, marca: "X", gtin: null, descricao_curta: null, peso_kg: null } : null });
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], count: 0 }).then(ok);
    return b;
  };
  return { log, admin: { from: builder, rpc: async (fn: string, args: Record<string, unknown>) => { log.push({ rpc: fn, filtros: [["args", args]] }); return { data: { ok: true }, error: null }; } } };
}
test("dadosSupabase: TODA leitura filtra por loja_id da sessão e usa só colunas da lista fechada", async () => {
  const { log, admin } = adminFalso();
  const d = dadosSupabase(admin as never);
  await d.listarProdutos(LOJA_A, { busca: "pas%tilha,(x)", apenasPublicados: true, limite: 5 });
  await d.obterProduto(LOJA_A, "P1"); await d.skuParaId(LOJA_A, "P1"); await d.aprovacoesPendentes(LOJA_A, 5); await d.statusTarefa(LOJA_A, "11111111-1111-1111-1111-111111111111");
  const consultas = log.filter((l) => l.tabela);
  assert.ok(consultas.length >= 6);
  for (const c of consultas) assert.ok(c.filtros.some(([m, col, val]) => m === "eq" && col === "loja_id" && val === LOJA_A), `${c.tabela} sem filtro de loja`);
  const colunas = JSON.stringify(consultas.flatMap((c) => c.filtros.filter(([m]) => m === "select")));
  assert.doesNotMatch(colunas, /custo|fornec|bling_id|campos_customizados|embalagem/);
  const ou = consultas[0].filtros.find(([m]) => m === "or")![1] as string;
  assert.equal(ou, "nome.ilike.%pas tilha  x%,sku.ilike.%pas tilha  x%", "busca sanitizada: sem %, vírgula, parênteses, asterisco nem barra do usuário");
});
test("dadosSupabase: proposta usa a RPC com loja, sessão e dispositivo; conflito de chave vira mensagem útil, outro erro vira exceção genérica", async () => {
  const { log, admin } = adminFalso();
  const d = dadosSupabase(admin as never);
  const base: PropostaAprovacao = { loja_id: LOJA_A, usuario_id: "u", sessao_id: "s", dispositivo_id: "d", agente: "A", tipo: "banner_publicacao", ferramenta: "conecta.propose_banner",
    alvos: [], antes: null, depois: {}, riscos: [], risco: "MEDIUM", idempotency_key: "k".repeat(10), ttl_min: 60 };
  await d.proporAprovacao(base);
  const args = log.find((l) => l.rpc === "aprovacao_propor")!.filtros[0][1] as Record<string, unknown>;
  assert.equal(args.p_loja, LOJA_A); assert.equal(args.p_sessao, "s"); assert.equal(args.p_dispositivo, "d");
  const conflito = dadosSupabase({ ...admin, rpc: async () => ({ data: null, error: { code: "23505" } }) } as never);
  assert.match(JSON.stringify(await conflito.proporAprovacao(base)), /idempotência/);
  const quebrado = dadosSupabase({ ...admin, rpc: async () => ({ data: null, error: { code: "XX000", message: "segredo interno" } }) } as never);
  await assert.rejects(() => quebrado.proporAprovacao(base), (e: Error) => !/segredo interno/.test(e.message));
});

// Consulta da API é consentimento próprio; sessões antigas de espelho não o ganham.
test("gateway/Bling: consentimento separado, loja da sessão, rejeição de loja/URL e revogação", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  assert.equal(resultado(await chamar(a, tool("conecta.bling_consultar_produto", {sku:"P1"}))).isError, true);
  assert.equal(a.chamadasDados.length, 0);
  a.portas.validar = async () => sessao(["bling:consultar"]);
  const lista: any = (await chamar(a, rpc("tools/list"))).corpo;
  assert.equal(lista.result.tools.length, 1);
  assert.equal(lista.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(lista.result.tools[0].annotations.openWorldHint, true);
  for (const extra of [{loja_id:LOJA_B},{url:"https://malicioso.test"},{id:"123"}]) {
    assert.equal(resultado(await chamar(a, tool("conecta.bling_consultar_produto", {sku:"P1",...extra}))).isError, true);
  }
  const r = resultado(await chamar(a, tool("conecta.bling_consultar_produto", {sku:"P1"})));
  assert.equal(JSON.parse(r.content[0].text).origem, "api_bling");
  assert.deepEqual(a.chamadasDados, [{metodo:"consultarProdutoBling",loja:LOJA_A,args:"P1"}]);
  a.portas.validar = async () => null;
  assert.equal((await chamar(a, tool("conecta.bling_consultar_produto", {sku:"P1"}))).status, 401);
  assert.equal(a.chamadasDados.length, 1);
});
test("gateway: falha de auditoria bloqueia dados, negações, argumentos inválidos e erros internos", async () => {
  for (const modo of ["ok", "negado", "invalido", "erro"]) {
    const a = ambiente(sessao(modo === "negado" ? [] : ["produtos:ler"]));
    if (modo === "erro") a.portas.dados.obterProduto = async () => { throw Error("segredo"); };
    a.portas.auditar = async () => { throw Error("auditoria secreta"); };
    const r = await chamar(a, tool("conecta.get_product", modo === "invalido" ? {loja_id:LOJA_B} : {sku:"P1"}));
    assert.equal(r.status,503);
    assert.doesNotMatch(JSON.stringify(r), /Pastilha|segredo|auditoria secreta/);
    if (modo === "negado" || modo === "invalido") assert.equal(a.chamadasDados.length,0);
  }
});

test("gateway: o lojista consulta por SKU, EAN ou código OEM e o agente propõe código, aplicação, imagem e bula (sempre propostas, loja da sessão)", async () => {
  const a = ambiente(sessao([...ESCOPOS]));
  assert.equal(resultado(await chamar(a, tool("conecta.get_part_by_code", { termo: "20910-4AU07" }))).isError, undefined);
  assert.deepEqual(a.chamadasDados.find((c) => c.metodo === "consultarPeca"), { metodo: "consultarPeca", loja: LOJA_A, args: "20910-4AU07" });
  assert.equal(resultado(await chamar(a, tool("conecta.propose_code", { sku: "P1", tipo: "oem", valor: "20910-4AU07", fonte: "catálogo do fabricante" }))).isError, undefined);
  assert.equal(resultado(await chamar(a, tool("conecta.propose_application", { sku: "P1", modelo: "UtilX", motorizacao: "2.5 16V", ano_inicial: 2014, fonte: "catálogo" }))).isError, undefined);
  assert.equal(resultado(await chamar(a, tool("conecta.propose_image", { sku: "P1", url: "https://cdn.exemplo.com/foto.jpg", origem: "fornecedor" }))).isError, undefined);
  assert.equal(resultado(await chamar(a, tool("conecta.propose_bula", { sku: "P1", medidas: { espessura: { valor: 1.2, unidade: "mm" } }, fonte: "manual de oficina" }))).isError, undefined);
  for (const m of ["proporCodigo", "proporAplicacao", "proporImagem", "proporBula"]) assert.equal(a.chamadasDados.find((c) => c.metodo === m)?.loja, LOJA_A, `${m} usa a loja da sessão`);
});
test("gateway: proposta sem fonte é recusada antes de chegar aos dados; tipo de código inválido também", async () => {
  const a = ambiente(sessao([...ESCOPOS]));
  assert.equal(resultado(await chamar(a, tool("conecta.propose_code", { sku: "P1", tipo: "oem", valor: "ABC123" }))).isError, true);
  assert.equal(resultado(await chamar(a, tool("conecta.propose_code", { sku: "P1", tipo: "sku", valor: "ABC123", fonte: "x" }))).isError, true);
  assert.equal(resultado(await chamar(a, tool("conecta.propose_bula", { sku: "P1", medidas: { espessura: { valor: 1, unidade: "mm" } } }))).isError, true);
  assert.equal(a.chamadasDados.filter((c) => c.metodo.startsWith("propor")).length, 0);
});
test("gateway: sem o escopo de proposta o agente só lê (propose_code negado e auditado)", async () => {
  const a = ambiente(sessao(["produtos:ler"]));
  const r = resultado(await chamar(a, tool("conecta.propose_code", { sku: "P1", tipo: "oem", valor: "ABC123", fonte: "x" })));
  assert.equal(r.isError, true); assert.match(r.content[0].text, /enriquecimento:propor/);
  assert.equal(a.auditoria[0].resultado, "negado");
});
test("gateway: as instruções entregues ao agente trazem as regras do sistema (nunca apagar nota fiscal nem o espelho, fonte, pausa, versão do veículo)", async () => {
  const a = ambiente(sessao([...ESCOPOS]));
  const r = (await chamar(a, rpc("initialize", { protocolVersion: "2025-06-18" }))).corpo as { result: { instructions: string } };
  for (const trecho of [/nunca apaga notas fiscais/, /cadastro espelhado do Bling/, /pausou o cadastro autom/, /VERSÃO do veículo/, /fonte/i, /SKU, EAN, código OEM/]) assert.match(r.result.instructions, trecho);
});

test("Guardião fase 3: valores aprovados por SKU só com produtos:ler, sem loja nos argumentos", async () => {
  const r = await chamar(ambiente(sessao(["produtos:ler"])), rpc("tools/call", { name: "conecta.get_validated_fields", arguments: { sku: "P1" } }));
  assert.match(JSON.stringify(r.corpo), /Cobreq/);
  const outro = await chamar(ambiente(sessao(["produtos:ler"])), rpc("tools/call", { name: "conecta.get_validated_fields", arguments: { sku: "P1", loja_id: "x" } }));
  assert.match(JSON.stringify(outro.corpo), /isError|não permitido|desconhecid/i);
  const nada = await chamar(ambiente(sessao(["enriquecimento:propor"])), rpc("tools/call", { name: "conecta.get_validated_fields", arguments: { sku: "P1" } }));
  assert.match(JSON.stringify(nada.corpo), /Permissão negada/);
});
