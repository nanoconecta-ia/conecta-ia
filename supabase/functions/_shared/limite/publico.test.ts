import { test } from "node:test";
import assert from "node:assert/strict";
import { baldeDe, cabecalhoIpConfigurado, chaveOpaca, guardarPublico, ipDoPedido, LIMITES_PADRAO, portaViaRpc, segredoDoLimite, tamanhoTetoLocal, tetoLocal, type ConfigLimite, type PortaLimite } from "./publico.ts";

const SEGREDO = "segredo-de-teste";
const pedido = (corpo: unknown, cab: Record<string, string> = {}) =>
  new Request("https://f.exemplo.invalid/loja-publica", { method: "POST", headers: { "content-type": "application/json", ...cab }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });

/** Janela fixa em memória, igual à RPC limite_chamada. Registra as chaves recebidas. */
function portaFalsa(): { porta: PortaLimite; chaves: string[]; distintas: () => Set<string> } {
  const n = new Map<string, number>(), chaves: string[] = [];
  return { chaves, distintas: () => new Set(chaves), porta: async (chave, max) => { chaves.push(chave); const v = (n.get(chave) ?? 0) + 1; n.set(chave, v); return v <= max; } };
}
const cfgPequena = (o: Partial<ConfigLimite> = {}): ConfigLimite => ({
  ip: [{ nome: "rajada", max: 3, janelaS: 60 }, { nome: "sustentado", max: 100, janelaS: 3600 }], loja: { nome: "loja", max: 1000, janelaS: 60 },
  semIp: { nome: "sem-ip", max: 5, janelaS: 60 }, baldesIp: 1_000_000, corpoMaxBytes: 4096, tetoLocalPorMin: 2, ...o,
});
const roda = (porta: PortaLimite, corpo: unknown, cab: Record<string, string>, config?: ConfigLimite, extra: object = {}) =>
  guardarPublico({ endpoint: "loja-publica", req: pedido(corpo, cab), lojaDe: (b) => (typeof b?.slug === "string" ? b.slug : null), porta, segredo: SEGREDO, config, ...extra });
const CF = (ip: string) => ({ "cf-connecting-ip": ip });

test("429 depois do limite de rajada por IP, com Retry-After; dentro do limite passa e devolve o corpo", async () => {
  const { porta } = portaFalsa();
  for (let i = 0; i < 3; i++) { const r = await roda(porta, { slug: "loja-a" }, CF("203.0.113.10"), cfgPequena()); assert.equal(r.ok, true); if (r.ok) assert.equal(r.corpo.slug, "loja-a"); }
  const r = await roda(porta, { slug: "loja-a" }, CF("203.0.113.10"), cfgPequena());
  assert.equal(r.ok, false);
  if (!r.ok) { assert.equal(r.status, 429); assert.equal(r.cabecalhos["Retry-After"], "60"); assert.match(r.corpo.erro, /Aguarde/); }
});

test("IPs diferentes têm limites independentes", async () => {
  const { porta } = portaFalsa();
  for (let i = 0; i < 3; i++) await roda(porta, { slug: "loja-a" }, CF("203.0.113.11"), cfgPequena());
  assert.equal((await roda(porta, { slug: "loja-a" }, CF("203.0.113.11"), cfgPequena())).ok, false);
  assert.equal((await roda(porta, { slug: "loja-a" }, CF("203.0.113.12"), cfgPequena())).ok, true);
});

test("x-forwarded-for e x-real-ip são IGNORADOS: com o IP da borda fixo, girar o XFF não burla", async () => {
  const { porta } = portaFalsa();
  let negados = 0;
  for (let i = 0; i < 8; i++) { const r = await roda(porta, { slug: "loja-a" }, { ...CF("203.0.113.13"), "x-forwarded-for": `10.0.0.${i + 1}, 1.2.3.4`, "x-real-ip": `10.9.9.${i + 1}` }, cfgPequena()); if (!r.ok) negados++; }
  assert.equal(negados, 5);
});

test("sem o cabeçalho confiável, girar o x-forwarded-for NÃO vira rota livre: cai no limite 'sem IP' da loja", async () => {
  const { porta } = portaFalsa();
  let ok = 0;
  for (let i = 0; i < 100; i++) { const r = await roda(porta, { slug: "loja-alvo" }, { "x-forwarded-for": `198.51.100.${i + 1}`, "x-real-ip": `198.51.101.${i + 1}` }, cfgPequena()); if (r.ok) ok++; }
  assert.equal(ok, 5, "só o limite próprio de quem não se identifica (5/min no teste)");
});

