import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarImagens } from "./google.ts";
import { IaErro } from "./tipos.ts";

test("buscarImagens: monta a URL certa e filtra resultados não https", async () => {
  let vista = "";
  const f = (async (u: string) => { vista = u; return new Response(JSON.stringify({ items: [
    { title: "Peça A", link: "https://cdn.com/a.jpg", image: { thumbnailLink: "https://cdn.com/a-thumb.jpg", contextLink: "https://loja.com/a" } },
    { title: "Peça B (insegura)", link: "http://cdn.com/b.jpg" },
  ] }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await buscarImagens("minha-chave", "meu-cx", "jogo de juntas HR 2.5", f);
  assert.equal(r.length, 1); assert.equal(r[0].url, "https://cdn.com/a.jpg");
  const u = new URL(vista);
  assert.equal(u.searchParams.get("key"), "minha-chave"); assert.equal(u.searchParams.get("cx"), "meu-cx"); assert.equal(u.searchParams.get("searchType"), "image");
});

test("buscarImagens: erros viram IaErro com mensagem em português, sem vazar a chave", async () => {
  for (const [st, esperado] of [[401, 401], [429, 429], [500, 502]] as const) {
    const f = (async () => new Response("chave-secreta-xyz", { status: st })) as unknown as typeof fetch;
    await assert.rejects(buscarImagens("chave-secreta-xyz", "cx", "q", f), (e: unknown) => e instanceof IaErro && e.status === esperado && !e.message.includes("chave-secreta-xyz"));
  }
});
