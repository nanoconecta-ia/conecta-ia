// Conversa ativa do Nano.IA, compartilhada entre a tela /assistente e o dock lateral (issue #166, B2).
// Os dois montam o MESMO componente e o MESMO backend (edge `assistente`, tabelas conversas/mensagens), mas cada montagem
// começava sem conversa: abrir o dock depois da tela (ou o contrário) perdia o fio. Aqui fica só o id da conversa,
// por loja, na sessão do navegador. Nunca o conteúdo: as mensagens continuam vindo do servidor, com RLS.
const CHAVE = (lojaId: string) => `nano:conversa-ativa:${lojaId}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Memória da aba: vale mesmo quando o sessionStorage está bloqueado (modo privado, política do navegador). */
const memoria = new Map<string, string>();

function armazenamento(): Storage | null {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
}

export function lerConversaAtiva(lojaId: string): string | null {
  let v: string | null = memoria.get(lojaId) ?? null;
  if (!v) { try { v = armazenamento()?.getItem(CHAVE(lojaId)) ?? null; } catch { v = null; } }
  return v && UUID.test(v) ? v : null;
}

/** `null` limpa (nova conversa, exclusão, conversa que não abre mais). Id fora do formato é ignorado. */
export function gravarConversaAtiva(lojaId: string, id: string | null): void {
  if (id !== null && !UUID.test(id)) return;
  if (id) memoria.set(lojaId, id); else memoria.delete(lojaId);
  try { const s = armazenamento(); if (s) { if (id) s.setItem(CHAVE(lojaId), id); else s.removeItem(CHAVE(lojaId)); } } catch { /* sem storage: fica só a memória da aba */ }
}
