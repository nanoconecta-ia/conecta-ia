// Contexto Vivo (PR A): estado efêmero "produto ativo + seleção" de UMA sessão autenticada. Módulo puro, sem rede nem banco.
// Identidade (loja, principal) vem SEMPRE do servidor: o evento do cliente NÃO carrega lojaId/usuarioId.
export const SELECAO_MAX = 100;
export const TTL_MS = 30 * 60_000;
export const ACOES_CLIENTE = ["produto.selecionado", "produto.aberto", "produto.fechado", "selecao.limpa"] as const;
export type AcaoCliente = (typeof ACOES_CLIENTE)[number];
export type Origem = "conecta-ui" | "bling-ui";

/** O que o cliente envia. `versaoBase` é a versão que ele viu; a versão nova é do servidor. */
export interface EventoCliente { eventoId: string; acao: AcaoCliente; origem: Origem; produtoAtivoId: string | null; produtosSelecionados: string[]; versaoBase: number }
export interface ContextoSessao { lojaId: string; principal: string; origem: Origem; produtoAtivoId: string | null; produtosSelecionados: string[]; versao: number; atualizadoEm: string; expiraEm: string; ultimoEventoId: string | null }
export type Resultado = { ok: true; contexto: ContextoSessao; duplicado?: boolean } | { ok: false; erro: "evento_invalido" | "selecao_excessiva" | "selecao_duplicada" | "produto_ativo_ausente" | "versao_conflito" | "produto_fora_da_loja" | "contexto_expirado" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const contextoVazio = (lojaId: string, principal: string, origem: Origem, agora: Date): ContextoSessao =>
  ({ lojaId, principal, origem, produtoAtivoId: null, produtosSelecionados: [], versao: 0, atualizadoEm: agora.toISOString(), expiraEm: new Date(agora.getTime() + TTL_MS).toISOString(), ultimoEventoId: null });
export const expirado = (c: ContextoSessao, agora: Date): boolean => Date.parse(c.expiraEm) <= agora.getTime();

/** Aplica um evento. `produtosDaLoja` é a resposta do servidor sobre quais ids pertencem à loja da sessão (nunca o cliente). */
export function aplicarEvento(atual: ContextoSessao, e: EventoCliente, produtosDaLoja: ReadonlySet<string>, agora: Date): Resultado {
  if (!e || !UUID.test(e.eventoId) || !ACOES_CLIENTE.includes(e.acao) || !Array.isArray(e.produtosSelecionados) || !Number.isSafeInteger(e.versaoBase)) return { ok: false, erro: "evento_invalido" };
  if (expirado(atual, agora)) return { ok: false, erro: "contexto_expirado" };
  if (e.eventoId === atual.ultimoEventoId) return { ok: true, contexto: atual, duplicado: true };
  if (e.versaoBase !== atual.versao) return { ok: false, erro: "versao_conflito" };
  if (e.produtosSelecionados.length > SELECAO_MAX) return { ok: false, erro: "selecao_excessiva" };
  if (new Set(e.produtosSelecionados).size !== e.produtosSelecionados.length) return { ok: false, erro: "selecao_duplicada" };
  const limpar = e.acao === "selecao.limpa";
  const ids = limpar ? [] : e.produtosSelecionados;
  const ativo = limpar || e.acao === "produto.fechado" ? null : e.produtoAtivoId;
  if (e.acao === "produto.aberto" && !ativo) return { ok: false, erro: "produto_ativo_ausente" };
  if ([...ids, ...(ativo ? [ativo] : [])].some((id) => !UUID.test(id) || !produtosDaLoja.has(id))) return { ok: false, erro: "produto_fora_da_loja" };
  return { ok: true, contexto: { ...atual, origem: e.origem, produtoAtivoId: ativo, produtosSelecionados: [...ids], versao: atual.versao + 1, atualizadoEm: agora.toISOString(), expiraEm: new Date(agora.getTime() + TTL_MS).toISOString(), ultimoEventoId: e.eventoId } };
}

/** Leitura pelo MCP: só o contexto da MESMA loja e principal; expirado ou de outro principal = indisponível (não adivinha). */
export function lerContexto(c: ContextoSessao | null, lojaId: string, principal: string, agora: Date): { ok: true; contexto: ContextoSessao } | { ok: false; erro: "contexto_indisponivel" } {
  if (!c || c.lojaId !== lojaId || c.principal !== principal || expirado(c, agora)) return { ok: false, erro: "contexto_indisponivel" };
  return { ok: true, contexto: c };
}
