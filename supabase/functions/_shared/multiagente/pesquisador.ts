// Capacidade 2 — Pesquisador. Consulta conectores AUTORIZADOS em paralelo, respeitando concorrência, limite de taxa por fonte e orçamento.
// Nunca contorna autenticação ou bloqueio; fonte sem autorização, navegação não permitida e orçamento estourado são registrados, não driblados.
import { paraEvidencia, type ConectorPesquisa, type Consulta } from "../pipeline/conectores.ts";
import type { Evidencia } from "../pipeline/comparacao.ts";
import type { PortaCustos, RegistroCusto } from "./custos.ts";
import { criarLimitador, criarLimiteTaxa } from "./custos.ts";

export interface ResultadoPesquisa { evidencias: Evidencia[]; ignorados: { id: string; motivo: string }[]; falhas: { id: string; erro: string }[]; adiados: { id: string; motivo: string }[]; ambiguas: string[]; tentados: number }
export interface OpcoesPesquisa { agora: string; concorrencia: number; custos: PortaCustos; permitirNavegacao?: boolean; timeoutMs?: number; limiteTaxa?: ReturnType<typeof criarLimiteTaxa> }

const comTempo = <T>(p: Promise<T>, ms: number): Promise<T> => new Promise<T>((ok, erro) => { const t = setTimeout(() => erro(new Error(`tempo esgotado (${ms} ms)`)), ms); p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); erro(e); }); });

export async function pesquisar(conectores: ConectorPesquisa[], consulta: Consulta, o: OpcoesPesquisa): Promise<ResultadoPesquisa> {
  const r: ResultadoPesquisa = { evidencias: [], ignorados: [], falhas: [], adiados: [], ambiguas: [], tentados: 0 };
  const limitar = criarLimitador(Math.max(1, o.concorrencia));
  const taxa = o.limiteTaxa ?? criarLimiteTaxa();
  const elegiveis = conectores.filter((c) => {
    if (!c.autorizado) { r.ignorados.push({ id: c.id, motivo: "sem autorização do dono/contrato" }); return false; }
    if (c.acesso === "navegacao" && !o.permitirNavegacao) { r.ignorados.push({ id: c.id, motivo: "navegação automatizada não permitida nesta execução" }); return false; }
    return true;
  });
  await Promise.all(elegiveis.map((c) => limitar(async () => {
    const usd = c.custo_usd ?? 0;
    let reserva: { ok: boolean; id?: string } = { ok: true };
    if (usd > 0) { reserva = await o.custos.tentar("pesquisador", "api", c.id, usd); if (!reserva.ok) { r.adiados.push({ id: c.id, motivo: "orçamento da loja não comporta esta consulta" }); return; } }
    r.tentados++;
    await taxa(c.id, c.intervalo_min_ms ?? 0);
    const ini = Date.now();
    const reg = (extra: Partial<RegistroCusto> = {}): RegistroCusto => ({ capacidade: "pesquisador", tarefa: `pesquisar:${c.id}`, tipo: usd > 0 ? "api" : "deterministica", fonte: c.id, chamadas: 1, tokens_in: 0, tokens_out: 0, usd, duracao_ms: Date.now() - ini, ...extra });
    try {
      const brutos = await comTempo(c.buscar(consulta), o.timeoutMs ?? 15000);
      for (const b of brutos) { const { evidencia, ambigua } = paraEvidencia(b, consulta.sku, o.agora); r.evidencias.push(evidencia); if (ambigua) r.ambiguas.push(b.fonte); }
      if (reserva.id) await o.custos.confirmar(reserva.id, reg()); else await o.custos.registrar(reg());
    } catch (e) {
      r.falhas.push({ id: c.id, erro: e instanceof Error ? e.message : String(e) });
      if (reserva.id) await o.custos.confirmar(reserva.id, reg({ usd })); else await o.custos.registrar(reg());
    }
  })));
  r.evidencias.sort((a, b) => a.fonte.localeCompare(b.fonte));   // ordem estável apesar do paralelismo
  return r;
}
