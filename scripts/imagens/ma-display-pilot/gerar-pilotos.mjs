// Gera os 6 ícones-piloto MA Display (candidatos) + película de aço escovado (CSS) + prévia.
// NÃO altera maIcones.ts, banco, taxonomia ou preço. Estado: candidato (aguarda aprovação do lojista).
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const destSvg = resolve(aqui, '../../../painel/src/assets/ma-display-pilot');
mkdirSync(destSvg, { recursive: true });

// defs reutilizáveis (gradiente de aço + acento vermelho) — por SVG, autocontido.
const DEFS = `
  <defs>
    <linearGradient id="aco" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F2F6F8"/><stop offset=".45" stop-color="#C4C9CD"/>
      <stop offset=".75" stop-color="#8A9196"/><stop offset="1" stop-color="#4C5257"/>
    </linearGradient>
    <linearGradient id="grafite" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A4149"/><stop offset="1" stop-color="#1F2327"/>
    </linearGradient>
    <linearGradient id="vermelho" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F23B3D"/><stop offset="1" stop-color="#B9141A"/>
    </linearGradient>
  </defs>`;

const S = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#14181B" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${DEFS}${inner}</svg>`;

// hélice (mola) — arcos alternados
const mola = (x, y, w, passos, h) => {
  let d = `M${x} ${y}`;
  for (let i = 0; i < passos; i++) {
    const yy = y - (i + 1) * h;
    d += ` a ${w/2} ${h*0.6} 0 0 1 ${w} ${-h*0.5} a ${w/2} ${h*0.6} 0 0 1 ${-w} ${-h*0.5}`;
  }
  return `<path d="${d}" fill="none" stroke="url(#vermelho)" stroke-width="3"/><path d="${d}" fill="none" stroke="#7a0d12" stroke-width="3.6" opacity=".25"/>`;
};

