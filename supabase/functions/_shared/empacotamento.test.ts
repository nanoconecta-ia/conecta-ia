// O empacotador do deploy (supabase functions deploy --use-api) tratou um texto longo que começava com "\n" como se fosse um
// caminho de arquivo e falhou com ENAMETOOLONG (deploy do assistente, 04/11/2026). Isto só aparece no deploy, nunca nos testes locais.
// Regra: nenhum literal de texto longo começa com barra invertida. Use um literal que comece em caractere normal e acrescente "\n" ao usar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const LITERAL_LONGO_COM_BARRA = /(["'])\\[^"'\n]{200,}\1/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : arquivos(p);
    return /\.ts$/.test(n) && !/\.(test|d)\.ts$/.test(n) && !/\.testutil\.ts$/.test(n) ? [p] : [];
  });
}

test("o detector pega o texto que quebrou o deploy e deixa passar os curtos", () => {
  assert.ok(LITERAL_LONGO_COM_BARRA.test(`const x = "\\nMODO GRATUITO: ${"a".repeat(250)}";`));
  assert.ok(!LITERAL_LONGO_COM_BARRA.test('partes.join("\\n")'));
  assert.ok(!LITERAL_LONGO_COM_BARRA.test(`const x = "MODO GRATUITO: ${"a".repeat(250)}";`));
});

test("nenhuma função nem módulo compartilhado tem literal longo iniciado em barra invertida", () => {
  const raiz = new URL("..", import.meta.url).pathname; // supabase/functions
  const ruins = arquivos(raiz).filter((f) => LITERAL_LONGO_COM_BARRA.test(readFileSync(f, "utf8"))).map((f) => relative(raiz, f));
  assert.deepEqual(ruins, [], "texto longo começando com \\ quebra o empacotador do deploy; comece com caractere normal e acrescente a quebra de linha ao usar");
});
