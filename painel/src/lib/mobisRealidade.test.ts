import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

// Guardas de integridade do piloto: nao simulam integracao com Bling e nao liberam vendas.
// Validam que o frontend nunca substitui dados institucionais nao aprovados por valores fixos.
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

test("Mobis: dados empresariais somente do endpoint com politicas aprovadas", () => {
  const publico = ler("lib/publicoLoja.ts");
  const rodape = ler("componentes/RodapeLoja.tsx");
  const endpoint = readFileSync(resolve(raiz, "../../supabase/functions/loja-publica/index.ts"), "utf8");

  assert.doesNotMatch(publico, /\b(?:razao|cnpj|endereco|mapas)\s*:/);
  assert.doesNotMatch(rodape, /MOBIS\.(?:razao|cnpj|endereco|mapas)/);
  assert.match(rodape, /politicas\?\.razao_social\?\.trim\(\)/);
  assert.match(rodape, /politicas\?\.cnpj\?\.trim\(\)/);
  assert.match(rodape, /politicas\?\.endereco\?\.trim\(\)/);
  assert.match(rodape, /mapaAprovado\s*=\s*endereco\s*\?/);
  assert.match(endpoint, /\.eq\("status", "aprovada"\)/);
  assert.match(rodape, /Identifica\u00e7\u00e3o empresarial ainda n\u00e3o homologada/);
});

test("Mobis: consulta publica limpa respostas anteriores e nao inventa catalogo", () => {
  const loja = ler("paginas/LojaMobisNova.tsx");
  assert.match(loja, /setDados\(null\);setEstado\("carregando"\)/);
  assert.match(loja, /setEstado\("erro"\)/);
  assert.match(loja, /dados\?\.produtos\.length===0/);
  assert.match(loja, /LOJA TESTE/);
});

test("Demonstra\u00e7\u00e3o de produtos fica isolada do build de produ\u00e7\u00e3o", () => {
  const modo = ler("lib/modo.ts");
  const app = ler("App.tsx");
  assert.match(modo, /import\.meta\.env\.DEV/);
  assert.match(app, /const demoAtivo = import\.meta\.env\.DEV && DEMO/);
  assert.match(app, /if \(caminho === "\/demo\/vitrine" && import\.meta\.env\.DEV && DEMO\)/);
});
