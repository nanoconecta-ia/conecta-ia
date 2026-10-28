import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Identifica a versão publicada: commit do GitHub Actions (ou "local") e hora do build. O painel mostra isso na tela e compara com version.json.
const COMMIT = (process.env.GITHUB_SHA ?? "local").slice(0, 7);
const CONSTRUIDO = new Date().toISOString();
const emitirVersao = (): Plugin => ({
  name: "emitir-version-json",
  generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ commit: COMMIT, construido: CONSTRUIDO }) }); },
});

// base relativa: funciona em qualquer subcaminho do GitHub Pages (ex.: /conecta-ia/).
export default defineConfig({
  base: "./",
  plugins: [react(), emitirVersao()],
  define: { __COMMIT__: JSON.stringify(COMMIT), __CONSTRUIDO__: JSON.stringify(CONSTRUIDO) },
});
