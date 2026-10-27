import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveOpaca, guardarPublico, ipDoPedido, LIMITES_PADRAO, portaViaRpc, segredoDoLimite, tetoLocal, type ConfigLimite, type PortaLimite } from "./publico.ts";

const SEGREDO = "segredo-de-teste";
const pedido = (corpo: unknown, cab: Record<string, string> = {}) =>
  new Request("https://f.exemplo.invalid/loja-publica", { method: "POST", headers: { "content-type": "application/json", ...cab }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

/** Janela fixa em memória, igual à RPC limite_chamada. Registra as chaves recebidas. */
function portaFalsa(): { porta: PortaLimite; chaves: string[]; chamadas: () => number } {
  const n = new Map<string, number>(), chaves: string[] = [];
  return { chaves, chamadas: () => chaves.length, porta: async (chave, max) => { chaves.push(chave); const v = (n.get(chave) ?? 0) + 1; n.set(chave, v); return v <= max; } };
}
const cfgPequena = (o: Partial<ConfigLimite> = {}): ConfigLimite => ({ ip: [{ nome: "rajada", max: 3, janelaS: 60 }, { nome: "sustentado", max: 100, janelaS: 3600 }], loja: { nome: "loja", max: 1000, janelaS: 60 }, corpoMaxBytes: 4096, tetoLocalPorMin: 2, ...o });
const roda = (porta: PortaLimite, corpo: unknown, cab: Record<string, string>, config?: ConfigLimite, extra: object = {}) =>
  guardarPublico({ endpoint: "loja-publica", req: pedido(corpo, cab), lojaDe: (b) => (typeof b?.slug === "string" ? b.slug : null), porta, segredo: SEGREDO, config, ...extra });

test("429 depois do limite de rajada por IP, com Retry-After; o pedido dentro do limite passa e devolve o corpo", async () => {
  const { porta } = portaFalsa();
  const ip = { "cf-connecting-ip": "203.0.113.10" };
  for (let i = 0; i < 3; i++) { const r = await roda(porta, { slug: "loja-a" }, ip, cfgPequena()); assert.equal(r.ok, true); if (r.ok) assert.equal(r.corpo.slug, "loja-a"); }
  const r = await roda(porta, { slug: "loja-a" }, ip, cfgPequena());
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.status, 429); assert.equal(r.cabecalhos["Retry-After"], "60"); assert.match(r.corpo.erro, /Aguarde/); }
});

