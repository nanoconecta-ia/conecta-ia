import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config separada: não modifica o build atual do GitHub Pages.
// Não copia painel/public e não empacota o App com as credenciais públicas de produção.
export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: "dist-homologacao",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./homologacao.html", import.meta.url)),
    },
  },
});
