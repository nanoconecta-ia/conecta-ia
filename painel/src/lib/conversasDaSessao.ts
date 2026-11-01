// Conversas CRIADAS nesta sessão do navegador (aba): guardadas só neste aparelho, por loja, em sessionStorage (some ao fechar a aba).
// Servem para o botão "Apagar as conversas desta sessão". Conversas antigas, abertas do histórico, nunca entram aqui.
const CHAVE = "conecta:conversas-da-sessao";
type Armazem = Pick<Storage, "getItem" | "setItem">;
const chave = (lojaId: string) => `${CHAVE}:${lojaId}`;

export function lerSessao(a: Pick<Storage, "getItem"> | null, lojaId: string): string[] {
  try {
    const v = JSON.parse(a?.getItem(chave(lojaId)) ?? "[]");
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 80))] : [];
  } catch { return []; }
}
function gravar(a: Armazem | null, lojaId: string, ids: string[]) {
  try { a?.setItem(chave(lojaId), JSON.stringify(ids)); } catch { /* sem storage: vale só até recarregar */ }
}
/** Registra uma conversa criada agora. Devolve a lista nova (sem repetir). */
export function registrarNaSessao(a: Armazem | null, lojaId: string, id: string): string[] {
  const ids = lerSessao(a, lojaId);
  if (!id || ids.includes(id)) return ids;
  const novos = [...ids, id]; gravar(a, lojaId, novos); return novos;
}
/** Tira da lista as conversas que foram apagadas. */
export function removerDaSessao(a: Armazem | null, lojaId: string, apagadas: readonly string[]): string[] {
  const resto = lerSessao(a, lojaId).filter((x) => !apagadas.includes(x));
  gravar(a, lojaId, resto); return resto;
}
