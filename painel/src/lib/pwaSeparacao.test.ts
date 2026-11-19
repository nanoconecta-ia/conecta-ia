import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), "utf8");

test("dois aplicativos PWA com identidades e entradas distintas", () => {
  const mobis = JSON.parse(ler("../../public/mobis.webmanifest"));
  const conecta = JSON.parse(ler("../../public/manifest.webmanifest"));
  assert.notEqual(mobis.id, conecta.id);
  assert.equal(mobis.start_url, "./");
  assert.equal(mobis.scope, "./");
  assert.equal(conecta.start_url, "./conecta.html#/");
  assert.equal(conecta.scope, "./conecta.html");
  assert.match(ler("../../index.html"), /mobis\.webmanifest/);
  assert.match(ler("../../conecta.html"), /manifest\.webmanifest/);
});

test("workers segregam caches e nao reiniciam ou apagam outras janelas", () => {
  const store = ler("../../public/sw.js");
  const admin = ler("../../public/sw-conecta.js");
  const boot = ler("../main.tsx");
  const atualizar = ler("../componentes/AvisoVersao.tsx");
  assert.match(store, /mobis-loja-casca-v/);
  assert.match(admin, /conecta-admin-casca-v/);
  assert.doesNotMatch(store, /manifest\.webmanifest|clients\.matchAll|clients\.navigate/);
  assert.doesNotMatch(admin, /mobis\.webmanifest|clients\.matchAll|clients\.navigate/);
  assert.match(boot, /\.\/sw-conecta\.js/);
  assert.match(boot, /scope = painel \? "\.\/conecta\.html" : "\.\/"/);
  assert.match(atualizar, /k\.startsWith\("conecta-admin-casca-"\)/);
  assert.doesNotMatch(atualizar, /\(regs \?\? \[\]\)\.map\(\(r\) => r\.unregister\(\)\)/);
});
