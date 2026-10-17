import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cifrar, decifrar } from "./cripto.ts";
import { obterAccessToken, renovarLoja, type Armazem, type CredCifrada } from "./bling_token.ts";
import { blingFetch } from "./bling_api.ts";
import { FERRAMENTAS, podeExecutar } from "./bling_ferramentas.ts";

const chave = randomBytes(32).toString("base64");
const cfgBase = { clientId: "cid", clientSecret: "csec", chaveCifra: chave, espera: async () => {} };
const AGORA = Date.parse("2026-10-18T12:00:00Z");

async function armazemFalso(expiraEmMin: number, reservaOcupada = false) {
  const estado = {
    cred: { access_token_cifrado: await cifrar("ACC-VELHO", chave), refresh_token_cifrado: await cifrar("REF-VELHO", chave),
            expira_em: new Date(AGORA + expiraEmMin * 60_000).toISOString() } as CredCifrada | null,
    reservado: reservaOcupada, liberacoes: 0, status: null as string | null, erro: null as string | null, salvos: 0,
  };
  const arm: Armazem = {
    ler: async () => estado.cred,
    reservar: async () => { if (estado.reservado) return false; estado.reservado = true; return true; },
    liberar: async () => { estado.reservado = false; estado.liberacoes++; },
    salvar: async (_l, a, r, e) => { estado.cred = { access_token_cifrado: a, refresh_token_cifrado: r, expira_em: e }; estado.reservado = false; estado.salvos++; },
    marcar: async (_l, s, e) => { estado.status = s; estado.erro = e; },
  };
  return { arm, estado };
}
const resp = (status: number, corpo: unknown = {}) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

test("não renova token que ainda vale (mais de 30 min)", async () => {
  const { arm } = await armazemFalso(120);
  let chamou = false;
  const r = await renovarLoja(arm, "L", { ...cfgBase, agora: () => AGORA, fetch: (async () => { chamou = true; return resp(200); }) as typeof fetch });
  assert.equal(r, "ja_valida"); assert.equal(chamou, false);
});

test("renova perto de vencer: usa o refresh antigo, guarda os dois tokens novos cifrados e usa enable-jwt", async () => {
  const { arm, estado } = await armazemFalso(10);
  let visto: { headers: Record<string, string>; body: string } | null = null;
  const f = (async (_u: string, init: RequestInit) => { visto = { headers: init.headers as Record<string, string>, body: String(init.body) }; return resp(200, { access_token: "ACC-NOVO", refresh_token: "REF-NOVO", expires_in: 21600 }); }) as typeof fetch;
  const r = await renovarLoja(arm, "L", { ...cfgBase, agora: () => AGORA, fetch: f });
  assert.equal(r, "renovada");
  assert.equal(visto!.headers["enable-jwt"], "1");
  assert.match(visto!.body, /grant_type=refresh_token/); assert.match(visto!.body, /refresh_token=REF-VELHO/);
  assert.equal(await decifrar(estado.cred!.access_token_cifrado, chave), "ACC-NOVO");
  assert.equal(await decifrar(estado.cred!.refresh_token_cifrado, chave), "REF-NOVO");
  assert.equal(estado.cred!.expira_em, new Date(AGORA + 21600_000).toISOString());
  assert.ok(!JSON.stringify(estado.cred).includes("ACC-NOVO"), "nada em texto claro");
});

test("refresh inválido (400/401) => expirada com mensagem de reconectar, sem apagar nada e liberando a reserva", async () => {
  const { arm, estado } = await armazemFalso(10);
  const r = await renovarLoja(arm, "L", { ...cfgBase, agora: () => AGORA, fetch: (async () => resp(400, { error: "invalid_grant" })) as typeof fetch });
  assert.equal(r, "reconectar"); assert.equal(estado.status, "expirada"); assert.match(estado.erro!, /Reconecte/);
  assert.equal(estado.reservado, false);
});

test("erro de rede ou 5xx => falha temporária: não marca expirada e libera a reserva (refresh ainda vale)", async () => {
  for (const f of [(async () => { throw new Error("rede"); }) as typeof fetch, (async () => resp(503)) as typeof fetch]) {
    const { arm, estado } = await armazemFalso(10);
    const r = await renovarLoja(arm, "L", { ...cfgBase, agora: () => AGORA, fetch: f });
    assert.equal(r, "falha_temporaria"); assert.equal(estado.status, null); assert.equal(estado.reservado, false);
  }
});

