// Executor de aprovações. Roda SÓ no servidor, DEPOIS de o lojista aprovar a versão exata. É a "autorização independente" das escritas:
// o agente que propôs nunca executa. Por padrão o registro de executores está VAZIO: sem executor registrado (e autorizado), nada é feito.
// Executores do Bling continuam desligados até teste com mock, Policy Engine e autorização explícita (CLAUDE.md, decisão de 2026-10-17).
export interface Reivindicacao { ok: true; ferramenta: string; alvos: unknown[]; depois: unknown; loja_id: string }
export type Negada = { ok: false; motivo: string };
export interface PortasExecucao {
  consumir(id: string, hash: string): Promise<Reivindicacao | Negada>;
  concluir(id: string, ok: boolean, resultado: unknown): Promise<void>;
}
/** O executor recebe SÓ o que foi aprovado (loja, alvos, conteúdo). Nunca credencial, token ou cliente privilegiado. */
export type Executor = (a: { loja_id: string; alvos: unknown[]; depois: unknown }) => Promise<unknown>;
export type Registro = Readonly<Record<string, Executor>>;

export const EXECUTORES_PADRAO: Registro = Object.freeze({}); // nenhum por padrão

export type Resultado = { executada: true; resultado: unknown } | { executada: false; motivo: string };

export async function executarAprovada(id: string, hashAprovado: string, p: PortasExecucao, registro: Registro = EXECUTORES_PADRAO): Promise<Resultado> {
  const r = await p.consumir(id, hashAprovado);      // atômico no banco: aprovada -> executando, uma única vez, versão e prazo conferidos
  if (!r.ok) return { executada: false, motivo: r.motivo };
  const exec = Object.hasOwn(registro, r.ferramenta) ? registro[r.ferramenta] : undefined;
  if (!exec) { await p.concluir(id, false, { erro: "sem executor autorizado para esta ferramenta" }); return { executada: false, motivo: "sem_executor" }; }
  try {
    const resultado = await exec({ loja_id: r.loja_id, alvos: r.alvos, depois: r.depois });
    await p.concluir(id, true, resultado ?? null);
    return { executada: true, resultado };
  } catch {
    await p.concluir(id, false, { erro: "falha na execução" }); // sem detalhe interno; NUNCA repete sozinho: nova tentativa = nova proposta
    return { executada: false, motivo: "falhou" };
  }
}

/** Ligação com as RPCs do banco (service_role). */
export function portasExecucaoSupabase(admin: { rpc(fn: string, a: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }): PortasExecucao {
  return {
    async consumir(id, hash) {
      const { data, error } = await admin.rpc("aprovacao_consumir", { p_id: id, p_hash: hash });
      if (error || !data) return { ok: false, motivo: "erro" };
      return data as Reivindicacao | Negada;
    },
    async concluir(id, ok, resultado) { await admin.rpc("aprovacao_concluir", { p_id: id, p_ok: ok, p_resultado: resultado }); },
  };
}
