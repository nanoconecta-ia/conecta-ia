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
import { catalogoListar, catalogoVer, taxonomiaConsultar, resumoCatalogo } from "./dados-sinteticos.mjs";

interface Env {
  LOADER: ConstructorParameters<typeof DynamicWorkerExecutor>[0]["loader"];
  PILOT_ENABLED?: string;
  PILOT_TOKEN_A?: string;
  PILOT_TOKEN_B?: string;
}

function criarFerramentas(tenant: string) {
  const server = new McpServer({ name: "nanoia-codemode-piloto-ficticio", version: "0.1.0" });
  // Orçamento de chamadas compartilhado na requisição atual. Não usar como quota global de produção.
  const contar = criarOrcamentoDeChamadas(12);
  const saida = (valor: unknown) => ({
    structuredContent: valor as Record<string, unknown>,
    content: [{ type: "text" as const, text: JSON.stringify(valor) }],
  });
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
    if (!env?.LOADER) return new Response("sandbox indisponível", { status: 503 });
    const tenant = await autenticarDemo(req, env);
    if (!tenant) return new Response("não autorizado ou piloto desligado", {
      status: 401, headers: { "www-authenticate": "Bearer realm=\"nanoia-codemode-piloto\"", "cache-control": "no-store" },
    });
    const server = await codeMcpServer({
      server: criarFerramentas(tenant),
      executor: new DynamicWorkerExecutor({ loader: env.LOADER }),
    });
    return createLegacyMcpHandler(server, { route: "/mcp" })(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
