// Consentimento de envio ao provedor de IA: vale só durante a SESSÃO do navegador (sessionStorage), por loja e por provedor.
// Fechou a aba, acabou: nada fica gravado em disco nem vai ao servidor. Evita pedir a mesma autorização a cada tela, sem torná-la permanente.
type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const chaveConsentimento = (lojaId: string, provedor: string) => `conecta:consent-envio:${lojaId}:${provedor}`;
export function lerConsentimento(a: Pick<Storage, "getItem"> | null, lojaId: string, provedor: string): boolean {
  try { return a?.getItem(chaveConsentimento(lojaId, provedor)) === "1"; } catch { return false; }
}
export function gravarConsentimento(a: Armazem | null, lojaId: string, provedor: string, aceito: boolean): void {
  try { if (aceito) a?.setItem(chaveConsentimento(lojaId, provedor), "1"); else a?.removeItem(chaveConsentimento(lojaId, provedor)); } catch { /* sem storage: vale só nesta tela */ }
}
