import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { cifrar, decifrar } from "./cripto.ts";
import { assinaturaValida } from "./assinatura.ts";
import { trocarCodigo, urlAutorizacao } from "./oauth.ts";
import { clienteBling } from "./cliente.ts";

const env = { CREDENCIAIS_CHAVE_CIFRA: randomBytes(32).toString("base64") } as unknown as NodeJS.ProcessEnv;
const cfg = { clientId: "id", clientSecret: "segredo", appUrl: "https://x.test" };

test("cifra: ida e volta com JWT longo e IV distinto", () => {
  const jwt = "a".repeat(3500);
  const c1 = cifrar(jwt, env);
  assert.equal(decifrar(c1, env), jwt);
  assert.notEqual(c1, cifrar(jwt, env));
  assert.ok(!c1.includes(jwt.slice(0, 20)));
});

test("cifra: adulteração é rejeitada", () => {
  const p = cifrar("x", env).split(".");
  p[3] = Buffer.from("zz").toString("base64url");
  assert.throws(() => decifrar(p.join("."), env));
});

test("assinatura do webhook", () => {
  const corpo = '{"a":1}';
  const h = "sha256=" + createHmac("sha256", "segredo").update(corpo).digest("hex");
  assert.equal(assinaturaValida(corpo, h, "segredo"), true);
  assert.equal(assinaturaValida(corpo + " ", h, "segredo"), false);
  assert.equal(assinaturaValida(corpo, null, "segredo"), false);
  assert.equal(assinaturaValida(corpo, "sha256=00", "segredo"), false);
});

test("oauth: URL de autorização e troca de código com cabeçalhos exigidos", async () => {
  assert.match(urlAutorizacao(cfg, "st"), /client_id=id&state=st/);
  let visto: { h: Record<string, string>; b: string } | undefined;
  const f = (async (_u: unknown, i: RequestInit) => {
    visto = { h: i.headers as Record<string, string>, b: String(i.body) };
    return new Response(JSON.stringify({ access_token: "A", refresh_token: "R", expires_in: 21600 }));
  }) as typeof fetch;
  const t = await trocarCodigo(cfg, "cod", f);
  assert.equal(t.accessToken, "A");
  assert.equal(visto!.h["enable-jwt"], "1");
  assert.equal(visto!.h.Accept, "1.0");
  assert.equal(visto!.h.Authorization, "Basic " + Buffer.from("id:segredo").toString("base64"));
  assert.match(visto!.b, /grant_type=authorization_code&code=cod/);
});

test("oauth: erro não vaza corpo da resposta", async () => {
  const f = (async () => new Response("segredo-ecoado", { status: 400 })) as typeof fetch;
  await assert.rejects(trocarCodigo(cfg, "c", f), (e: Error) => !e.message.includes("segredo-ecoado"));
});

test("cliente: 429 faz backoff e tenta de novo; envia enable-jwt", async () => {
  let n = 0; const esperas: number[] = []; let hdr: Record<string, string> = {};
  const f = (async (_u: unknown, i: RequestInit) => {
    hdr = i.headers as Record<string, string>;
    return ++n === 1 ? new Response("", { status: 429 }) : new Response(JSON.stringify({ data: [1] }));
  }) as typeof fetch;
  const c = clienteBling({ accessToken: async () => "T", fetch: f, dormir: async (ms) => { esperas.push(ms); } });
  assert.deepEqual(await c.get("/produtos"), { data: [1] });
  assert.equal(n, 2);
  assert.ok(esperas.includes(1000));
  assert.equal(hdr["enable-jwt"], "1");
  assert.equal(hdr.Authorization, "Bearer T");
});

test("cliente: paginação até página incompleta", async () => {
  const f = (async (u: URL) => {
    const p = Number(u.searchParams.get("pagina"));
    return new Response(JSON.stringify({ data: p === 1 ? [1, 2] : [3] }));
  }) as unknown as typeof fetch;
  const c = clienteBling({ accessToken: async () => "T", fetch: f, dormir: async () => {} });
  const tudo: number[] = [];
  for await (const pg of c.paginas<number>("/produtos", {}, 2)) tudo.push(...pg);
  assert.deepEqual(tudo, [1, 2, 3]);
});
