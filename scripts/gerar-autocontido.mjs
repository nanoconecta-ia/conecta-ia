// Node 24.19.0. Sem rede, dependências npm, credenciais ou publicação.
// O parser TS é o do Node; o linker ESM do V8 confere imports e exports antes da transformação.
// Suporta o subconjunto usado neste grafo: imports nomeados, reexports nomeados,
// exports const/function/class. Ciclos, import dinâmico, default, namespace e live bindings mutáveis falham.
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SDK = 'npm:@supabase/supabase-js@2.117.3';
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const pares = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const m = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(x);
  if (!m) throw new Error('Import/export não suportado: ' + x);
  return [m[1], m[2] ?? m[1]];
});

export async function gerar(root, entry = 'supabase/functions/assistente/index.ts') {
  root = await realpath(root);
  const modules = new Map(), ordem = [], pilha = new Set();
  const externo = new SyntheticModule(['createClient'], function () { this.setExport('createClient', () => { throw Error('somente validação'); }); });
  async function ler(path) {
    path = await realpath(path);
    if (!path.startsWith(root + sep)) throw Error('Import fora do projeto.');
    if (pilha.has(path)) throw Error('Dependência circular: ' + relative(root, path));
    if (modules.has(path)) return modules.get(path);
    pilha.add(path);
    const fonte = await readFile(path, 'utf8');
    const js = stripTypeScriptTypes(fonte, { mode: 'transform' });
    if (/\bimport\s*\(|\bimport\.meta/.test(js)) throw Error('Import dinâmico/import.meta não suportado.');
    const m = { path, fonte, js, deps: new Map(), id: '__m' + modules.size, vm: new SourceTextModule(js, { identifier: path }) };
    modules.set(path, m);
    for (const { specifier } of m.vm.moduleRequests) {
      if (specifier === SDK) { m.deps.set(specifier, null); continue; }
      if (!specifier.startsWith('.')) throw Error('Import externo não permitido: ' + specifier);
      m.deps.set(specifier, await ler(resolve(dirname(path), specifier)));
    }
    pilha.delete(path); ordem.push(m); return m;
  }
  const entrada = await ler(resolve(root, entry));
  await entrada.vm.link((specifier, ref) => modules.get(ref.identifier).deps.get(specifier)?.vm ?? externo);
  const secoes = ordem.map((m) => {
    const exportados = new Map();
    const decl = (bindings, spec, reexport = false) => {
      if (!m.deps.has(spec)) throw Error('Dependência não reconhecida: ' + spec);
      const dep = m.deps.get(spec)?.id ?? '__sdk';
      const p = pares(bindings);
      if (reexport) p.forEach(([orig, dest]) => exportados.set(dest, `${dep}.${orig}`));
      return reexport ? '' : `const { ${p.map(([orig, dest]) => `${orig}: ${dest}`).join(', ')} } = ${dep};`;
    };
    let corpo = m.js.replace(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/gm, (_, b, spec) => decl(b, spec));
    corpo = corpo.replace(/^export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/gm, (_, b, spec) => decl(b, spec, true));
    corpo = corpo.replace(/^export\s*\{([^}]+)\};?/gm, (_, b) => { pares(b).forEach(([orig, dest]) => exportados.set(dest, orig)); return ''; });
    corpo = corpo.replace(/^export\s+((?:async\s+)?function|class|const)\s+([\w$]+)/gm, (_, tipo, nome) => {
      exportados.set(nome, nome); return `${tipo} ${nome}`;
    });
    const esperados = Reflect.ownKeys(m.vm.namespace).filter((k) => typeof k === 'string').sort();
    if (JSON.stringify(esperados) !== JSON.stringify([...exportados.keys()].sort())) throw Error('Exports não suportados em ' + m.path);
    const valores = [...exportados].map(([k, v]) => `${k}: ${v}`).join(', ');
    return `// ---------- ${relative(root, m.path).split(sep).join('/')} ----------\nconst ${m.id} = (() => {\n${corpo}\nreturn { ${valores} };\n})();`;
  });
  const codigo = `// GERADO por scripts/gerar-autocontido.mjs. Não editar. Nenhuma publicação autorizada.\nimport { createClient } from '${SDK}';\nconst __sdk = { createClient };\n\n${secoes.join('\n\n')}\n`;
  const validacao = new SourceTextModule(codigo);
  if (validacao.moduleRequests.length !== 1 || validacao.moduleRequests[0].specifier !== SDK) throw Error('Artefato contém imports adicionais.');
  const manifesto = JSON.stringify({ versao: 1, entrada: entry, externo: SDK, artefato_sha256: sha256(codigo), fontes: ordem.map((m) => ({ path: relative(root, m.path).split(sep).join('/'), sha256: sha256(m.fonte) })) }, null, 2) + '\n';
  return { codigo, manifesto };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { codigo, manifesto } = await gerar(root);
  const saida = resolve(root, 'artifacts/assistente');
  for (const [nome, conteudo] of [['index.ts', codigo], ['manifesto.json', manifesto]]) {
    const path = resolve(saida, nome);
    if (process.argv.includes('--check')) {
      if (await readFile(path, 'utf8') !== conteudo) throw Error('Artefato desatualizado: ' + nome);
    } else { await mkdir(saida, { recursive: true }); await writeFile(path, conteudo); }
  }
  console.log('Autocontido validado: ' + sha256(codigo));
}
