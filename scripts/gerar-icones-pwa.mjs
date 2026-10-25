// Gera os ícones do app instalável (PNG) a partir do símbolo "conecta" do sprite do painel. Reproduzível: node scripts/gerar-icones-pwa.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url).pathname, painel = root + 'painel/';
const require = createRequire(painel + 'package.json'), { chromium } = require('playwright');
const sprite = await readFile(painel + 'src/assets/sprite-icones.svg', 'utf8');
const usar = (id) => { const gs = new Set(); const sym = sprite.match(new RegExp(`<symbol[^>]*id="${id}"[^>]*>([\\s\\S]*?)</symbol>`))[1]; for (const m of sym.matchAll(/url\(#([a-z0-9]+)\)/g)) gs.add(m[1]); return { sym, gs }; };
const { sym, gs } = usar('conecta');
const defs = [...gs].map((g) => { const m = sprite.match(new RegExp(`<(linearGradient|radialGradient|clipPath|filter)\\b[^>]*id="${g}"[\\s\\S]*?</\\1>`)); if (!m) throw Error('definição não encontrada: ' + g); return m[0]; }).join('');
const FUNDO = '#1D1B18'; // grafite da marca
// `margem` = fração de respiro ao redor do símbolo (maskable precisa de zona segura de ~20%)
const svg = (px, margem) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><defs>${defs}</defs><rect width="${px}" height="${px}" fill="${FUNDO}"/><svg x="${px * margem}" y="${px * margem}" width="${px * (1 - 2 * margem)}" height="${px * (1 - 2 * margem)}" viewBox="0 0 64 64">${sym}</svg></svg>`;
await mkdir(painel + 'public/icones', { recursive: true });
const b = await chromium.launch(); const p = await b.newPage();
for (const [arq, px, margem] of [['icone-192.png', 192, 0.08], ['icone-512.png', 512, 0.08], ['icone-maskable-512.png', 512, 0.22], ['apple-touch-icon.png', 180, 0.08]]) {
  await p.setViewportSize({ width: px, height: px });
  await p.setContent(`<body style="margin:0">${svg(px, margem)}</body>`);
  await writeFile(painel + 'public/icones/' + arq, await p.screenshot({ type: 'png', clip: { x: 0, y: 0, width: px, height: px } }));
}
await b.close(); console.log('ícones gerados em painel/public/icones');
