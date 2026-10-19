// Executor do experimento comparativo. Três braços sobre os MESMOS 20 produtos e as MESMAS fontes simuladas:
//   S0  = pipeline sequencial atual (PR #40): passo a passo, fontes em série, sem Taxonomista, sem detecção de duplicidade, sem Auditor, sem orçamento.
//   S1  = as seis capacidades em SÉRIE, sem planejamento (todas as tarefas sempre, uma fonte por vez, um item por vez).
//   M   = as seis capacidades + planejamento mínimo + pesquisas em paralelo + itens em paralelo + orçamento.
// Máquina de estados EM MEMÓRIA (cópia das transições do banco) para que o tempo meça a orquestração, não o cliente psql do ambiente de teste.
// As regras reais da máquina de estados estão testadas no banco (pipeline_indexacao.sql). Latências e custos das fontes são SIMULADOS (premissas abaixo).
import { executarPasso, processarFila, type ItemPipeline, type PortaPipeline, type EstadoPipeline } from "../pipeline/pipeline.ts";
import type { Conflito } from "../pipeline/comparacao.ts";
import type { ConectorPesquisa } from "../pipeline/conectores.ts";
import { processarFilaMultiagente } from "./orquestrador.ts";
import { custosEmMemoria } from "./custos.ts";
import { CATALOGO_EXISTENTE, PRODUTOS, type Produto } from "./experimento_dados.ts";

export const PREMISSAS = { latencia_ms: { oficial: 80, b2b: 120, gtin: 60 }, custo_usd_por_chamada: { oficial: 0.002, b2b: 0.004, gtin: 0.001 }, orcamento_usd: { folgado: 1, apertado: 0.05 },
  tokens_se_usasse_llm_na_taxonomia: { entrada: 600, saida: 80 } };

const TRANSICOES = new Set(["entrada>normalizado", "normalizado>identificado", "identificado>pesquisado", "pesquisado>comparado", "comparado>validado", "comparado>conflito", "conflito>comparado", "validado>enriquecido", "enriquecido>aguardando_aprovacao", "aprovado>sincronizando"]);
const ESPERA = ["conflito", "aguardando_aprovacao", "sincronizado", "rejeitado", "falhou"];

export function portaEmMemoria(): PortaPipeline & { itens: Map<string, ItemPipeline> } {
  const itens = new Map<string, ItemPipeline>();
  const conflitos = new Map<string, Conflito[]>();
  const bloqueados = new Set<string>();
  let n = 0;
  const copia = (i: ItemPipeline): ItemPipeline => ({ ...i, conflitos_abertos: (conflitos.get(i.id) ?? []).length });
  return {
    itens,
    async criar(sku, entrada, idem) {
      for (const i of itens.values()) if (i.sku === sku) return i.id;
      const id = `it-${++n}-${idem}`;
      itens.set(id, { id, loja_id: "L", sku, estado: "entrada", versao: 1, entrada, resultado: {}, tentativas: 0, proposta_id: null, conflitos_abertos: 0 });
      return id;
    },
    async obter(id) { return copia(itens.get(id)!); },
    async avancar(item, para, o = {}) {
      const atual = itens.get(item.id)!;
      if (atual.versao !== item.versao) throw new Error("versão desatualizada");
      if (!TRANSICOES.has(`${atual.estado}>${para}`)) throw new Error(`transição não permitida: ${atual.estado} → ${para}`);
      atual.estado = para as EstadoPipeline; atual.versao++; atual.resultado = { ...atual.resultado, ...(o.resultado ?? {}) }; atual.tentativas = 0; bloqueados.delete(item.id);
      return copia(atual);
    },
    async registrarConflito(item, c) { const l = conflitos.get(item.id) ?? []; l.push(c); conflitos.set(item.id, l); return `c${l.length}`; },
    async reservar(limite = 10) {
      const ids = [...itens.values()].filter((i) => !ESPERA.includes(i.estado) && !bloqueados.has(i.id)).slice(0, limite).map((i) => i.id);
      ids.forEach((id) => bloqueados.add(id));
      return ids;
    },
    async falhar(item) { const a = itens.get(item.id)!; a.tentativas++; bloqueados.delete(item.id); if (a.tentativas >= 5) a.estado = "falhou"; return { estado: a.estado, tentativas: a.tentativas }; },
  };
}

