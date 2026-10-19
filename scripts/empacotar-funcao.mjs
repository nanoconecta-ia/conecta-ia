#!/usr/bin/env node
// Gera UM arquivo autocontido para uma Edge Function (sem imports relativos) a partir da fonte modular.
// Motivo: o bundler de deploy do Supabase falhou de forma intermitente com "Module not found" em deploys multi-arquivo
// (visto em assistente e bling-sync). O deploy usa o arquivo gerado; a fonte modular continua sendo a verdade.
// Uso: node scripts/empacotar-funcao.mjs <nome-da-funcao> [saida.ts]
// Requer o esbuild (já presente em painel/node_modules). NÃO faz deploy: só gera o arquivo e confere que ficou autocontido.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(raiz, "painel/package.json"));
const esbuild = require("esbuild");
const nome = process.argv[2];
if (!nome || !/^[a-z0-9-]+$/.test(nome)) { console.error("Uso: node scripts/empacotar-funcao.mjs <nome-da-funcao> [saida.ts]"); process.exit(2); }
const entrada = resolve(raiz, "supabase/functions", nome, "index.ts");
const saida = resolve(process.argv[3] ?? resolve(raiz, "dist-funcoes", nome, "index.ts"));

const r = await esbuild.build({
  entryPoints: [entrada], bundle: true, format: "esm", platform: "neutral", target: "es2022", write: false, legalComments: "none",
  external: ["npm:*", "jsr:*", "node:*"], logLevel: "silent", charset: "utf8", mainFields: ["module", "main"], keepNames: true,
});
let codigo = r.outputFiles[0].text;
const cabecalho = `// ARQUIVO GERADO por scripts/empacotar-funcao.mjs a partir de supabase/functions/${nome}/index.ts. Não edite: edite a fonte modular e gere de novo.\n// Autocontido (sem imports relativos) para contornar a falha intermitente do bundler de deploy multi-arquivo do Supabase.\n`;
codigo = cabecalho + codigo;
const relativos = [...codigo.matchAll(/^\s*(?:import|export)\s[^'"]*from\s*["'](\.{1,2}\/[^"']+)["']/gm)];
if (relativos.length) { console.error("Ainda há imports relativos:", relativos.map((m) => m[1])); process.exit(1); }
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, codigo);
console.log(`ok: ${saida} (${(codigo.length / 1024).toFixed(1)} KB, ${codigo.split("\n").length} linhas, sem imports relativos)`);
