import { test } from "node:test";
import assert from "node:assert/strict";
import { provedorGoogle } from "./google.ts";
import { BuscaErro, MSG_SEM_PROVEDOR, SEM_PROVEDOR, erroDeBusca } from "./busca.ts";

const resp = (status: number, corpo: unknown) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;
const g = (f: typeof fetch) => provedorGoogle("k", "cx", f);

test("busca: sem provedor é estado explícito e honesto (a ferramenta existe, falta o provedor)", () => {
  const r = SEM_PROVEDOR();
  assert.equal(r.motivo, "sem_provedor");
  assert.match(r.erro, /não há provedor de pesquisa configurado/);
  assert.match(r.erro, /A ferramenta existe/);
  assert.doesNotMatch(r.erro, /não tenho ferramenta/i);
  assert.match(MSG_SEM_PROVEDOR, /20\/01\/2026/);
  assert.match(MSG_SEM_PROVEDOR, /não adianta criar uma chave nova/);
});

test("busca: 401 é credencial inválida", async () => {
  const e = await g(resp(401, { error: { message: "API key not valid" } })).imagens("bomba").catch((x) => x) as BuscaErro;
  assert.equal(e.motivo, "credencial_invalida");
});

test("busca: 403 de API indisponível para a conta NÃO é tratado como chave errada", async () => {
  const e = await g(resp(403, { error: { message: "This project does not have the access to Custom Search JSON API.", errors: [{ reason: "forbidden" }] } })).imagens("bomba").catch((x) => x) as BuscaErro;
  assert.equal(e.motivo, "api_indisponivel");
  assert.match(e.message, /problema é a API, não a digitação/);
});

test("busca: 403 sem motivo claro fica como 'recusada' (não afirma o que não sabe)", async () => {
  const e = await g(resp(403, {})).tecnico("82892 junta").catch((x) => x) as BuscaErro;
  assert.equal(e.motivo, "recusada");
  assert.match(e.message, /não confirmado/);
});

test("busca: 429 e cota viram 'limite'", async () => {
  assert.equal(((await g(resp(429, {})).imagens("bomba").catch((x) => x)) as BuscaErro).motivo, "limite");
  assert.equal(((await g(resp(403, { error: { errors: [{ reason: "dailyLimitExceeded" }] } })).imagens("bomba").catch((x) => x)) as BuscaErro).motivo, "limite");
});

test("busca: timeout e erro do provedor têm motivo próprio", async () => {
  const lento = (async () => { throw new Error("t"); }) as unknown as typeof fetch;
  assert.equal(((await g(lento).imagens("bomba").catch((x) => x)) as BuscaErro).motivo, "timeout");
  assert.equal(((await g(resp(500, {})).imagens("bomba").catch((x) => x)) as BuscaErro).motivo, "erro_provedor");
});

test("busca: candidatas só HTTPS, com origem (url e página); nada é gravado", async () => {
  const r = await g(resp(200, { items: [
    { title: "Bomba", link: "https://loja.example/a.jpg", image: { contextLink: "https://loja.example/p", thumbnailLink: "https://t.example/a" } },
    { title: "Inseguro", link: "http://loja.example/b.jpg" },
  ] })).imagens("bomba");
  assert.equal(r.length, 1);
  assert.equal(r[0].pagina, "https://loja.example/p");
});

test("erroDeBusca devolve o motivo do BuscaErro e 'erro_provedor' para o resto", () => {
  assert.deepEqual(erroDeBusca(new BuscaErro(429, "limite", "x")), { erro: "x", motivo: "limite" });
  assert.equal(erroDeBusca(new Error("boom")).motivo, "erro_provedor");
});