test("reserva ocupada: não chama o Bling em paralelo; se o token novo chega, devolve outra_renovacao", async () => {
  const { arm, estado } = await armazemFalso(10, true);
  let chamadas = 0;
  let n = 0;
  const esperaTroca = async () => { if (++n === 2) estado.cred = { ...estado.cred!, refresh_token_cifrado: await cifrar("REF-DE-OUTRA", chave) }; };
  const r = await renovarLoja(arm, "L", { ...cfgBase, espera: esperaTroca, agora: () => AGORA, fetch: (async () => { chamadas++; return resp(200); }) as typeof fetch });
  assert.equal(r, "outra_renovacao"); assert.equal(chamadas, 0);
});

test("obterAccessToken devolve o novo token após renovar, e null se precisar reconectar", async () => {
  const a = await armazemFalso(5);
  const ok = await obterAccessToken(a.arm, "L", { ...cfgBase, agora: () => AGORA, fetch: (async () => resp(200, { access_token: "ACC-NOVO", refresh_token: "REF-NOVO", expires_in: 21600 })) as typeof fetch });
  assert.equal(ok, "ACC-NOVO");
  const b = await armazemFalso(5);
  assert.equal(await obterAccessToken(b.arm, "L", { ...cfgBase, agora: () => AGORA, fetch: (async () => resp(401)) as typeof fetch }), null);
});

test("blingFetch: enable-jwt, 401 renova uma vez e repete, 429/5xx recua só em leitura, escrita nunca repete", async () => {
  const { arm } = await armazemFalso(300);
  const vistos: Array<{ url: string; auth: string; jwt: string }> = [];
  let seq = [401, 200];
  const f = (async (u: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    if (u.includes("/oauth/token")) return resp(200, { access_token: "ACC-NOVO", refresh_token: "REF-NOVO", expires_in: 21600 });
    vistos.push({ url: u, auth: h.Authorization, jwt: h["enable-jwt"] });
    return resp(seq.shift() ?? 200);
  }) as typeof fetch;
  const r1 = await blingFetch(arm, "L", "/produtos", { ...cfgBase, agora: () => AGORA, fetch: f });
  assert.equal(r1.status, 200); assert.equal(vistos.length, 2);
  assert.equal(vistos[0].auth, "Bearer ACC-VELHO"); assert.equal(vistos[1].auth, "Bearer ACC-NOVO");
  assert.ok(vistos.every((v) => v.jwt === "1" && v.url.startsWith("https://api.bling.com.br/Api/v3/")));

  const a2 = await armazemFalso(300);
  let n = 0;
  const f2 = (async () => { n++; return resp(n < 3 ? 503 : 200); }) as typeof fetch;
  assert.equal((await blingFetch(a2.arm, "L", "/produtos", { ...cfgBase, agora: () => AGORA, fetch: f2 })).status, 200);
  assert.equal(n, 3);

  const a3 = await armazemFalso(300);
  let m = 0;
  const f3 = (async () => { m++; return resp(503); }) as typeof fetch;
  assert.equal((await blingFetch(a3.arm, "L", "/produtos", { ...cfgBase, agora: () => AGORA, fetch: f3 }, { metodo: "POST", corpo: { x: 1 } })).status, 503);
  assert.equal(m, 1, "escrita não é repetida às cegas");
});

test("blingFetch recusa caminho que não é da API v3 (sem URL livre)", async () => {
  const { arm } = await armazemFalso(300);
  for (const c of ["https://evil.com/x", "//evil.com", "produtos", "/produtos/../x?"])
    await assert.rejects(() => blingFetch(arm, "L", c, { ...cfgBase, agora: () => AGORA, fetch: (async () => resp(200)) as typeof fetch }));
});

test("catálogo: leitura ativa; escrita desligada, com aprovação e idempotency_key; nada de DELETE nem emissão/envio de nota", () => {
  for (const f of FERRAMENTAS) {
    assert.equal(f.conferido, false, "nada conferido na documentação ainda");
    if (f.metodo === "GET") { assert.equal(f.risco, "LOW"); assert.equal(f.ativa, true); }
    else { assert.equal(f.ativa, false); assert.equal(f.exigeAprovacao, true); assert.equal(f.exigeIdempotencyKey, true); assert.equal(f.retry, "nenhum"); assert.notEqual(f.risco, "LOW"); }
    assert.ok(!/enviar|emitir|autorizar/i.test(f.caminho + f.nome));
    assert.notEqual((f.metodo as string), "DELETE");
  }
  assert.equal(podeExecutar(FERRAMENTAS.find((f) => f.nome === "bling.produtos.listar")!, null).ok, true);
  const w = FERRAMENTAS.find((f) => f.nome === "bling.produtos.criar")!;
  assert.equal(podeExecutar(w, "apr-1").ok, false, "desligada mesmo com aprovação");
  assert.equal(podeExecutar({ ...w, ativa: true }, null).ok, false, "ligada mas sem aprovação");
  assert.equal(podeExecutar({ ...w, ativa: true }, "apr-1").ok, true);
});
