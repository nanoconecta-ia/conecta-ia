import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const html = (nome: string) => readFileSync(resolve(raiz, nome), "utf8");
const paginas = ["institucional.html", "privacidade.html", "termos.html", "seguranca.html", "contato.html"];

test("páginas públicas têm navegação interna, título, idioma, descrição e acesso a privacidade", () => {
  for (const pagina of paginas) {
    const texto = html(pagina);
    assert.match(texto, /<html lang="pt-BR">/);
    assert.match(texto, /<title>[^<]+Conecta\.IA<\/title>/);
    assert.match(texto, /name="description" content="[^"]{30,}"/);
    assert.match(texto, /href="\.\/privacidade\.html"/);
    assert.match(texto, /href="\.\/termos\.html"/);
    assert.match(texto, /href="\.\/contato\.html"/);
    assert.match(texto, /href="\.\/site-publico\.css"/);
    assert.match(texto, /href="#conteudo"/);
    assert.doesNotMatch(texto, /<script\b|<iframe\b|<form\b/i);
    assert.doesNotMatch(texto, /SUPABASE_SERVICE_ROLE|sb_secret_|api\.bling\.com\.br|dsfzhsrudriqkumtlqwj/);
  }
});

test("a apresentação não é uma landing de redirecionamento vazio", () => {
  const home = html("institucional.html");
  assert.match(home, /Catálogo técnico/);
  assert.match(home, /Revisão humana/);
  assert.match(home, /projeto-piloto|validação piloto/i);
  assert.match(home, /href="\.\/index\.html#\/entrar"/);
  assert.doesNotMatch(home, /Google (Aprovad|Verified)|SOC ?2 certificado/i);
});

test("privacidade explica dados, autenticação, terceiros e contato", () => {
  const politica = html("privacidade.html");
  for (const palavra of ["Supabase Auth", "Google", "LGPD", "dados", "terceiros", "WhatsApp"]) {
    assert.ok(politica.includes(palavra), "faltou item: " + palavra);
  }
});

test("o painel privado permanece marcado como noindex", () => {
  const painel = readFileSync(resolve(raiz, "../index.html"), "utf8");
  assert.match(painel, /name="robots" content="noindex"/);
});

test("links institucionais continuam no mesmo diretório e usam URLs reais", () => {
  for (const p of paginas) {
    const t = html(p);
    const achados = [...t.matchAll(/href="\.\/([a-z-]+\.html)"/g)];
    for (const [, alvo] of achados) {
      assert.ok(paginas.includes(alvo) || alvo === "index.html", "link não permitido: " + alvo);
    }
  }
});
