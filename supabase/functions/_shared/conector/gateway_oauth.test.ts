import { test } from "node:test";
import assert from "node:assert/strict";
import { tratarMcp, type ChaveMcp, type PortasGateway } from "./gateway.ts";
import { sha256Hex } from "./cripto.ts";
import { metadataRecursoMcp } from "../pair/oauth.ts";

const SEG = (c: string) => c.repeat(43);
const tokenOAuth = `${SEG("a")}.${SEG("b")}`;
const A = "aaaaaaaa-0000-0000-0000-00000000000a", U1 = "11111111-1111-1111-1111-111111111111", SESSAO = "5e55a000-0000-0000-0000-000000000001";
const chaveOAuth: ChaveMcp = { chave_id: SESSAO, loja_id: A, escopos: ["leitura"], criada_por: U1, nome: "ChatGPT (OAuth)", via: "oauth" };
const URL_RECURSO = "https://projeto.supabase.co/functions/v1/conector-mcp";

function portas(o: { oauth?: ChaveMcp | null; semPortaOAuth?: boolean } = {}): PortasGateway & { oauthChamadas: [string, string][]; chaveChamadas: string[] } {
  const oauthChamadas: [string, string][] = [], chaveChamadas: string[] = [];
  return { oauthChamadas, chaveChamadas, urlRecurso: URL_RECURSO,
    validarChave: async (h) => { chaveChamadas.push(h); return null; },
    ...(o.semPortaOAuth ? {} : { validarOAuth: async (t: string, s: string) => { oauthChamadas.push([t, s]); return o.oauth ?? null; } }),
    limite: async () => true,
    contexto: () => { throw new Error("não monta contexto neste teste"); } };
}
const req = (corpo: unknown, cab: Record<string, string> = { authorization: `Bearer ${tokenOAuth}` }, metodo = "POST") => ({ metodo, cabecalhos: cab, corpo: JSON.stringify(corpo) });
const rpc = (method: string, id = 1) => ({ jsonrpc: "2.0", id, method });

test("OAuth: token válido autentica e o banco só recebe os HASHES das duas metades, nunca o token", async () => {
  const p = portas({ oauth: chaveOAuth });
  const r = await tratarMcp(req(rpc("ping")), p);
  assert.equal(r.status, 200);
  assert.deepEqual(p.oauthChamadas, [[await sha256Hex(SEG("a")), await sha256Hex(SEG("b"))]]);
  assert.ok(!JSON.stringify(p.oauthChamadas).includes(SEG("a")));
  assert.equal(p.chaveChamadas.length, 0, "token OAuth não passa pela validação de chave MCP");
});
test("OAuth: sessão recusada pela validação (outro recurso, revogada, expirada) => 401 com descoberta", async () => {
  const r = await tratarMcp(req(rpc("ping")), portas({ oauth: null }));
  assert.equal(r.status, 401);
  assert.match(r.cabecalhos["www-authenticate"], new RegExp(`resource_metadata="${URL_RECURSO}/.well-known/oauth-protected-resource"`));
});
test("OAuth: sem a porta OAuth o gateway continua aceitando só chave MCP (comportamento antigo)", async () => {
  const p = portas({ semPortaOAuth: true });
  assert.equal((await tratarMcp(req(rpc("ping")), p)).status, 401);
  assert.equal(p.oauthChamadas.length, 0);
});
test("OAuth: token malformado nem chega à validação; 401 anuncia onde descobrir o OAuth", async () => {
  const p = portas({ oauth: chaveOAuth });
  for (const t of ["", "qualquer", `${SEG("a")}`, `${SEG("a")}.curto`]) assert.equal((await tratarMcp(req(rpc("ping"), { authorization: `Bearer ${t}` }), p)).status, 401, t);
  assert.equal(p.oauthChamadas.length, 0);
  const sem = await tratarMcp(req(rpc("ping"), {}), p);
  assert.match(sem.cabecalhos["www-authenticate"], /resource_metadata=/);
});
test("OAuth: Origin de navegador continua recusado (403) mesmo com token válido", async () => {
  assert.equal((await tratarMcp(req(rpc("ping"), { authorization: `Bearer ${tokenOAuth}`, origin: "https://site.com" }), portas({ oauth: chaveOAuth }))).status, 403);
});
test("OAuth: escopos da sessão limitam tools/list (leitura não vê propor)", async () => {
  const nomes = async (escopos: any[]) => JSON.parse((await tratarMcp(req(rpc("tools/list")), portas({ oauth: { ...chaveOAuth, escopos } }))).corpo).result.tools.map((t: any) => t.name) as string[];
  const leitura = await nomes(["leitura"]), propor = await nomes(["leitura", "propor"]);
  assert.ok(leitura.includes("conecta__catalogo__resumo")); assert.ok(!leitura.includes("conecta__proposta__criar"));
  assert.ok(propor.includes("conecta__proposta__criar"));
  for (const n of [...leitura, ...propor]) assert.doesNotMatch(n, /aprovar|executar|admin/);
});
test("metadado do recurso: aponta o emissor do conecta-gateway e só anuncia escopos mcp:*", () => {
  const m = metadataRecursoMcp(URL_RECURSO, "https://projeto.supabase.co/functions/v1/conecta-gateway");
  assert.equal(m.resource, URL_RECURSO);
  assert.deepEqual(m.authorization_servers, ["https://projeto.supabase.co/functions/v1/conecta-gateway/oauth"]);
  assert.deepEqual(m.scopes_supported, ["mcp:leitura", "mcp:propor"]);
  assert.deepEqual(m.bearer_methods_supported, ["header"]);
});
