// Taxonomia por lentes (issue #297): peças, veículos, marcas e fila sem classificação. Sessão e respostas SINTÉTICAS; nenhuma escrita (só GET/HEAD).
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../../", import.meta.url).pathname, painel = root + "painel/";
const require = createRequire(painel + "package.json"), { chromium } = require("playwright");
const port = 4219, base = `http://127.0.0.1:${port}`, ref = "dsfzhsrudriqkumtlqwj";
const lojaId = "aaaaaaaa-0000-0000-0000-000000000001", saida = process.env.SAIDA || root + "evidencias-chat/";
const no = (id, pai, nome, slug, ordem = 0) => ({ id, pai_id: pai, nome, slug, ordem });
const NOS = [
  no("r1", null, "Motor", "motor"), no("n1", "r1", "Bielas", "bielas"), no("n2", "r1", "Bombas de óleo", "bombas-oleo"), no("n3", "r1", "Pistões", "pistoes"),
  no("r2", null, "Arrefecimento", "arrefecimento"), no("n4", "r2", "Bombas d'água", "bombas-agua"),
  no("r3", null, "Suspensão e direção", "suspensao-direcao"), no("n5", "r3", "Bandejas", "bandejas"), no("n6", "n5", "Bandeja superior", "bandeja-superior"),
  no("r4", null, "Freios", "freios"), no("r5", null, "Marcas e fabricantes", "marcas"), no("n7", "r5", "MANDO", "mando"),
  no("r6", null, "Veículos e aplicações", "veiculos"), no("r7", null, "Sem classificação", "sem-classificacao"),
];
const p = (i, sku, nome, noId, marca = null, situacao = "A") => ({ id: "p" + i, sku, nome, marca, situacao, publicado: false, taxonomia_no_id: noId });
const PRODUTOS = [
  p(1, "CI000016", "Bomba d'água TRIM GO HR/K2500 2.5 8V", "n4", "TRIM GO"), p(2, "CI000100", "Biela motor HR 2.5 16V D4CB", "n1", "TRIM GO"),
  p(3, "ENG-1645-05", "Turbina Mando HR/K2500 8V 4D56/D4BH", "r7"), p(4, "CI000220", "BANDEJA SUPERIOR LE K2500/K2700 C/ PIVO/BUCHA", "r7", "VIEMAR"),
  p(5, "CI000966", "BOMBA DAGUA HR/K2500/ 2.5 8V EURO III D4BH", "r7"), p(6, "PEA97980", "PEA97980 50 PISTAO C/ANEL", "r7", "MAHLE"),
  p(7, "10A1075C", "10A1075C CORREIA V", "r7", "DAYCO"), p(8, "CI000378", "BOMBA OLEO L200 HPE 2.5", "r7", null, "I"),
  p(9, "CI001051", "BIELA MOTOR HR/K2500 2.5 16V 13/ D4CB EURO V PINO 32MM", "r7"),
];
const TABELAS = {
  taxonomia_nos: NOS, produtos: PRODUTOS, bling_categoria_taxonomia: [{ bling_categoria_id: "1", taxonomia_no_id: "n4" }], bling_categorias: [{ bling_id: "1", nome: "Bombas", pai_bling_id: null }],
  montadoras: [{ id: "m1", nome: "Hyundai" }, { id: "m2", nome: "Kia" }, { id: "m3", nome: "Mitsubishi" }],
  modelos: [{ id: "a", montadora_id: "m1", nome: "HR" }, { id: "b", montadora_id: "m2", nome: "K2500" }, { id: "c", montadora_id: "m2", nome: "K2700" }, { id: "d", montadora_id: "m3", nome: "L200" }],
  motores: [{ id: "e1", codigo: "D4CB" }, { id: "e2", codigo: "D4BH" }, { id: "e3", codigo: "4D56" }],
};
const server = spawn(process.execPath, [painel + "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port)], { cwd: painel, stdio: "ignore" });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch({ headless: true });
  await mkdir(saida, { recursive: true });
  for (const [width, height, escala] of [[390, 844, 2], [1280, 900, 2]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: escala });
    const page = await ctx.newPage();
    const errors = [], escritas = [];
    page.on("pageerror", (err) => errors.push(err.message));
    const session = { access_token: "s.s.s", refresh_token: "s", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "11111111-1111-1111-1111-111111111111", aud: "authenticated", role: "authenticated", email: "demo@exemplo.invalid", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
    await page.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === "127.0.0.1") return route.continue();
      assert.ok(u.hostname.endsWith("supabase.co"), "Rede externa não autorizada no teste: " + u.hostname);
      const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range", "content-range": "0-0/0" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (u.pathname.includes("/rest/v1/") && !["GET", "HEAD"].includes(req.method())) escritas.push(req.method() + " " + u.pathname);
      const json = (b) => route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(b) });
      if (u.pathname.endsWith("/auth/v1/user")) return json(session.user);
      if (u.pathname.endsWith("/rest/v1/lojas")) return json([{ id: lojaId, nome: "Mobis DEMO", slug: "mobis-demo", ambiente: "teste", modo_venda: "whatsapp", perfil_ramo: "autopecas" }]);
      const tabela = u.pathname.split("/rest/v1/")[1];
      if (tabela && TABELAS[tabela]) return json(TABELAS[tabela]);
      return json(u.pathname.includes("/rest/v1/") ? [] : {});
    });
    await page.goto(base + "/#/taxonomia");
    await page.getByRole("heading", { name: "Taxonomia do catálogo" }).waitFor();
    assert.match(await page.locator(".tx-anel").getAttribute("aria-label"), /^22% /, "2 de 9 classificados");
    assert.equal(await page.locator(".tx-cartao").count(), 4, "só raízes de PEÇA viram cartão (marcas, veículos e fila ficam fora)");
    const semRolagem = async (nome) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `sem rolagem horizontal em ${width}px (${nome})`);
    await semRolagem("peças"); await page.screenshot({ path: saida + `taxonomia-pecas-${width}.png`, fullPage: true });
    await page.getByRole("tab", { name: /Veículos/ }).click();
    await page.getByText("Candidato pelo nome.").waitFor();
    assert.equal((await page.locator(".tx-montadora").first().locator("h2").innerText()).trim(), "Kia", "montadora mais citada primeiro");
    await semRolagem("veículos"); await page.screenshot({ path: saida + `taxonomia-veiculos-${width}.png`, fullPage: true });
    await page.getByRole("tab", { name: /Marcas/ }).click();
    await page.locator(".tx-rank-nome", { hasText: "Sem marca informada" }).waitFor(); await semRolagem("marcas");
    await page.getByRole("tab", { name: /Fila/ }).click();
    assert.equal(await page.locator(".tx-fila > li").count(), 6, "fila: 7 sem classificação, 6 ativos (inativo oculto por padrão)");
    const linha = (sku) => page.locator(".tx-fila > li", { hasText: sku });
    assert.match(await linha("CI000220").locator(".tx-fila-sug").innerText(), /Bandeja superior/, "nó mais específico");
    assert.match(await linha("CI000966").locator(".tx-fila-sug").innerText(), /Bombas d'água/);
    assert.match(await linha("10A1075C").locator(".tx-fila-sug").innerText(), /Sem sinal/, "sem sinal não inventa categoria");
    assert.match(await linha("ENG-1645-05").locator(".tx-fila-sug").innerText(), /Sem sinal/, "marca (MANDO) não vira categoria de peça");
    assert.equal(await linha("ENG-1645-05").locator(".tx-tag.tx-modelo").count(), 2, "HR e K2500 como sinais de veículo");
    await semRolagem("fila"); await page.screenshot({ path: saida + `taxonomia-fila-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Sem sinal" }).click();
    assert.equal(await page.locator(".tx-fila > li").count(), 2);
    assert.deepEqual(escritas, [], "nenhuma escrita");
    assert.deepEqual(errors, [], "sem erros JS");
    await ctx.close();
    console.log(`taxonomia-lentes ${width}px: ok (4 lentes, sugestão pelo nome, sem rolagem horizontal, zero escrita)`);
  }
} finally { await browser?.close(); server.kill(); }