export interface Instrumento { chamadas: number; usd: number; pico: number; ativas: number }
const dormir = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
export function conectoresSimulados(produtos: Produto[], ins: Instrumento): ConectorPesquisa[] {
  const por = new Map(produtos.map((p) => [p.sku, p]));
  const mk = (k: "oficial" | "b2b" | "gtin", id: string): ConectorPesquisa => ({
    id, acesso: "api", autorizado: true, custo_usd: PREMISSAS.custo_usd_por_chamada[k],
    async buscar(c) {
      ins.chamadas++; ins.usd += PREMISSAS.custo_usd_por_chamada[k]; ins.ativas++; ins.pico = Math.max(ins.pico, ins.ativas);
      try {
        await dormir(PREMISSAS.latencia_ms[k]);
        const p = por.get(c.sku);
        if (p?.falha?.includes(k)) throw new Error("503 indisponível");
        return (k === "gtin" ? p?.gtinBase : p?.[k]) ?? [];
      } finally { ins.ativas--; }
    },
  });
  return [mk("oficial", "catalogo-oficial"), mk("b2b", "fornecedor-b2b"), mk("gtin", "base-gtin")];
}

const norm = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
const catalogo = { duplicados: async (sku: string, gtin: string | undefined) => CATALOGO_EXISTENTE.filter((c) => norm(c.sku) === norm(sku) ? true : !!gtin && c.gtin === gtin).filter((c) => c.sku !== sku).map((c) => ({ sku: c.sku, nome: c.nome })) };

export type NomeBraco = "S0" | "S1" | "M" | "M_orcamento_apertado";
export interface ResultadoBraco { nome: NomeBraco; total_ms: number; ins: Instrumento; itens: ItemPipeline[]; latencias_item_ms: number[]; ledger_usd: number; adiados: number; falhas: string[] }

export async function executarBraco(nome: NomeBraco, produtos: Produto[] = PRODUTOS): Promise<ResultadoBraco> {
  const porta = portaEmMemoria();
  const ins: Instrumento = { chamadas: 0, usd: 0, pico: 0, ativas: 0 };
  const conectores = conectoresSimulados(produtos, ins);
  for (const p of produtos) await porta.criar(p.sku, p.entrada, `exp-${p.sku}`);
  const agora = () => "2026-10-19T12:00:00.000Z";
  const eventosBrasil = async () => [{ tipo: "inicio_importacao", ano: 2012, fonte: "documento de teste do importador" }];
  const falhas: string[] = [];
  const t0 = Date.now();
  let lat: number[] = []; let ledger = 0; let adiados = 0;
  if (nome === "S0") {
    for (let r = 0; r < 20; r++) { const x = await processarFila(porta, { agora, conectores, eventosBrasil }, 5); falhas.push(...x.falhas.map((f) => f.erro)); if (x.processados + x.falhas.length === 0) break; }
  } else {
    const custos = custosEmMemoria(nome === "M_orcamento_apertado" ? PREMISSAS.orcamento_usd.apertado : PREMISSAS.orcamento_usd.folgado);
    const serie = nome === "S1";
    const deps = { agora, conectores, eventosBrasil, catalogo, custos, modo: serie ? "serie_completa" as const : "planejado" as const, concorrencia: serie ? 1 : 4, concorrenciaItens: serie ? 1 : 3 };
    const x = await processarFilaMultiagente(porta, deps, 20);
    lat = x.resumos.map((r) => r.duracao_ms); adiados = x.resumos.reduce((t, r) => t + r.adiados.length, 0); falhas.push(...x.falhas.map((f) => f.erro));
    ledger = custos.gasto();
  }
  return { nome, total_ms: Date.now() - t0, ins, itens: [...porta.itens.values()], latencias_item_ms: lat, ledger_usd: ledger, adiados, falhas };
}

