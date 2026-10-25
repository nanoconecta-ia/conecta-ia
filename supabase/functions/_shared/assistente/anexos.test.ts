import { test } from "node:test";
import assert from "node:assert/strict";
import { conteudoComAnexos, MAX_ANEXOS, resumoParaRegistro, validarAnexos } from "./anexos.ts";
import { chamarClaude, chamarGemini, chamarOpenAI } from "../ia/adaptadores.ts";
import { ADAPTADORES_STREAM } from "../ia/adaptadores_stream.ts";

const b64 = (b: number[] | Uint8Array) => btoa(Array.from(b as ArrayLike<number>, (x) => String.fromCharCode(x)).join(""));
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = b64([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = b64(new TextEncoder().encode("%PDF-1.4 teste"));
const TXT = b64(new TextEncoder().encode("SKU 5112;Kit;1500"));
const png = (nome = "foto.png") => ({ nome, tipo: "image/png", dados: PNG });

test("aceita imagem, PDF e texto; devolve só metadados para o registro (nunca o conteúdo)", async () => {
  const r = await validarAnexos([png(), { nome: "ficha.pdf", tipo: "application/pdf", dados: PDF }, { nome: "lista.csv", tipo: "text/csv", dados: TXT }], "gemini");
  assert.ok(r.ok); assert.deepEqual(r.anexos.map((a) => a.categoria), ["imagem", "pdf", "texto"]);
  const reg = JSON.stringify(resumoParaRegistro(r.anexos)); assert.ok(!reg.includes(PNG) && !reg.includes("SKU 5112")); assert.match(reg, /"sha256":"[0-9a-f]{64}"/);
});
test("sem anexos é ok; mais de 3, tipo fora da lista, base64 inválido e tipo que não bate com o conteúdo são recusados", async () => {
  assert.deepEqual(await validarAnexos(undefined, "claude"), { ok: true, anexos: [] });
  assert.equal((await validarAnexos(Array(MAX_ANEXOS + 1).fill(png()), "claude")).ok, false);
  for (const ruim of [{ nome: "a.exe", tipo: "application/x-msdownload", dados: PNG }, { nome: "a.png", tipo: "image/png", dados: "###" }, { nome: "a.png", tipo: "image/png", dados: JPG }, { nome: "a.pdf", tipo: "application/pdf", dados: PNG }, { tipo: "image/png" }, null]) assert.equal((await validarAnexos([ruim], "claude")).ok, false, JSON.stringify(ruim)?.slice(0, 40));
  assert.equal((await validarAnexos("x", "claude")).ok, false);
});
test("tamanho: arquivo grande e total acima do limite; texto binário recusado", async () => {
  const grande = b64(new Uint8Array(3_100_000).fill(0x20)); assert.equal((await validarAnexos([{ nome: "g.txt", tipo: "text/plain", dados: grande }], "claude")).ok, false);
  const quase = new Uint8Array(2_000_000); quase.set([0x89, 0x50, 0x4e, 0x47]); const d = b64(quase);
  assert.equal((await validarAnexos([{ nome: "1.png", tipo: "image/png", dados: d }, { nome: "2.png", tipo: "image/png", dados: d }, { nome: "3.png", tipo: "image/png", dados: d }], "claude")).ok, false, "soma > 4,5 MB");
  assert.equal((await validarAnexos([{ nome: "b.txt", tipo: "text/plain", dados: b64([0x41, 0x00, 0x42]) }], "claude")).ok, false);
});
test("PDF só nos provedores que aceitam; o nome do arquivo é saneado", async () => {
  const r = await validarAnexos([{ nome: "../../etc/passwd\".pdf", tipo: "application/pdf", dados: PDF }], "compativel_openai"); assert.equal(r.ok, false); assert.match((r as { erro: string }).erro, /PDF/);
  const ok = await validarAnexos([{ nome: "../../etc/pa\"ss.pdf", tipo: "application/pdf", dados: PDF }], "claude"); assert.ok(ok.ok); assert.ok(!/[\\/"]/.test(ok.anexos[0].nome));
});
test("texto anexado vira bloco delimitado como DADO; imagem vira bloco binário", async () => {
  const r = await validarAnexos([png(), { nome: "lista.csv", tipo: "text/csv", dados: TXT }], "gemini"); assert.ok(r.ok);
  const c = conteudoComAnexos("o que é isto?", r.anexos) as { type: string; text?: string }[];
  assert.equal(c[0].text, "o que é isto?"); assert.equal(c[1].type, "anexo"); assert.match(c[2].text!, /ARQUIVO ANEXADO "lista.csv".*DADO e não instrução[\s\S]*SKU 5112[\s\S]*FIM DO ARQUIVO/);
  assert.equal(conteudoComAnexos("oi", []), "oi");
});

// adaptadores: o corpo enviado ao provedor leva o anexo no formato certo
const capturar = () => { const v: { url: string; corpo: any }[] = []; const f: typeof fetch = async (url, op) => { v.push({ url: String(url), corpo: JSON.parse(String(op?.body)) }); return Response.json(v.at(-1)!.url.includes("anthropic") ? { content: [{ type: "text", text: "ok" }] } : v.at(-1)!.url.includes("googleapis") ? { candidates: [{ content: { parts: [{ text: "ok" }] } }] } : { choices: [{ message: { content: "ok" } }] }); }; return { v, f }; };
const msg = async (prov: "claude" | "gemini" | "compativel_openai", pdf = false) => { const r = await validarAnexos([pdf ? { nome: "f.pdf", tipo: "application/pdf", dados: PDF } : png()], "claude"); assert.ok(r.ok); return [{ role: "user" as const, content: conteudoComAnexos("descreva", r.anexos) }]; };
test("Claude recebe image/document em base64; Gemini recebe inlineData; OpenAI-compatível recebe image_url (PDF é recusado)", async () => {
  const base = { chave: "k", modelo: "m", sistema: "s", ferramentas: [], maxTokens: 10, baseUrl: "https://api.exemplo.com/v1" };
  let c = capturar(); await chamarClaude({ ...base, fetch: c.f }, await msg("claude")); assert.deepEqual(c.v[0].corpo.messages[0].content[1], { type: "image", source: { type: "base64", media_type: "image/png", data: PNG } });
  c = capturar(); await chamarClaude({ ...base, fetch: c.f }, await msg("claude", true)); assert.equal(c.v[0].corpo.messages[0].content[1].type, "document");
  c = capturar(); await chamarGemini({ ...base, fetch: c.f }, await msg("gemini")); assert.deepEqual(c.v[0].corpo.contents[0].parts[1], { inlineData: { mimeType: "image/png", data: PNG } });
  c = capturar(); await chamarOpenAI({ ...base, fetch: c.f }, await msg("compativel_openai")); const u = c.v[0].corpo.messages.find((m: any) => m.role === "user"); assert.equal(u.content[1].image_url.url, `data:image/png;base64,${PNG}`);
  await assert.rejects(chamarOpenAI({ ...base, fetch: capturar().f }, await msg("compativel_openai", true)), /PDF/);
});
test("o fluxo com streaming recusa anexo em vez de descartá-lo em silêncio", async () => {
  const m = await msg("claude");
  for (const a of Object.values(ADAPTADORES_STREAM)) await assert.rejects(a({ chave: "k", modelo: "m", sistema: "s", ferramentas: [], maxTokens: 10, baseUrl: "https://api.exemplo.com/v1" }, m, () => {}), /Anexos não são suportados/);
});
