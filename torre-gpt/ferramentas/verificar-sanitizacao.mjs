// Verifica se a pasta torre-gpt/ está SANITIZADA antes de ir para o GitHub (PEND-1, issue #178).
// Barra: segredos (Bearer, chaves, tokens, JWT), telefones, e-mails, tipos de arquivo que costumam carregar dados
// (imagens, exportações, logs, .env, chaves) e arquivos grandes. Nunca imprime o valor encontrado: só arquivo, linha,
// o tipo de achado e o tamanho. Uso: node torre-gpt/ferramentas/verificar-sanitizacao.mjs [pasta]
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXTENSOES_PERMITIDAS = new Set(['.js', '.mjs', '.json', '.html', '.css', '.md', '.svg']);
export const LIMITE_BYTES = 200 * 1024;
const PASTAS_IGNORADAS = new Set(['ferramentas', 'node_modules', '.git']);
const NOMES_PROIBIDOS = [/^\.env/i, /\.pem$/i, /\.key$/i, /\.pfx$/i, /\.har$/i, /cookies?/i, /history/i, /session/i];

const PADROES = [
  ['Bearer com valor', /Bearer\s+[A-Za-z0-9._~+/-]{16,}/],
  ['atribuição de segredo', /(api[_-]?key|secret|token|passw(or)?d|senha|cookie|authorization)["']?\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i],
  ['prefixo de chave conhecida', /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{20,}|xox[abp]-[A-Za-z0-9-]{10,})/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['string longa sem separador (possível chave)', /(?<![A-Za-z0-9_/.:-])[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_/.:-])/],
  ['telefone', /(\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/],
  ['e-mail', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]{2,}/],
];

const mascarar = (s) => `${s.slice(0, 3)}… (${s.length} caracteres)`;

async function listar(pasta, raiz) {
  const saida = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!PASTAS_IGNORADAS.has(e.name)) saida.push(...await listar(join(pasta, e.name), raiz)); }
    else saida.push(join(pasta, e.name));
  }
  return saida;
}

/** Devolve a lista de achados; vazia = sanitizada. */
export async function verificar(pasta) {
  const achados = [];
  for (const arq of await listar(pasta, pasta)) {
    const nome = relative(pasta, arq).split(sep).join('/');
    if (nome === 'README.md') continue;
    const base = nome.split('/').pop();
    if (NOMES_PROIBIDOS.some((r) => r.test(base))) { achados.push({ arquivo: nome, linha: 0, tipo: 'nome de arquivo proibido' }); continue; }
    if (!EXTENSOES_PERMITIDAS.has(extname(base).toLowerCase())) { achados.push({ arquivo: nome, linha: 0, tipo: `tipo de arquivo não permitido (${extname(base) || 'sem extensão'})` }); continue; }
    if ((await stat(arq)).size > LIMITE_BYTES) { achados.push({ arquivo: nome, linha: 0, tipo: 'arquivo maior que 200 KB' }); continue; }
    const linhas = (await readFile(arq, 'utf8')).split(/\r?\n/);
    linhas.forEach((texto, i) => {
      for (const [tipo, re] of PADROES) {
        const m = re.exec(texto);
        if (m) achados.push({ arquivo: nome, linha: i + 1, tipo, trecho: mascarar(m[0]) });
      }
    });
  }
  return achados;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pasta = process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url));
  const achados = await verificar(pasta);
  if (!achados.length) { console.log('Sanitização: nenhum achado. (Isto NÃO substitui a sua leitura dos arquivos antes de enviar.)'); process.exit(0); }
  for (const a of achados) console.error(`${a.arquivo}${a.linha ? `:${a.linha}` : ''}  ${a.tipo}${a.trecho ? `  → ${a.trecho}` : ''}`);
  console.error(`\n${achados.length} achado(s). Corrija ou remova antes de enviar.`);
  process.exit(1);
}
