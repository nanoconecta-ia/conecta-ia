import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: funciona em qualquer subcaminho do GitHub Pages (ex.: /conecta-ia/).
export default defineConfig({ base: "./", plugins: [react()] });
