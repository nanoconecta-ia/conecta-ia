import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { assinarEstado, verificarEstado } from "./estado.ts";
import { cifrar, decifrar } from "./cripto.ts";

const chave = randomBytes(32).toString("base64");

test("state: assina, verifica e rejeita adulteração, expiração e formato", async () => {
  const est = { l: "loja-1", u: "user-1", e: Date.now() + 60_000 };
  const t = await assinarEstado(est, "segredo");
  assert.deepEqual(await verificarEstado(t, "segredo"), est);
  assert.equal(await verificarEstado(t, "outro-segredo"), null);
  const [c, s] = t.split(".");
  assert.equal(await verificarEstado(`${c}x.${s}`, "segredo"), null);
  assert.equal(await verificarEstado(`${c}.${s}.extra`, "segredo"), null);
  assert.equal(await verificarEstado("lixo", "segredo"), null);
  assert.equal(await verificarEstado(t, "segredo", est.e + 1), null);
});

test("cripto: ida e volta com JWT longo, IV distinto, sem texto claro", async () => {
  const jwt = "a".repeat(3500);
  const c1 = await cifrar(jwt, chave);
  assert.equal(await decifrar(c1, chave), jwt);
  assert.notEqual(c1, await cifrar(jwt, chave));
  assert.ok(!c1.includes("aaaaaaaaaaaaaaaaaaaa"));
});

test("cripto: adulteração e chave errada falham", async () => {
  const c = await cifrar("x", chave);
  const p = c.split(".");
  p[3] = "AAAA";
  await assert.rejects(decifrar(p.join("."), chave));
  await assert.rejects(decifrar(c, randomBytes(32).toString("base64")));
  await assert.rejects(cifrar("x", undefined));
});

test("cripto: v1 legado do Node abre; o v2.kid.iv.tag.texto nosso abre no Node (AES-256-GCM)", async () => {
  const k = Buffer.from(chave, "base64");
  const iv = randomBytes(12);
  const ci = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([ci.update("segredo-node", "utf8"), ci.final()]);
  const valor = ["v1", iv.toString("base64url"), ci.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
  assert.equal(await decifrar(valor, chave), "segredo-node");
  const nosso = (await cifrar("segredo-deno", chave)).split(".");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(nosso[2], "base64url"));
  d.setAuthTag(Buffer.from(nosso[3], "base64url"));
  assert.equal(nosso[0], "v2");
  assert.equal(Buffer.concat([d.update(Buffer.from(nosso[4], "base64url")), d.final()]).toString(), "segredo-deno");
});