test("hipótese ruim: se a borda NÃO sobrescrever o cabeçalho e o cliente o girar, o limite por IP é contornado, mas o teto da loja segura", async () => {
  const { porta } = portaFalsa();
  const cfg = cfgPequena({ loja: { nome: "loja", max: 40, janelaS: 60 } });
  let ok = 0;
  for (let i = 0; i < 200; i++) { const r = await roda(porta, { slug: "loja-alvo" }, CF(`198.18.${i >> 8}.${i & 255}`), cfg); if (r.ok) ok++; }
  assert.equal(ok, 40);
  assert.equal((await roda(porta, { slug: "outra-loja" }, CF("198.18.250.1"), cfg)).ok, true, "outra loja não é afetada");
});

test("cabeçalho de IP configurável: o escolhido vale e o padrão deixa de valer; nome inválido volta ao padrão", async () => {
  assert.equal(cabecalhoIpConfigurado(undefined), "cf-connecting-ip");
  assert.equal(cabecalhoIpConfigurado("X-Meu-IP"), "x-meu-ip");
  assert.equal(cabecalhoIpConfigurado("a b; drop"), "cf-connecting-ip");
  assert.equal(cabecalhoIpConfigurado(""), "cf-connecting-ip");
  const h = new Headers({ "x-meu-ip": "203.0.113.5", "cf-connecting-ip": "203.0.113.6" });
  assert.equal(ipDoPedido(h, "x-meu-ip"), "203.0.113.5");
  assert.equal(ipDoPedido(h), "203.0.113.6");
  const { porta } = portaFalsa();
  for (let i = 0; i < 3; i++) await roda(porta, { slug: "loja-a" }, { "x-meu-ip": "203.0.113.5" }, cfgPequena(), { cabecalhoIp: "x-meu-ip" });
  assert.equal((await roda(porta, { slug: "loja-a" }, { "x-meu-ip": "203.0.113.5" }, cfgPequena(), { cabecalhoIp: "x-meu-ip" })).ok, false);
});

