// Implementação da porta Armazem sobre as RPCs do Supabase (somente service_role).
import type { Armazem, CredCifrada } from "./bling_token.ts";

// deno-lint-ignore no-explicit-any
export function armazemSupabase(admin: any): Armazem {
  return {
    async ler(lojaId) {
      const { data, error } = await admin.rpc("bling_ler_credenciais", { p_loja_id: lojaId });
      if (error) throw new Error("falha ao ler credenciais");
      return ((data as CredCifrada[] | null) ?? [])[0] ?? null;
    },
    async reservar(lojaId, por, ttlS) {
      const { data, error } = await admin.rpc("bling_reservar_renovacao", { p_loja_id: lojaId, p_por: por, p_ttl_s: ttlS });
      if (error) throw new Error("falha ao reservar renovação");
      return data === true;
    },
    async liberar(lojaId, por) {
      await admin.rpc("bling_liberar_renovacao", { p_loja_id: lojaId, p_por: por });
    },
    async salvar(lojaId, access, refresh, expiraEm) {
      const { error } = await admin.rpc("bling_salvar_credenciais", { p_loja_id: lojaId, p_access: access, p_refresh: refresh, p_expira_em: expiraEm });
      if (error) throw new Error("falha ao salvar credenciais");
    },
    async lerApp(lojaId) {
      const { data, error } = await admin.rpc("bling_ler_app", { p_loja_id: lojaId });
      if (error) throw new Error("falha ao ler o app do Bling");
      return ((data as { client_id: string; client_secret_cifrado: string; cnpj: string }[] | null) ?? [])[0] ?? null;
    },
    async marcar(lojaId, status, erro) {
      await admin.rpc("bling_marcar_status", { p_loja_id: lojaId, p_status: status, p_erro: erro });
    },
  };
}
