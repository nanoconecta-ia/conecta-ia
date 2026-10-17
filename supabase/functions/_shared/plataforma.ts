// Segredos da plataforma: variável de ambiente se existir; senão o Vault do Supabase
// (gerado pelo banco, só lido pelo servidor via RPC de service_role). Nunca vão ao navegador nem a log.
import { type Chaveiro, chaveiroDoAmbiente } from "./cripto.ts";

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };

async function doVault(admin: Rpc, nome: string): Promise<string | undefined> {
  const { data } = await admin.rpc("plataforma_segredo", { p_nome: nome });
  return typeof data === "string" && data ? data : undefined;
}

export async function segredoEstado(admin: Rpc, get: (n: string) => string | undefined): Promise<string | undefined> {
  return get("ESTADO_SEGREDO") || await doVault(admin, "plataforma_estado_segredo");
}

export async function chaveiroPlataforma(admin: Rpc, get: (n: string) => string | undefined): Promise<Chaveiro | undefined> {
  return chaveiroDoAmbiente(get) ?? await doVault(admin, "plataforma_chave_cifra_k1");
}
