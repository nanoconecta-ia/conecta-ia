// Gera extensao/dist (pasta pronta para "Carregar sem compactação" no Chrome/Edge). Sem rede, sem dependência nova:
// usa o esbuild que já vem com o Vite do painel.
import { build } from '../painel/node_modules/esbuild/lib/main.js';
import { cp, mkdir, rm } from 'node:fs/promises';
const raiz = new URL('./', import.meta.url).pathname, dist = raiz + 'dist/';
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
await build({ entryPoints: { servico: raiz + 'src/servico.ts', conteudo: raiz + 'src/conteudo.ts', painel: raiz + 'src/painel.ts' }, outdir: dist, bundle: true, format: 'iife', target: 'chrome116', logLevel: 'warning' });
for (const f of ['manifest.json', 'painel.html', 'painel.css']) await cp(raiz + f, dist + f);
console.log('extensao/dist pronta');
