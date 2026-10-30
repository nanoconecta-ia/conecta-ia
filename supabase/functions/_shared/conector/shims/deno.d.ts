// Declarações mínimas para checar os tipos das Edge Functions SEM o Deno instalado (só tooling de desenvolvimento).
declare const Deno: {
  env: { get(nome: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
declare module "npm:@supabase/supabase-js@2" {
  // deno-lint-ignore no-explicit-any
  export function createClient(url: string, chave: string, opcoes?: Record<string, unknown>): any;
}

// A Edge Function do gateway fixa a versão do SDK; o Deno resolve o pacote em deploy.
declare module "npm:@supabase/supabase-js@2.117.3" {
  export function createClient(url: string, chave: string, opcoes?: Record<string, unknown>): any;
}
