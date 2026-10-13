import "server-only";
import { supabaseServico } from "@/lib/supabase/servico";
import { cifrar, decifrar } from "./cripto";
import { renovar, type TokensBling } from "./oauth";
import { configBling } from "./config";

/** Grava tokens cifrados via RPC (schema private não é exposto). Só service_role. */
export async function salvarTokens(lojaId: string, t: TokensBling) {
  const { error } = await supabaseServico().rpc("bling_salvar_credenciais", {
    p_loja_id: lojaId,
    p_access: cifrar(t.accessToken),
    p_refresh: cifrar(t.refreshToken),
    p_expira_em: t.expiraEm.toISOString(),
  });
  if (error) throw new Error("Falha ao salvar credenciais do Bling");
}

/** Access token válido da loja; renova (e regrava o novo par) se faltar menos de 2 min. */
export async function accessTokenDaLoja(lojaId: string): Promise<string> {
  const s = supabaseServico();
  const { data, error } = await s.rpc("bling_ler_credenciais", { p_loja_id: lojaId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) throw new Error("Loja sem conexão com o Bling");
  if (new Date(row.expira_em).getTime() - Date.now() > 120_000) return decifrar(row.access_token_cifrado);
  try {
    const novo = await renovar(configBling(), decifrar(row.refresh_token_cifrado));
    await salvarTokens(lojaId, novo);
    return novo.accessToken;
  } catch (e) {
    await s.rpc("bling_marcar_status", { p_loja_id: lojaId, p_status: "expirada", p_erro: "Falha ao renovar o acesso" });
    throw e;
  }
}
