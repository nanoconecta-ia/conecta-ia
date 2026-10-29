import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarDadosTecnicos } from "./google.ts";

const fake = (status: number, items: unknown[] = []) => async () =>
  new Response(JSON.stringify({ items }), { status });

test("busca técnica retorna fontes e exclui links HTTP", async () => {
  const r = await buscarDadosTecnicos("key", "cx", "82892 junta", fake(200, [
    { title: "Catálogo", link: "https://fabricante.example/82892", snippet: "referência a confirmar", displayLink: "fabricante.example" },
    { title: "Inseguro", link: "http://outro.example/82892" },
  ]) as typeof fetch);
  assert.equal(r.length, 1);
  assert.equal(r[0].fonte, "fabricante.example");
  assert.equal(r[0].pagina, "https://fabricante.example/82892");
});

test("busca técnica rejeita consulta curta", async () => {
  await assert.rejects(buscarDadosTecnicos("key", "cx", "x", fake(200) as typeof fetch), /3 caracteres/);
});

test("busca técnica identifica credenciais e cota", async () => {
  await assert.rejects(buscarDadosTecnicos("key", "cx", "82892", fake(403) as typeof fetch), /Credencial/);
  await assert.rejects(buscarDadosTecnicos("key", "cx", "82892", fake(429) as typeof fetch), /Limite/);
});

test("busca técnica utiliza pesquisa textual, não imagens", async () => {
  let url = "";
  await buscarDadosTecnicos("key", "cx", "junta 82892", (async (u: string | URL) => {
    url = String(u);
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  }) as typeof fetch);
  assert.equal(new URL(url).searchParams.get("q"), "junta 82892");
  assert.equal(new URL(url).searchParams.get("searchType"), null);
});
