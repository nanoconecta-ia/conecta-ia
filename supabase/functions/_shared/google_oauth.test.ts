import { test } from "node:test";
import assert from "node:assert/strict";
import { clienteDoAmbiente, ESCOPO_DRIVE_ARQUIVO, lerIdToken, renovarAccess, revogar, trocarCodigo, urlAutorizacao } from "./google_oauth.ts";
import { b64u } from "./estado.ts";

// Tudo SINTÉTICO: nenhuma credencial real, nenhuma chamada de rede.
const cli = { clientId: "id-sintetico.apps.test", clientSecret: "SEGREDO-SINTETICO", redirectUri: "https://conecta-sintetico.test/functions/v1/google-callback" };
const enc = new TextEncoder();
const idToken = (c: Record<string, unknown>) => `${b64u(enc.encode("{}"))}.${b64u(enc.encode(JSON.stringify(c)))}.assinatura`;
const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const bom = () => ({
  access_token: "ACCESS-SINTETICO", refresh_token: "REFRESH-SINTETICO", expires_in: 3599,
  scope: `openid https://www.googleapis.com/auth/userinfo.email ${ESCOPO_DRIVE_ARQUIVO}`,
  id_token: idToken({ sub: "123", email: "Lojista@Exemplo.com", email_verified: true }),
});

test("URL de autorização: escopo mínimo, offline, consentimento e state; sem Gmail nem Drive inteiro", () => {
  const u = new URL(urlAutorizacao({ clientId: cli.clientId, redirectUri: cli.redirectUri, state: "estado-x", loginHint: "lojista@exemplo.com" }));
  const escopo = u.searchParams.get("scope")!.split(" ");
  assert.deepEqual(escopo, ["openid", "email", ESCOPO_DRIVE_ARQUIVO]);
  assert.ok(!escopo.some((s) => /gmail|auth\/drive$|drive\.readonly/.test(s)));
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("include_granted_scopes"), "false");
  assert.equal(u.searchParams.get("state"), "estado-x");
  assert.equal(u.searchParams.get("login_hint"), "lojista@exemplo.com");
});

test("login_hint inválido é descartado (não vira parâmetro injetado)", () => {
  const u = new URL(urlAutorizacao({ clientId: "c", redirectUri: "https://x.test/cb", state: "s", loginHint: "a&scope=drive b" }));
  assert.equal(u.searchParams.get("login_hint"), null);
});

test("id_token: lê sub e e-mail; recusa lixo", () => {
  assert.deepEqual(lerIdToken(idToken({ sub: "9", email: "A@B.co", email_verified: true })), { sub: "9", email: "a@b.co", emailVerificado: true });
  for (const x of [undefined, "", "a.b", idToken({ sub: "", email: "a@b.co" }), idToken({ sub: "1", email: "sem-arroba" })]) assert.equal(lerIdToken(x), null);
});

test("troca de código: caminho feliz devolve tokens, e-mail em minúsculas e validade", async () => {
  let corpoEnviado = "";
  const f = (async (_u: string, init?: RequestInit) => { corpoEnviado = String(init?.body); return resp(bom()); }) as typeof fetch;
  const t = await trocarCodigo(cli, "codigo", f, 1_000_000);
  assert.ok(t);
  assert.equal(t!.email, "lojista@exemplo.com");
  assert.equal(t!.sub, "123");
  assert.equal(t!.expiraEm.getTime(), 1_000_000 + 3599 * 1000);
  assert.match(corpoEnviado, /grant_type=authorization_code/);
});

test("troca de código recusa: sem refresh token, sem drive.file, e-mail não verificado, HTTP de erro, validade absurda", async () => {
  const casos: Record<string, Record<string, unknown>> = {
    semRefresh: { ...bom(), refresh_token: undefined },
    semDrive: { ...bom(), scope: "openid email" },
    naoVerificado: { ...bom(), id_token: idToken({ sub: "1", email: "a@b.co", email_verified: false }) },
    semIdToken: { ...bom(), id_token: undefined },
    validadeAbsurda: { ...bom(), expires_in: 99_999_999 },
  };
  for (const [nome, corpo] of Object.entries(casos)) assert.equal(await trocarCodigo(cli, "c", (async () => resp(corpo)) as typeof fetch), null, nome);
  assert.equal(await trocarCodigo(cli, "c", (async () => resp({ error: "invalid_grant" }, 400)) as typeof fetch), null);
  assert.equal(await trocarCodigo(cli, "c", (async () => { throw new Error("rede"); }) as typeof fetch), null);
});

test("renovação: devolve novo access; recusa de revogado vira null", async () => {
  const ok = await renovarAccess(cli, "REFRESH", (async () => resp({ access_token: "NOVO", expires_in: 3000 })) as typeof fetch, 5_000);
  assert.equal(ok?.access, "NOVO");
  assert.equal(ok?.expiraEm.getTime(), 5_000 + 3_000_000);
  assert.equal(await renovarAccess(cli, "REFRESH", (async () => resp({ error: "invalid_grant" }, 400)) as typeof fetch), null);
});

test("revogação: 200 e 400 (já inválido) contam como sem acesso; falha de rede não", async () => {
  assert.equal(await revogar("t", (async () => resp({})) as typeof fetch), true);
  assert.equal(await revogar("t", (async () => resp({ error: "invalid_token" }, 400)) as typeof fetch), true);
  assert.equal(await revogar("t", (async () => resp({}, 500)) as typeof fetch), false);
  assert.equal(await revogar("t", (async () => { throw new Error("rede"); }) as typeof fetch), false);
});

test("cliente do ambiente exige os três valores", () => {
  const env: Record<string, string> = { GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", GOOGLE_REDIRECT_URI: "https://x.test/cb" };
  assert.deepEqual(clienteDoAmbiente((n) => env[n]), { clientId: "a", clientSecret: "b", redirectUri: "https://x.test/cb" });
  for (const faltando of Object.keys(env)) assert.equal(clienteDoAmbiente((n) => (n === faltando ? undefined : env[n])), undefined);
});
