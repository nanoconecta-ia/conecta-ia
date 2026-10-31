// Fase 2: pareamento pelo Conecta Pair (já implantado), consulta ao espelho e propostas com fonte. Sem rede: fetch simulado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chamarFerramenta, consultarPareamento, ESCOPOS_GUARDIAO, iniciarPareamento, SessaoExpirada, sha256Hex, tokenCompleto, URL_GATEWAY, URL_PAIR } from "../src/pareamento.ts";
import { compararComEspelho, montarProposta } from "../src/espelho.ts";
import { lerCampos, type CampoBruto } from "../src/leitura.ts";
import { reconhecer } from "../src/reconhecer.ts";
import { MAPA_PRODUTO_BLING } from "../src/mapa-produto.ts";
import { readFileSync } from "node:fs";

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

test("iniciar: token nasce no dispositivo (só o SHA-256 vai ao servidor), tipo navegador, escopos mínimos sem aprovar/executar", async () => {
  let corpo: Record<string, unknown> = {};
  const f = (async (url: string, init: RequestInit) => { assert.equal(url, URL_PAIR); corpo = JSON.parse(String(init.body));
    return json({ codigo: "c".repeat(43), url: "https://app/#/parear?c=x", verificacao: "ABC-123", segredo: "s".repeat(43), sal: "S".repeat(43), expira_em: new Date(Date.now() + 120000).toISOString() }); }) as unknown as typeof fetch;
  const d = await iniciarPareamento("Nano.IA Guardião (navegador)", f);
  assert.equal(corpo.acao, "iniciar"); assert.equal(corpo.tipo, "navegador");
  assert.deepEqual(corpo.escopos, [...ESCOPOS_GUARDIAO]);
  assert.ok(!(corpo.escopos as string[]).some((e) => /aprov|execut|admin/.test(e)));
  assert.match(String(corpo.token_hash), /^[0-9a-f]{64}$/);
  assert.equal(corpo.token_hash, await sha256Hex(d.metade), "o servidor recebe o hash da 1ª metade");
  assert.ok(!JSON.stringify(corpo).includes(d.metade), "a 1ª metade nunca vai ao servidor");
  assert.match(d.metade, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(tokenCompleto(d.metade, d.sal), `${d.metade}.${"S".repeat(43)}`);
});

test("iniciar: erro do servidor chega com a mensagem dele; sem rede, mensagem clara", async () => {
  await assert.rejects(iniciarPareamento("x", (async () => json({ erro: "Pareamento ainda não configurado no servidor." }, 503)) as unknown as typeof fetch), /não configurado/);
  await assert.rejects(iniciarPareamento("x", (async () => { throw new TypeError("rede"); }) as unknown as typeof fetch), /Sem conexão/);
});

test("consultar: devolve o estado do desafio", async () => {
  const s = await consultarPareamento({ codigo: "c", segredo: "s" }, (async () => json({ estado: "resgatado", loja_id: "L", escopos: ["produtos:ler"], sessao_expira_em: "2026-11-01T00:00:00Z" })) as unknown as typeof fetch);
  assert.equal(s.estado, "resgatado");
});

test("gateway: tools/call com Bearer; resultado JSON; isError vira erro; 401 vira SessaoExpirada", async () => {
  let pedido: { url: string; init: RequestInit } | null = null;
  const ok = (async (url: string, init: RequestInit) => { pedido = { url, init }; return json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify({ nome: "Bomba", sku: "CI000016" }) }] } }); }) as unknown as typeof fetch;
  const p = await chamarFerramenta<{ nome: string }>("tk.sal", "conecta.get_product", { sku: "CI000016" }, ok);
  assert.equal(p.nome, "Bomba");
  assert.equal(pedido!.url, URL_GATEWAY);
  assert.equal((pedido!.init.headers as Record<string, string>).Authorization, "Bearer tk.sal");
  const corpo = JSON.parse(String(pedido!.init.body));
  assert.equal(corpo.method, "tools/call"); assert.equal(corpo.params.name, "conecta.get_product"); assert.ok(!("loja_id" in corpo.params.arguments));
  await assert.rejects(chamarFerramenta("t", "x", {}, (async () => json({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "Permissão negada: falta escopo." }] } })) as unknown as typeof fetch), /Permissão negada/);
  await assert.rejects(chamarFerramenta("t", "x", {}, (async () => json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Não autorizado." } }, 401)) as unknown as typeof fetch), SessaoExpirada);
});

const c = (rotulo: string, valor = ""): CampoBruto => ({ rotulo, tipo: "text", valor, visivel: true });
const r = reconhecer(lerCampos([c("Nome", "Bomba d'água HR 2.5"), c("Código (SKU)", "CI000016"), c("GTIN/EAN", "7891234567895"), c("Marca", "TRIM GO"), c("Descrição curta"), c("Peso líquido (kg)"), c("Categoria", "Arrefecimento")]), MAPA_PRODUTO_BLING);

test("espelho: aponta só o que difere (acento/caixa ignorados) e trata vazio dos dois lados", () => {
  const d = compararComEspelho(r, { nome: "BOMBA D AGUA HR 2.5", marca: "Trim Go", gtin: null, descricao_curta: "" });
  assert.deepEqual(d.map((x) => x.campo), ["GTIN/EAN"]);
  assert.equal(d[0].espelho, "(vazio)");
});

test("proposta: exige SKU, valor e fonte; valida GTIN e peso; mapeia para a lista fechada do servidor", () => {
  assert.deepEqual(montarProposta("descricaoCurta", "CI000016", "Bomba d'água com juntas", "https://fabricante.exemplo/ci000016"),
    { ferramenta: "conecta.propose_enrichment", args: { sku: "CI000016", campo: "descricao_curta", valor: "Bomba d'água com juntas", fonte: "https://fabricante.exemplo/ci000016" } });
  assert.deepEqual(montarProposta("gtin", "CI000016", "7891234567895", "Embalagem, foto do lote 12").args, { sku: "CI000016", tipo: "ean", valor: "7891234567895", fonte: "Embalagem, foto do lote 12" });
  assert.equal(montarProposta("pesoLiquido", "CI000016", "1,35", "Catálogo 2026 p. 40").args.valor, "1.35");
  assert.throws(() => montarProposta("descricaoCurta", "CI000016", "x", ""), /fonte/);
  assert.throws(() => montarProposta("gtin", "CI000016", "123", "https://x.y/z"), /GTIN/);
  assert.throws(() => montarProposta("pesoLiquido", "CI000016", "abc", "https://x.y/z"), /Peso/);
  assert.throws(() => montarProposta("descricaoCurta", "", "x", "https://x.y/z"), /SKU/);
  assert.throws(() => montarProposta("preco", "CI000016", "10", "https://x.y/z"), /não aceita/);
});

test("manifest: host do Conecta.IA bate com a configuração do painel; sem acesso fixo a nenhum ERP", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(m.host_permissions, [new URL(URL_PAIR).origin + "/*"]);
  assert.deepEqual(m.optional_host_permissions, ["https://*/*"]);
  assert.ok(m.permissions.includes("storage"));
});