const ICONES = {
  motor: {
    rotulo: 'Motor', conceito: 'Bloco do motor (isométrico)',
    svg: S(`
      <!-- face frontal -->
      <path d="M14 30 L40 30 L40 50 L14 50 Z" fill="url(#grafite)"/>
      <!-- topo com bores -->
      <path d="M14 30 L22 22 L48 22 L40 30 Z" fill="url(#aco)"/>
      <!-- lado direito -->
      <path d="M40 30 L48 22 L48 42 L40 50 Z" fill="url(#aco)"/>
      <!-- bores no topo -->
      <ellipse cx="27" cy="26.5" rx="3.2" ry="1.6" fill="#1F2327" stroke="#F2F6F8" stroke-width="1"/>
      <ellipse cx="35" cy="26.5" rx="3.2" ry="1.6" fill="#1F2327" stroke="#F2F6F8" stroke-width="1"/>
      <!-- parafusos frontais -->
      <circle cx="17.5" cy="33" r="1" fill="#2b3137"/><circle cx="17.5" cy="47" r="1" fill="#2b3137"/>
      <circle cx="36.5" cy="33" r="1" fill="#2b3137"/><circle cx="36.5" cy="47" r="1" fill="#2b3137"/>
      <path d="M14 41 L40 41" stroke="#14181B" stroke-width="1"/>
      <!-- polia + correia (acento) -->
      <circle cx="47" cy="47" r="7" fill="url(#aco)"/><circle cx="47" cy="47" r="2.3" fill="#1F2327"/>
      <path d="M44 41 a 7 7 0 0 1 6 0" stroke="url(#vermelho)" stroke-width="2.4"/>`),
  },
  cabecote: {
    rotulo: 'Cabeçote', conceito: 'Cabeçote com molas de válvula',
    svg: S(`
      <path d="M12 34 L44 34 L44 48 L12 48 Z" fill="url(#grafite)"/>
      <path d="M12 34 L20 26 L52 26 L44 34 Z" fill="url(#aco)"/>
      <path d="M44 34 L52 26 L52 40 L44 48 Z" fill="url(#aco)"/>
      <!-- molas de válvula no topo -->
      <g stroke="#2b3137" stroke-width="1.4" fill="none">
        <path d="M24 30 q2 -1.5 4 0 M24 28.6 q2 -1.5 4 0 M24 27.2 q2 -1.5 4 0"/>
        <path d="M34 30 q2 -1.5 4 0 M34 28.6 q2 -1.5 4 0 M34 27.2 q2 -1.5 4 0"/>
      </g>
      <circle cx="26" cy="31.5" r="1" fill="url(#vermelho)"/><circle cx="36" cy="31.5" r="1" fill="url(#vermelho)"/>
      <!-- dutos laterais -->
      <circle cx="16" cy="41" r="2.4" fill="#1F2327" stroke="#F2F6F8" stroke-width="1"/>
      <circle cx="40" cy="41" r="2.4" fill="#1F2327" stroke="#F2F6F8" stroke-width="1"/>
      <path d="M12 41 L44 41" stroke="#14181B" stroke-width="1"/>`),
  },
  virabrequim: {
    rotulo: 'Virabrequim', conceito: 'Virabrequim (munhões e contrapesos)',
    svg: S(`
      <!-- eixo -->
      <path d="M8 32 L56 32" stroke="url(#aco)" stroke-width="5"/>
      <!-- munhões -->
      <g fill="url(#aco)" stroke="#14181B" stroke-width="1.2">
        <circle cx="16" cy="32" r="4.5"/><circle cx="32" cy="32" r="4.5"/><circle cx="48" cy="32" r="4.5"/>
      </g>
      <!-- contrapesos -->
      <path d="M22 28 q4 -9 8 0 l0 2 q-4 5 -8 0 Z" fill="url(#grafite)"/>
      <path d="M38 36 q4 9 -8 0 l0 -2 q4 -5 8 0 Z" fill="url(#grafite)" transform="translate(4 0)"/>
      <!-- flange -->
      <circle cx="54" cy="32" r="6" fill="url(#aco)" stroke="#14181B"/><circle cx="54" cy="32" r="1.6" fill="url(#vermelho)"/>
      <circle cx="16" cy="32" r="1.3" fill="#1F2327"/><circle cx="32" cy="32" r="1.3" fill="#1F2327"/><circle cx="48" cy="32" r="1.3" fill="#1F2327"/>`),
  },
  freios: {
    rotulo: 'Freios', conceito: 'Disco ventilado + pinça',
    svg: S(`
      <circle cx="30" cy="32" r="18" fill="url(#aco)" stroke="#14181B" stroke-width="1.4"/>
      <circle cx="30" cy="32" r="18" fill="none" stroke="#9aa0a5" stroke-width="2.4" opacity=".5"/>
      <circle cx="30" cy="32" r="8" fill="url(#grafite)" stroke="#14181B"/>
      <circle cx="30" cy="32" r="2.4" fill="#1F2327" stroke="#F2F6F8" stroke-width="1"/>
      <!-- furos de ventilação -->
      <g stroke="#2b3137" stroke-width="1.6">
        ${Array.from({length:12}).map((_,i)=>{const a=i/12*Math.PI*2;const x1=30+Math.cos(a)*11,y1=32+Math.sin(a)*11,x2=30+Math.cos(a)*15,y2=32+Math.sin(a)*15;return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`}).join('')}
      </g>
      <!-- pinça (acento) -->
      <path d="M44 24 q8 8 0 16 l-5 -2 q4 -6 0 -12 Z" fill="url(#vermelho)" stroke="#7a0d12"/>`),
  },
  suspensao: {
    rotulo: 'Suspensão', conceito: 'Amortecedor com mola helicoidal',
    svg: S(`
      <!-- torre/batente superior -->
      <ellipse cx="32" cy="12" rx="10" ry="3" fill="url(#aco)" stroke="#14181B"/>
      <path d="M30 13 L30 20 M34 13 L34 20" stroke="#2b3137" stroke-width="2"/>
      <!-- haste + corpo -->
      <path d="M32 18 L32 52" stroke="url(#aco)" stroke-width="4"/>
      <rect x="28.5" y="38" width="7" height="14" rx="2" fill="url(#grafite)" stroke="#14181B"/>
      <!-- mola -->
      ${mola(24, 50, 16, 7, 4.4)}
      <!-- olhal inferior -->
      <circle cx="32" cy="55" r="3.4" fill="url(#aco)" stroke="#14181B"/><circle cx="32" cy="55" r="1.3" fill="#1F2327"/>`),
  },
  injecao: {
    rotulo: 'Injeção', conceito: 'Bico injetor com leque de spray',
    svg: S(`
      <!-- conector elétrico -->
      <rect x="25" y="10" width="14" height="9" rx="2" fill="url(#grafite)" stroke="#14181B"/>
      <path d="M29 10 L29 7 M35 10 L35 7" stroke="#2b3137" stroke-width="2"/>
      <!-- corpo -->
      <path d="M26 19 L38 19 L36 40 L28 40 Z" fill="url(#aco)" stroke="#14181B"/>
      <path d="M27 25 L37 25 M27.4 31 L36.6 31" stroke="#9aa0a5" stroke-width="1.4"/>
      <!-- bico -->
      <path d="M30 40 L34 40 L33 46 L31 46 Z" fill="url(#grafite)" stroke="#14181B"/>
      <!-- spray (acento) -->
      <g stroke="url(#vermelho)" stroke-width="1.8">
        <path d="M32 47 L27 56"/><path d="M32 47 L32 57"/><path d="M32 47 L37 56"/>
      </g>`),
  },
};

// Película de aço escovado — CSS separado (overlay por cima do SVG, mix-blend).
const FILM_CSS = `/* Película de aço escovado MA Display — aplicada SEPARADAMENTE por CSS, por cima do ícone.
   Uso: <span class="ma-chip"><svg.../></span>  (a película é um ::after, não altera o SVG). */
