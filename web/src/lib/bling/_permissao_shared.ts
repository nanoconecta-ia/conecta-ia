// Quem pode DECIDIR (aprovar ou rejeitar) o que o agente propôs na Fila: só quem ADMINISTRA a loja (papel lojista, ou super_admin
// com MFA). Quem apenas enxerga a loja (papel editor) consulta e conversa, mas não decide. A função `assistente` grava com
// privilégio elevado depois de ler com o JWT do usuário; a RLS de leitura sozinha não impede o editor, por isso o gate é explícito.
export interface RpcUsuario { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error?: unknown }> }

export const MSG_SO_LOJISTA = "Só o responsável (lojista) da loja pode aprovar ou rejeitar.";

/** `pode_administrar_loja` roda com o JWT do usuário (auth.uid()). Qualquer erro ou resposta diferente de `true` nega. */
export async function podeDecidir(usuario: RpcUsuario, lojaId: string): Promise<boolean> {
  try {
    const { data, error } = await usuario.rpc("pode_administrar_loja", { p_loja_id: lojaId });
    return !error && data === true;
  } catch {
    return false;
  }
}
