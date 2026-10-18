// Usa o mesmo gerador determinístico validado do assistente. Não publica nada.
import { gerar, sha256 } from './gerar-autocontido.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const funcao of ['pair', 'conecta-gateway']) {
  const { codigo, manifesto } = await gerar(root, `supabase/functions/${funcao}/index.ts`);
  const pasta = new URL(`../artifacts/${funcao}/`, import.meta.url);
  for (const [nome, conteudo] of [['index.ts', codigo], ['manifesto.json', manifesto]]) {
    const path = new URL(nome, pasta);
    if (process.argv.includes('--check')) {
      if (await readFile(path, 'utf8') !== conteudo) throw Error(`Artefato desatualizado: ${funcao}/${nome}`);
    } else { await mkdir(pasta, {recursive:true}); await writeFile(path, conteudo); }
  }
  console.log(`${funcao}: ${sha256(codigo)}`);
}