.ma-chip{position:relative;display:inline-grid;place-items:center;width:72px;height:72px;border-radius:14px;
  background:linear-gradient(145deg,#30363d,#1b1f23);border:1px solid #3a4149;overflow:hidden}
.ma-chip>svg{position:relative;z-index:1;width:48px;height:48px}
.ma-chip::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:soft-light;opacity:.55;
  background:
    repeating-linear-gradient(115deg, rgba(255,255,255,.14) 0 1px, rgba(0,0,0,.10) 1px 2px),
    radial-gradient(120% 80% at 30% 15%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%);}
@media (prefers-reduced-motion: reduce){.ma-chip::after{opacity:.4}}`;

// grava os 6 SVGs + css + registro semântico
const registro = [];
for (const [id, def] of Object.entries(ICONES)) {
  writeFileSync(resolve(destSvg, `${id}.svg`), def.svg);
  registro.push({ id: `ma.${id}`, arquivo: `${id}.svg`, rotulo: def.rotulo, conceito: def.conceito, estado: 'candidato' });
}
writeFileSync(resolve(destSvg, 'pelicula-aco.css'), FILM_CSS);
writeFileSync(resolve(destSvg, 'registro.json'), JSON.stringify({ versao: '0.1.0-candidato', nota: 'Piloto MA Display DFT/EPC. Não homologado. Não altera maIcones.ts.', icones: registro }, null, 2));

// prévia (desktop + coluna 390px) para captura
const chip = (id, def, px) => `<figure><span class="ma-chip" style="width:${px}px;height:${px}px"><span class="svgwrap">${def.svg.replace('width="64" height="64"','width="'+Math.round(px*0.66)+'" height="'+Math.round(px*0.66)+'"')}</span></span><figcaption>${def.rotulo}<small>ma.${id}</small></figcaption></figure>`;
const linha = (px) => Object.entries(ICONES).map(([id,def])=>chip(id,def,px)).join('');
const prev = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
${FILM_CSS}
body{margin:0;background:#1F2327;color:#EAF2F6;font-family:system-ui,Segoe UI,Roboto,sans-serif;padding:26px}
h1{font-size:20px;border-bottom:2px solid #E2181A;padding-bottom:10px}
h1 b{color:#1C8DF2}
h2{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#A6A6A6;border-left:3px solid #E2181A;padding-left:9px;margin:26px 0 12px}
.row{display:flex;flex-wrap:wrap;gap:16px}
.col390{max-width:390px;border:1px dashed #3a4149;border-radius:12px;padding:14px}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:7px}
figcaption{font-size:12px;font-weight:700;display:flex;flex-direction:column;align-items:center;line-height:1.3}
figcaption small{font-weight:400;color:#A6A6A6;font-family:ui-monospace,monospace;font-size:10px}
.svgwrap{display:grid;place-items:center}
</style></head><body>
<h1>MOBIS · <b>MA Display</b> — 6 ícones-piloto (candidatos) · com película de aço escovado</h1>
<h2>Desktop (72 px)</h2><div class="row">${linha(72)}</div>
<h2>Mobile 390 px (ícone 52 px)</h2><div class="col390"><div class="row">${linha(52)}</div></div>
<p style="color:#A6A6A6;font-size:12px;margin-top:24px">Estado: <b style="color:#E2181A">candidato</b> — geometria proposta para aprovação do lojista. Não homologado, não publicado, não altera maIcones.ts/taxonomia/banco.</p>
</body></html>`;
writeFileSync(resolve(aqui, 'previa-pilotos.html'), prev);
console.log('OK: 6 SVGs +', 'pelicula-aco.css + registro.json + previa');
