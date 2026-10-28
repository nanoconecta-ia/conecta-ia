// Runner REAL do executor Browser: Chromium + Playwright, contexto NOVO e isolado (sem cookies, sem logins do dono).
// `rede(url)` devolve {status,headers,body} (fetch com redirect manual em produção); no teste, páginas fictícias servidas por interceptação (DOM e Chromium reais).
import { createRequire } from "node:module";
import { destinoPermitido } from "./guarda_rede.mjs";
const require = createRequire(new URL("../../painel/package.json", import.meta.url));
const { chromium } = require("playwright");

export function criarRunnerBrowser({ hostsPermitidos, rede, executablePath }) {
  const bloqueios = [];
  return {
    bloqueios,
    async executar(executor, comando, timeoutMs, sinal) {
      if (executor !== "browser") throw new Error("runner_so_browser");
      const [verbo, url] = String(comando).split(" ");
      if (verbo !== "ler") throw new Error("verbo_nao_suportado:" + verbo);
      const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
      const fechar = () => browser.close().catch(() => {});
      sinal.addEventListener("abort", fechar);
      try {
        const ctx = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block", permissions: [] });
        await ctx.route("**/*", async (route) => {
          const u = route.request().url();
          const d = destinoPermitido(u, hostsPermitidos);
          if (!d.ok) { bloqueios.push({ url: u, motivo: d.motivo }); return route.abort("blockedbyclient"); }
          // Redirecionamentos são seguidos AQUI (não pelo Chromium), para validar cada salto contra a guarda.
          let alvo = u;
          for (let salto = 0; salto < 5; salto++) {
            const r = await rede(alvo);
            if (r.status >= 300 && r.status < 400 && r.headers?.location) {
              alvo = new URL(r.headers.location, alvo).href;
              const dd = destinoPermitido(alvo, hostsPermitidos);
              if (!dd.ok) { bloqueios.push({ url: alvo, motivo: dd.motivo }); return route.abort("blockedbyclient"); }
              continue;
            }
            return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
          }
          bloqueios.push({ url: u, motivo: "redirecionamentos_demais" }); return route.abort("blockedbyclient");
        });
        const page = await ctx.newPage(); page.setDefaultTimeout(timeoutMs);
        const cookiesAntes = (await ctx.cookies()).length;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const titulo = await page.title();
        const texto = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").trim().slice(0, 2000);
        return { saida: JSON.stringify({ url: page.url(), titulo, texto, cookiesAntes, origem: "browser.chromium.isolado" }) };
      } finally { sinal.removeEventListener("abort", fechar); await fechar(); }
    },
  };
}