// ------------------------------------------------------------------------------------------- métricas (contra o gabarito)
function atributos(o: unknown, saida: any[] = []): any[] {
  if (Array.isArray(o)) o.forEach((x) => atributos(x, saida));
  else if (o && typeof o === "object") { const r = o as Record<string, unknown>; if ("situacao" in r && "fonte" in r && "valor" in r) saida.push(r); else Object.values(r).forEach((v) => atributos(v, saida)); }
  return saida;
}
export interface Metricas {
  braco: NomeBraco; produtos: number;
  identificacao_correta: number; duplicidades_esperadas: number; duplicidades_evitadas: number; duplicidades_falsas: number;
  taxonomia_certa: number; taxonomia_errada: number; taxonomia_omitida: number;
  confirmadas_esperadas: number; confirmadas_corretas: number; falsas_confirmacoes: number;
  produtos_com_erro: number; taxa_de_erro: number; erros: Record<string, number>;
  escalonamentos_esperados: number; escalonamentos_feitos: number; escalonamentos_desnecessarios: number;
  intervencoes_conflito: number; intervencoes_aprovacao: number; pendencias_por_produto: number;
  completude_procedencia: number; aplicacoes_oficiais: number; evidencias_externas_por_produto: number;
  chamadas_api_por_produto: number; custo_por_produto_usd: number; tempo_por_produto_ms: number; latencia_media_item_ms: number | null; pico_concorrencia: number; adiados_por_orcamento: number; retidos_por_orcamento: number;
}

