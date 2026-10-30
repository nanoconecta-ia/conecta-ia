/**
 * NanoIA Code Mode — Cloudflare Worker ISOLADO, exclusivo para dados FICTÍCIOS.
 * Não importamos Bling, Supabase, chaves ou handlers de produção.
 * Código da IA roda no Dynamic Worker Loader, NÃO em eval/Function do gateway.
 * NÃO publicar sem revisão de egress, autenticação real, budget e direitos.
 */
import { DynamicWorkerExecutor } from "@cloudflare/codemode";
import { codeMcpServer } from "@cloudflare/codemode/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLegacyMcpHandler } from "agents/mcp";
import { z } from "zod";
import { autenticarDemo, criarOrcamentoDeChamadas } from "./seguranca.mjs";
import { criarClienteBridge } from "./bridge-auth.mjs";
import { catalogoListar, catalogoVer, taxonomiaConsultar, resumoCatalogo } from "./dados-sinteticos.mjs";

interface Env {
  LOADER: ConstructorParameters<typeof DynamicWorkerExecutor>[0]["loader"];
  PILOT_ENABLED?: string;
  PILOT_TOKEN_A?: string;
  PILOT_TOKEN_B?: string;
  PILOT_BRIDGE_ENABLED?: string;
  PILOT_HOST_URL?: string;
  PILOT_HOST_KEY_A?: string;
  PILOT_HOST_KEY_B?: string;
  PILOT_HOST_SECRET_A?: string;
  PILOT_HOST_SECRET_B?: string;
  PILOT_ALLOW_LOCAL_HOST?: string;
  PILOT_BRIDGE_TRANSPORT?: string;
  PILOT_HOST_SERVICE?: Fetcher;
}

function criarFerramentas(tenant: string, env: Env) {
  const server = new McpServer({ name: "nanoia-codemode-piloto-ficticio", version: "0.1.0" });
  // Orçamento de chamadas compartilhado na requisição atual. Não usar como quota global de produção.
  const contar = criarOrcamentoDeChamadas(12);
  const saida = (valor: unknown) => ({
    structuredContent: valor as Record<string, unknown>,
    content: [{ type: "text" as const, text: JSON.stringify(valor) }],
  });
  // Homologação HTTP assinada. NENHUM token HMAC vai ao Worker dinâmico:
  // estes handlers rodam apenas no Worker PAI e chamam o host autenticado.
  // Desligado por padrão; sem tráfego de dados reais/produção.
  if (env.PILOT_BRIDGE_ENABLED === "true") {
    if (env.PILOT_ENABLED !== "true") throw new Error("piloto_desligado");
    const a = tenant === "piloto-a";
    const chamar = criarClienteBridge({
      url: env.PILOT_HOST_URL,
      keyId: a ? env.PILOT_HOST_KEY_A : env.PILOT_HOST_KEY_B,
      secret: a ? env.PILOT_HOST_SECRET_A : env.PILOT_HOST_SECRET_B,
      local: env.PILOT_ALLOW_LOCAL_HOST === "true",
      fetchFn: env.PILOT_BRIDGE_TRANSPORT === "service"
        ? (env.PILOT_HOST_SERVICE
          ? env.PILOT_HOST_SERVICE.fetch.bind(env.PILOT_HOST_SERVICE)
          : (() => { throw new Error("binding_host_ausente"); })())
        : fetch,
    });
    server.registerTool("catalogo_resumo", {
      description: "Consulta auditada de contagens da loja autorizada; retorno público mínimo.",
      inputSchema: {},
    }, async () => { contar(); return saida(await chamar("catalogo_resumo", {})); });
    server.registerTool("catalogo_listar", {
      description: "Lista somente SKU/nome; sem custo, preço, estoque ou fornecedor.",
      inputSchema: { busca: z.string().max(80).optional(), limite: z.number().int().min(1).max(20).optional() },
    }, async ({ busca, limite }) => { contar(); return saida(await chamar("catalogo_listar", { ...(busca !== undefined ? { busca } : {}), ...(limite !== undefined ? { limite } : {}) })); });
    return server;
  }
  server.registerTool("catalogo_listar", {
    description: "Leitura de produtos fictícios da loja autenticada. Não expõe custo, fiscal, estoque real, fornecedor ou credenciais.",
    inputSchema: { busca: z.string().max(80).optional(), limite: z.number().int().min(1).max(20).optional() },
  }, async ({ busca, limite }) => { contar(); return saida({ itens: catalogoListar(tenant, { busca, limite }), origem: "fixture_sintetica" }); });

  server.registerTool("catalogo_ver", {
    description: "Inspeciona somente o SKU fictício exato da loja autenticada; retorna dados e pendências.",
    inputSchema: { sku: z.string().regex(/^TEST-[A-Z0-9-]{1,32}$/) },
  }, async ({ sku }) => { contar(); return saida(catalogoVer(tenant, sku)); });

  server.registerTool("taxonomia_motor", {
    description: "Consulta indícios de classificação por motor apenas entre fixtures. NÃO confirma compatibilidade.",
    inputSchema: { motor: z.string().regex(/^[A-Z0-9-]{2,16}$/) },
  }, async ({ motor }) => { contar(); return saida(taxonomiaConsultar(tenant, motor)); });

  server.registerTool("catalogo_resumo", {
    description: "Contadores de cadastro fictício da loja da credencial; apenas leitura.",
    inputSchema: {},
  }, async () => { contar(); return saida(resumoCatalogo(tenant)); });
  return server;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== "/mcp") return new Response("not found", { status: 404 });
    // Browser Origins são recusadas: endpoint de laboratório, sem CORS/autenticação por cookies.
    if (req.headers.has("origin")) return new Response("origem de navegador não autorizada", {
      status: 403, headers: { "cache-control": "no-store" },
    });
    if (!env?.LOADER) return new Response("sandbox indisponível", { status: 503 });
    const tenant = await autenticarDemo(req, env);
    if (!tenant) return new Response("não autorizado ou piloto desligado", {
      status: 401, headers: { "www-authenticate": "Bearer realm=\"nanoia-codemode-piloto\"", "cache-control": "no-store" },
    });
    const server = await codeMcpServer({
      server: criarFerramentas(tenant, env),
      executor: new DynamicWorkerExecutor({
        loader: env.LOADER,
        globalOutbound: null, // O código gerado NÃO pode chamar a internet via fetch/connect.
        timeout: 12_000,      // Sem executar indefinidamente; budget por operação abaixo.
      }),
    });
    const resposta = await createLegacyMcpHandler(server, { route: "/mcp" })(req, env, ctx);
    // Headers defensivos para respostas MCP e erro, sem expor dados em caches.
    const headers = new Headers(resposta.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(resposta.body, { status: resposta.status, headers });
  },
} satisfies ExportedHandler<Env>;