test("IP inválido no cabeçalho confiável conta como 'sem IP'", () => {
  assert.equal(ipDoPedido(new Headers({ "cf-connecting-ip": "<script>" })), null);
  assert.equal(ipDoPedido(new Headers({ "cf-connecting-ip": "999.1.1.1" })), null);
  assert.equal(ipDoPedido(new Headers({ "cf-connecting-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(ipDoPedido(new Headers({})), null);
});

test("sem IP NÃO é balde global: cada loja tem o próprio limite 'sem IP'", async () => {
  const { porta } = portaFalsa();
  let a = 0, b = 0;
  for (let i = 0; i < 20; i++) { if ((await roda(porta, { slug: "loja-a" }, {}, cfgPequena())).ok) a++; if ((await roda(porta, { slug: "loja-b" }, {}, cfgPequena())).ok) b++; }
  assert.deepEqual([a, b], [5, 5]);
});

test("ordem: pedido negado pelo teto da loja grava UMA linha; pedido aceito grava 3 (loja + 2 de IP) ou 2 (sem IP)", async () => {
  const cfg = cfgPequena({ loja: { nome: "loja", max: 2, janelaS: 60 } });
  const { porta, chaves } = portaFalsa();
  await roda(porta, { slug: "loja-a" }, CF("203.0.113.20"), cfg); assert.equal(chaves.length, 3);
  await roda(porta, { slug: "loja-a" }, {}, cfg); assert.equal(chaves.length, 5, "sem IP: loja + 1");
  const antes = chaves.length;
  for (let i = 0; i < 50; i++) await roda(porta, { slug: "loja-a" }, CF(`203.0.113.${100 + i}`), cfg); // teto da loja já estourou
  assert.equal(chaves.length - antes, 50, "50 pedidos negados = 50 gravações, todas na mesma linha da loja");
  assert.equal(new Set(chaves.slice(antes)).size, 1);
});

test("linhas por balde são limitadas: 5000 IPs distintos geram no máximo 2 x baldes chaves de IP", async () => {
  const cfg = cfgPequena({ baldesIp: 64, loja: { nome: "loja", max: 1_000_000, janelaS: 60 } });
  const { porta, distintas } = portaFalsa();
  for (let i = 0; i < 5000; i++) await roda(porta, { slug: "loja-a" }, CF(`100.64.${i >> 8}.${i & 255}`), cfg);
  const ipChaves = [...distintas()].filter((k) => k.includes(":ip:"));
  assert.ok(ipChaves.length <= 2 * 64, `chaves de IP: ${ipChaves.length}`);
  assert.ok(ipChaves.length > 64, "e os baldes de fato são usados");
});

test("balde: determinístico, dentro da faixa e distribuído", async () => {
  const b = await chaveOpaca("203.0.113.1", "s");
  assert.equal(baldeDe(b, 2048), baldeDe(b, 2048));
  const vistos = new Set<number>();
  for (let i = 0; i < 2000; i++) { const x = baldeDe(await chaveOpaca(`10.0.${i >> 8}.${i & 255}`, "s"), 2048); assert.ok(x >= 0 && x < 2048); vistos.add(x); }
  assert.ok(vistos.size > 900, `distribuição: ${vistos.size} baldes usados de 2048`);
});

test("o IP cru, o balde e o segredo nunca chegam à resposta; as chaves não contêm o IP", async () => {
  const { porta, chaves } = portaFalsa();
  const ip = "203.0.113.99";
  for (let i = 0; i < 5; i++) await roda(porta, { slug: "loja-a" }, CF(ip), cfgPequena());
  const r = await roda(porta, { slug: "loja-a" }, CF(ip), cfgPequena());
  const tudo = JSON.stringify([chaves, r]);
  assert.ok(!tudo.includes(ip) && !tudo.includes(SEGREDO));
});

test("limitador falhando (null ou exceção): vitrine continua, com teto local; depois 429; e avisa", async () => {
  const falhas: string[] = [];
  const portas: PortaLimite[] = [async () => null, async () => { throw new Error("rpc fora"); }];
  for (const [i, porta] of portas.entries()) {
    const cab = CF(`203.0.113.${50 + i}`);
    const r1 = await roda(porta, { slug: "loja-a" }, cab, cfgPequena(), { aoFalhar: (m: string) => falhas.push(m) });
    const r2 = await roda(porta, { slug: "loja-a" }, cab, cfgPequena());
    const r3 = await roda(porta, { slug: "loja-a" }, cab, cfgPequena());
    assert.equal(r1.ok, true); assert.equal(r2.ok, true); assert.equal(r3.ok, false, "teto local (2/min) dispara");
  }
  assert.ok(falhas.length >= 1);
});

test("corpo grande demais: 413 sem chamar o limitador nem o banco (Content-Length ou corpo real)", async () => {
  const { porta, chaves } = portaFalsa();
  const r1 = await roda(porta, JSON.stringify({ slug: "x", lixo: "a".repeat(5000) }), {}, cfgPequena());
  assert.equal(r1.ok, false); if (!r1.ok) assert.equal(r1.status, 413);
  const r2 = await guardarPublico({ endpoint: "loja-publica", req: { headers: new Headers({ "content-length": "999999" }), body: null }, lojaDe: () => null, porta, segredo: SEGREDO, config: cfgPequena() });
  assert.equal(r2.ok, false); if (!r2.ok) assert.equal(r2.status, 413);
  assert.equal(chaves.length, 0);
});

test("corpo inválido mantém o contrato antigo: vira {} (o handler responde 404 da loja)", async () => {
  const { porta } = portaFalsa();
  const r = await roda(porta, "{nao é json", CF("203.0.113.60"), cfgPequena());
  assert.equal(r.ok, true); if (r.ok) assert.deepEqual(r.corpo, {});
});

test("limites padrão: navegação humana normal cabe (60/min) e o assistente é mais restrito que a vitrine", () => {
  const v = LIMITES_PADRAO["loja-publica"], a = LIMITES_PADRAO["vitrine-assistente"];
  assert.equal(v.ip[0].max, 60);
  assert.ok(a.ip[0].max < v.ip[0].max && a.corpoMaxBytes <= v.corpoMaxBytes);
  assert.ok(v.semIp.max < v.loja.max && a.semIp.max < a.loja.max, "quem não se identifica tem limite menor que o geral da loja");
  assert.equal(v.baldesIp, 2048);
});

test("chaveOpaca depende do segredo; segredoDoLimite não vaza a chave de serviço", async () => {
  const a = await chaveOpaca("203.0.113.1", "s1"), c = await chaveOpaca("203.0.113.1", "s2");
  assert.notEqual(a, c); assert.match(a, /^[0-9a-f]{24}$/);
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

test("tetoLocal: conta por minuto, libera depois da janela e a limpeza de vencidas acontece (e só acima de 5 mil entradas)", () => {
  assert.equal(tetoLocal("t-unico", 1, 1000), true);
  assert.equal(tetoLocal("t-unico", 1, 1500), false);
  assert.equal(tetoLocal("t-unico", 1, 62_000), true);
  const t0 = 10_000_000_000;
  for (let i = 0; i < 6000; i++) tetoLocal(`lote-${i}`, 5, t0);
  assert.ok(tamanhoTetoLocal() >= 6000);
  tetoLocal("depois", 5, t0 + 61_000); // todas as anteriores venceram e já passou o intervalo mínimo entre limpezas
  assert.ok(tamanhoTetoLocal() < 100, `depois da limpeza: ${tamanhoTetoLocal()}`);
});