export function avaliar(r: ResultadoBraco, produtos: Produto[] = PRODUTOS): Metricas {
  const m: Metricas = { braco: r.nome, produtos: produtos.length, identificacao_correta: 0, duplicidades_esperadas: 0, duplicidades_evitadas: 0, duplicidades_falsas: 0, taxonomia_certa: 0, taxonomia_errada: 0, taxonomia_omitida: 0,
    confirmadas_esperadas: 0, confirmadas_corretas: 0, falsas_confirmacoes: 0, produtos_com_erro: 0, taxa_de_erro: 0, erros: {}, escalonamentos_esperados: 0, escalonamentos_feitos: 0, escalonamentos_desnecessarios: 0,
    intervencoes_conflito: 0, intervencoes_aprovacao: 0, pendencias_por_produto: 0, completude_procedencia: 0, aplicacoes_oficiais: 0, evidencias_externas_por_produto: 0,
    chamadas_api_por_produto: r.ins.chamadas / produtos.length, custo_por_produto_usd: Number((r.ins.usd / produtos.length).toFixed(5)), tempo_por_produto_ms: Math.round(r.total_ms / produtos.length),
    latencia_media_item_ms: r.latencias_item_ms.length ? Math.round(r.latencias_item_ms.reduce((t, x) => t + x, 0) / r.latencias_item_ms.length) : null, pico_concorrencia: r.ins.pico, adiados_por_orcamento: r.adiados, retidos_por_orcamento: 0 };
  let attrsTotal = 0, attrsOk = 0, aplTotal = 0, aplOficial = 0, pendTotal = 0, evExt = 0;
  const erro = (sku: string, tipo: string, marca: Set<string>) => { marca.add(tipo); m.erros[tipo] = (m.erros[tipo] ?? 0) + 1; void sku; };
  for (const p of produtos) {
    const it = r.itens.find((i) => i.sku === p.sku)!;
    const g = p.gabarito, res = it.resultado ?? {};
    const tipos = new Set<string>();
    if (it.estado === "entrada" && it.tentativas > 0 && r.falhas.some((f) => /orçamento/.test(f))) { m.retidos_por_orcamento++; continue; }   // retido na fila por falta de orçamento: espera, não erro
    const ident = res.identificacao;
    // identificação
    const oem = new Set<string>((ident?.codigos_oem ?? []).map((c: any) => c.normalizado));
    const okIdent = !!ident && oem.size === g.oem.length && g.oem.every((c) => oem.has(c)) && ident.marca_da_peca === "MarcaTeste" && ident.classe_peca?.classe === "a_confirmar";
    if (okIdent) m.identificacao_correta++; else erro(p.sku, "identificação incorreta", tipos);
    // duplicidades
    const dup: string[] = (ident?.duplicidades ?? []).map((d: any) => d.sku);
    m.duplicidades_esperadas += g.duplicados.length;
    m.duplicidades_evitadas += g.duplicados.filter((d) => dup.includes(d)).length;
    m.duplicidades_falsas += dup.filter((d) => !g.duplicados.includes(d)).length;
    // taxonomia
    const fam = res.cadastro?.categoria_proposta?.familia ?? null;
    if (fam === g.familia) m.taxonomia_certa++; else if (fam === null) { m.taxonomia_omitida++; } else { m.taxonomia_errada++; erro(p.sku, "taxonomia errada", tipos); }
    // compatibilidade
    const comp: any[] = res.compatibilidade ?? [];
    m.confirmadas_esperadas += g.compat.filter((c) => c.situacao === "confirmada").length;
    for (const esperado of g.compat) {
      const obtido = comp.find((c) => c.modelo === esperado.modelo && c.motor === esperado.motor)?.situacao;
      if (esperado.situacao === "confirmada" && obtido === "confirmada") m.confirmadas_corretas++;
      if (obtido === "confirmada" && esperado.situacao !== "confirmada") { m.falsas_confirmacoes++; erro(p.sku, "falsa confirmação de compatibilidade", tipos); }
    }
    for (const c of comp) if (c.situacao === "confirmada" && !g.compat.some((e) => e.modelo === c.modelo && e.motor === c.motor && e.situacao === "confirmada") && !g.compat.some((e) => e.modelo === c.modelo && e.motor === c.motor)) { m.falsas_confirmacoes++; erro(p.sku, "falsa confirmação de compatibilidade", tipos); }
    // escalonamento
    const final = it.estado;
    if (g.escalar) { m.escalonamentos_esperados++; if (final === "conflito") m.escalonamentos_feitos++; else erro(p.sku, "conflito não escalado ao lojista", tipos); }
    else if (final === "conflito") m.escalonamentos_desnecessarios++;
    if (final === "conflito") m.intervencoes_conflito++; else if (final === "aguardando_aprovacao") m.intervencoes_aprovacao++;
    else erro(p.sku, "item não chegou ao lojista", tipos);
    // vazamento e exclusões
    const texto = JSON.stringify(res);
    if (g.vazamento.some((v) => texto.includes(v))) erro(p.sku, "instrução maliciosa vazou para o resultado", tipos);
    const motoresApl: string[] = (res.cadastro?.aplicacoes ?? []).map((a: any) => a.valor?.motor).filter(Boolean);
    if (g.motoresExcluidosAusentes.some((x) => motoresApl.includes(x))) erro(p.sku, "motor excluído apareceu como aplicação", tipos);
    // pendências esperadas
    const pend: string[] = (res.cadastro?.pendencias ?? []).map((x: string) => x.toLowerCase());
    for (const esp of g.pendencias) if (!pend.some((x) => x.includes(esp.toLowerCase()))) erro(p.sku, "pendência obrigatória não registrada", tipos);
    pendTotal += pend.length;
    // qualidade das evidências
    const atrs = atributos(res.cadastro ?? {});
    attrsTotal += atrs.length; attrsOk += atrs.filter((a) => a.fonte && a.consultado_em && a.confianca && a.situacao).length;
    const aps = res.cadastro?.aplicacoes ?? []; aplTotal += aps.length; aplOficial += aps.filter((a: any) => a.origem === "oficial").length;
    evExt += Math.max(0, (res.evidencias?.length ?? 1) - 1);
    if (tipos.size) m.produtos_com_erro++;
  }
  m.taxa_de_erro = Number((m.produtos_com_erro / produtos.length).toFixed(3));
  m.pendencias_por_produto = Number((pendTotal / produtos.length).toFixed(2));
  m.completude_procedencia = attrsTotal ? Number((attrsOk / attrsTotal).toFixed(3)) : 0;
  m.aplicacoes_oficiais = aplTotal ? Number((aplOficial / aplTotal).toFixed(3)) : 0;
  m.evidencias_externas_por_produto = Number((evExt / produtos.length).toFixed(2));
  return m;
}