test("IPs diferentes têm limites independentes", async () => {
  const { porta } = portaFalsa();
  for (let i = 0; i < 3; i++) await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": "203.0.113.11" }, cfgPequena());
  assert.equal((await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": "203.0.113.11" }, cfgPequena())).ok, false);
  assert.equal((await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": "203.0.113.12" }, cfgPequena())).ok, true);
});

test("x-forwarded-for forjado NÃO burla o limite quando a borda informa o IP real", async () => {
  const { porta } = portaFalsa();
  let negados = 0;
  for (let i = 0; i < 8; i++) { const r = await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": "203.0.113.13", "x-forwarded-for": `10.0.0.${i + 1}, 1.2.3.4` }, cfgPequena()); if (!r.ok) negados++; }
  assert.equal(negados, 5);
});

test("IP girando (forjado, sem cabeçalho da borda) ainda bate no teto por loja", async () => {
  const { porta } = portaFalsa();
  const cfg = cfgPequena({ loja: { nome: "loja", max: 4, janelaS: 60 } });
  let ok = 0;
  for (let i = 0; i < 10; i++) { const r = await roda(porta, { slug: "loja-alvo" }, { "x-forwarded-for": `198.51.100.${i + 1}` }, cfg); if (r.ok) ok++; }
  assert.equal(ok, 4, "o teto por loja segura o ataque distribuído");
  assert.equal((await roda(porta, { slug: "outra-loja" }, { "x-forwarded-for": "198.51.100.200" }, cfg)).ok, true, "outra loja não é afetada");
});

test("IP inválido ou ausente vira um balde próprio e MENOR (não é rota livre)", async () => {
  assert.equal(ipDoPedido(new Headers({ "cf-connecting-ip": "<script>", "x-forwarded-for": "999.1.1.1" })), null);
  assert.equal(ipDoPedido(new Headers({ "x-forwarded-for": "2001:db8::1, 10.0.0.1" })), "2001:db8::1");
  const { porta } = portaFalsa();
  let ok = 0;
  for (let i = 0; i < 6; i++) if ((await roda(porta, { slug: "loja-a" }, {}, cfgPequena({ ip: [{ nome: "rajada", max: 4, janelaS: 60 }] }))).ok) ok++;
  assert.equal(ok, 2, "sem IP, metade do limite (4 -> 2)");
});

test("o IP cru e o segredo nunca chegam à porta nem à resposta", async () => {
  const { porta, chaves } = portaFalsa();
  const ip = "203.0.113.99";
  for (let i = 0; i < 5; i++) await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": ip }, cfgPequena());
  const r = await roda(porta, { slug: "loja-a" }, { "cf-connecting-ip": ip }, cfgPequena());
  const tudo = JSON.stringify([chaves, r]);
  assert.ok(!tudo.includes(ip) && !tudo.includes(SEGREDO));
});

test("o limitador falhando (null ou exceção): vitrine continua, com teto local; depois 429; e avisa", async () => {
  const falhas: string[] = [];
  const portas: PortaLimite[] = [async () => null, async () => { throw new Error("rpc fora"); }];
  for (const [i, porta] of portas.entries()) {
    const ip = { "cf-connecting-ip": `203.0.113.${50 + i}` };
    const r1 = await roda(porta, { slug: "loja-a" }, ip, cfgPequena(), { aoFalhar: (m: string) => falhas.push(m) });
    const r2 = await roda(porta, { slug: "loja-a" }, ip, cfgPequena());
    const r3 = await roda(porta, { slug: "loja-a" }, ip, cfgPequena());
    assert.equal(r1.ok, true); assert.equal(r2.ok, true); assert.equal(r3.ok, false, "teto local (2/min) dispara");
  }
  assert.ok(falhas.length >= 1);
});

test("corpo grande demais: 413 sem chamar o limitador nem o banco (Content-Length ou corpo real)", async () => {
  const { porta, chamadas } = portaFalsa();
  const grande = JSON.stringify({ slug: "x", lixo: "a".repeat(5000) });
  const r1 = await roda(porta, grande, {}, cfgPequena());
  assert.equal(r1.ok, false); if (!r1.ok) assert.equal(r1.status, 413);
  const r2 = await guardarPublico({ endpoint: "loja-publica", req: { headers: new Headers({ "content-length": "999999" }), body: null }, lojaDe: () => null, porta, segredo: SEGREDO, config: cfgPequena() });
  assert.equal(r2.ok, false); if (!r2.ok) assert.equal(r2.status, 413);
  assert.equal(chamadas(), 0);
});

test("corpo inválido mantém o contrato antigo: vira {} (o handler responde 404 da loja)", async () => {
  const { porta } = portaFalsa();
  const r = await roda(porta, "{nao é json", { "cf-connecting-ip": "203.0.113.60" }, cfgPequena());
  assert.equal(r.ok, true); if (r.ok) assert.deepEqual(r.corpo, {});
});

test("limites padrão: navegação humana normal cabe (60/min) e o assistente é mais restrito que a vitrine", () => {
  assert.equal(LIMITES_PADRAO["loja-publica"].ip[0].max, 60);
  assert.ok(LIMITES_PADRAO["vitrine-assistente"].ip[0].max < LIMITES_PADRAO["loja-publica"].ip[0].max);
  assert.ok(LIMITES_PADRAO["vitrine-assistente"].corpoMaxBytes <= LIMITES_PADRAO["loja-publica"].corpoMaxBytes);
});

test("chaveOpaca: determinística, depende do segredo e não revela a entrada; segredoDoLimite não vaza a chave de serviço", async () => {
  const a = await chaveOpaca("203.0.113.1", "s1"), b = await chaveOpaca("203.0.113.1", "s1"), c = await chaveOpaca("203.0.113.1", "s2");
  assert.equal(a, b); assert.notEqual(a, c); assert.match(a, /^[0-9a-f]{24}$/);
  const env = new Map([["SUPABASE_SERVICE_ROLE_KEY", "CHAVE-DE-SERVICO-FALSA"]]);
  const seg = segredoDoLimite({ get: (n) => env.get(n) });
  assert.ok(!(await chaveOpaca("x", seg)).includes("CHAVE-DE-SERVICO-FALSA"));
  assert.equal(segredoDoLimite({ get: (n) => (n === "LIMITE_PEPPER" ? "pimenta" : undefined) }), "pimenta");
});

test("portaViaRpc: true/false vêm da RPC; erro ou resposta estranha = limitador falhou (null)", async () => {
  const mk = (res: { data: unknown; error: unknown }) => portaViaRpc({ rpc: async () => res });
  assert.equal(await mk({ data: true, error: null })("k", 1, 1), true);
  assert.equal(await mk({ data: false, error: null })("k", 1, 1), false);
  assert.equal(await mk({ data: null, error: { message: "x" } })("k", 1, 1), null);
  assert.equal(await mk({ data: "sim", error: null })("k", 1, 1), null);
});

test("tetoLocal: conta por minuto e libera depois da janela", () => {
  assert.equal(tetoLocal("t-unico", 1, 1000), true);
  assert.equal(tetoLocal("t-unico", 1, 1500), false);
  assert.equal(tetoLocal("t-unico", 1, 62_000), true);
});
