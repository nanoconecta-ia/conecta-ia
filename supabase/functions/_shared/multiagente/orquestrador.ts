// Orquestrador multiagente: recebe um item novo/alterado, identifica o que falta, planeja SÓ as tarefas necessárias, executa as pesquisas
// independentes em paralelo (com limite de concorrência, de taxa por fonte e de orçamento), consolida em dados estruturados, encaminha conflitos
// para revisão humana e registra custos, fontes e decisões. Usa a MESMA máquina de estados persistente do pipeline: nada de estado paralelo.
import { evidenciaDoCadastro, executarPasso, type DepsPipeline, type EntradaPipeline, type ItemPipeline, type PortaPipeline } from "../pipeline/pipeline.ts";
import type { ConectorPesquisa } from "../pipeline/conectores.ts";
import type { Evidencia } from "../pipeline/comparacao.ts";
import { identificar, type Identificacao, type PortaCatalogo } from "./identificador.ts";
import { pesquisar, type ResultadoPesquisa } from "./pesquisador.ts";
import { classificar, type ClassificadorLLM, type Classificacao } from "./taxonomista.ts";
import { avaliarCompatibilidade } from "./compatibilidade.ts";
import { enriquecer } from "./enriquecedor.ts";
import { auditar, type Auditoria } from "./auditor.ts";
import { criarLimitador, criarLimiteTaxa, somar, type CapacidadeId, type PortaCustos, type RegistroCusto } from "./custos.ts";

export interface DepsMultiagente extends DepsPipeline { catalogo: PortaCatalogo; custos: PortaCustos; concorrencia?: number; concorrenciaItens?: number; classificadorLLM?: ClassificadorLLM; limiteTaxa?: ReturnType<typeof criarLimiteTaxa> }
export interface Tarefa { id: string; capacidade: CapacidadeId; dependeDe: string[]; motivo: string }
export interface Plano { tarefas: Tarefa[]; puladas: { capacidade: CapacidadeId; motivo: string }[] }
export interface ResumoMultiagente { sku: string; estado: string; plano: Plano; auditoria: Auditoria; custos: ReturnType<typeof somar>; registros: RegistroCusto[]; duracao_ms: number; adiados: { id: string; motivo: string }[] }

/** Planeja SOMENTE o necessário. Cada tarefa pulada fica registrada com o motivo (auditável). */
export function planejar(entrada: EntradaPipeline & { categoria_definida?: boolean }, ident: Identificacao, conectores: ConectorPesquisa[]): Plano {
  const tarefas: Tarefa[] = [{ id: "identificar", capacidade: "identificador", dependeDe: [], motivo: "sempre: reconhece SKU, OEM, GTIN, marca e duplicidades" }];
  const puladas: Plano["puladas"] = [];
  const elegiveis = conectores.filter((c) => c.autorizado);
  const temId = ident.codigos_oem.length > 0 || !!ident.gtin?.valido;
  const pesq: string[] = [];
  if (!elegiveis.length) puladas.push({ capacidade: "pesquisador", motivo: "nenhum conector autorizado" });
  else if (!temId) puladas.push({ capacidade: "pesquisador", motivo: "sem identificador pesquisável (OEM ou GTIN válido): pesquisar por nome geraria compatibilidade presumida" });
  else for (const c of elegiveis) { tarefas.push({ id: `pesquisar:${c.id}`, capacidade: "pesquisador", dependeDe: ["identificar"], motivo: "independente das demais fontes: roda em paralelo" }); pesq.push(`pesquisar:${c.id}`); }
  if (entrada.categoria_definida) puladas.push({ capacidade: "taxonomista", motivo: "categoria já definida e aprovada" });
  else tarefas.push({ id: "classificar", capacidade: "taxonomista", dependeDe: ["identificar"], motivo: "sem categoria na árvore fechada; independente da pesquisa" });
  if (!ident.extracao.aplicacao.veiculos_citados.length && !pesq.length) puladas.push({ capacidade: "compatibilidade", motivo: "sem veículo no cadastro e sem evidência externa" });
  else tarefas.push({ id: "compatibilidade", capacidade: "compatibilidade", dependeDe: ["identificar", ...pesq], motivo: "avalia aplicação por versão, motor e período" });
  tarefas.push({ id: "enriquecer", capacidade: "enriquecedor", dependeDe: ["classificar", "compatibilidade"].filter((d) => tarefas.some((t) => t.id === d)), motivo: "monta o cadastro só com dado que tem fonte" });
  tarefas.push({ id: "auditar", capacidade: "auditor", dependeDe: ["enriquecer"], motivo: "sempre: evidências, conflitos, riscos e permissões antes do lojista" });
  return { tarefas, puladas };
}

const cronometrar = async <T>(f: () => Promise<T>): Promise<[T, number]> => { const t = Date.now(); const r = await f(); return [r, Date.now() - t]; };

/** Processa UM item em `entrada`. Para em `aguardando_aprovacao` (ok) ou `conflito` (revisão humana); nunca aprova, sincroniza ou publica. */
export async function processarItemMultiagente(porta: PortaPipeline, deps: DepsMultiagente, item: ItemPipeline): Promise<ResumoMultiagente> {
  const t0 = Date.now();
  const sku = item.sku ?? "";
  const e: EntradaPipeline & { categoria_definida?: boolean } = item.entrada;
  const agora = deps.agora();
  const regs: RegistroCusto[] = [];
  const reg = async (r: Omit<RegistroCusto, "chamadas" | "tokens_in" | "tokens_out" | "usd"> & Partial<RegistroCusto>) => { const x: RegistroCusto = { chamadas: 0, tokens_in: 0, tokens_out: 0, usd: 0, ...r }; regs.push(x); await deps.custos.registrar(x); };

  const [ident, dId] = await cronometrar(() => identificar(sku, e, deps.catalogo, deps.homologados ?? {}));
  await reg({ capacidade: "identificador", tarefa: "identificar", tipo: "deterministica", duracao_ms: dId });
  const plano = planejar(e, ident, deps.conectores);
  let it = await porta.avancar(item, "normalizado", { motivo: "texto normalizado e extraído", resultado: { extracao: ident.extracao } });
  it = await porta.avancar(it, "identificado", { motivo: "peça identificada (marca da peça ≠ montadora do veículo)", resultado: { identificacao: { sku, marca_da_peca: ident.marca_da_peca, montadoras_citadas: ident.montadoras_citadas, classe_peca: ident.classe_peca, gtin_valido: ident.gtin ? ident.gtin.valido : null, codigos_oem: ident.codigos_oem, ambiguidades: ident.ambiguidades, duplicidades: ident.duplicidades } } });

  const limiteTaxa = deps.limiteTaxa ?? criarLimiteTaxa();
  const vazia: ResultadoPesquisa = { evidencias: [], ignorados: [], falhas: [], adiados: [], ambiguas: [], tentados: 0 };
  const querPesquisa = plano.tarefas.some((t) => t.capacidade === "pesquisador");
  const querTax = plano.tarefas.some((t) => t.id === "classificar");
  // pesquisa e taxonomia são independentes: rodam juntas; dentro da pesquisa, cada fonte também roda em paralelo
  const [[pesq, dPesq], [tax, dTax]] = await Promise.all([
    cronometrar(async () => querPesquisa ? await pesquisar(deps.conectores, { sku, oem: ident.codigos_oem.map((c) => c.normalizado), gtin: ident.gtin?.valor, marca: ident.marca_da_peca ?? undefined }, { agora, concorrencia: deps.concorrencia ?? 4, custos: { ...deps.custos, registrar: async (r) => { regs.push(r); await deps.custos.registrar(r); }, confirmar: async (id, r) => { regs.push(r); await deps.custos.confirmar(id, r); } }, permitirNavegacao: deps.permitirNavegacao, limiteTaxa }) : vazia),
    cronometrar(async () => querTax ? await classificar(e.nome ?? "", e.descricao ?? "", { custos: { ...deps.custos, confirmar: async (id, r) => { regs.push(r); await deps.custos.confirmar(id, r); } }, llm: deps.classificadorLLM }) : { classificacao: null as Classificacao | null, pendencia: null as string | null, duracao_ms: 0 }),
  ]);
  if (querTax && !regs.some((r) => r.capacidade === "taxonomista")) await reg({ capacidade: "taxonomista", tarefa: "classificar:regra", tipo: "deterministica", duracao_ms: dTax });
  if (querPesquisa && pesq.tentados > 0 && pesq.tentados === pesq.falhas.length) throw new Error(`todos os conectores falharam: ${pesq.falhas.map((f) => `${f.id}: ${f.erro}`).join("; ")}`);

  const evidencias: Evidencia[] = [evidenciaDoCadastro(sku, ident.extracao, e.bling, agora), ...pesq.evidencias];
  it = await porta.avancar(it, "pesquisado", { motivo: `${pesq.evidencias.length} evidência(s) externa(s) em ${dPesq} ms`, resultado: { evidencias, pesquisa: { ignorados: pesq.ignorados, falhas: pesq.falhas, adiados: pesq.adiados, ambiguas: pesq.ambiguas } } });

  const [compat, dComp] = await cronometrar(async () => avaliarCompatibilidade(ident.extracao, evidencias, deps.eventosBrasil ? await deps.eventosBrasil(sku) : []));
  await reg({ capacidade: "compatibilidade", tarefa: "avaliar", tipo: "deterministica", duracao_ms: dComp });
  for (const c of compat.conflitos) await porta.registrarConflito(it, c);
  it = await porta.avancar(it, "comparado", { motivo: `${compat.conflitos.length} conflito(s) entre fontes`, resultado: { conflitos_detectados: compat.conflitos.length, compatibilidade: compat.aplicacoes } });

  const [cadastro0, dEnr] = await cronometrar(async () => enriquecer(sku, { nome: e.nome, marca: e.marca, bling: e.bling }, ident.extracao, evidencias, agora, tax.classificacao));
  await reg({ capacidade: "enriquecedor", tarefa: "montar-cadastro", tipo: "deterministica", duracao_ms: dEnr });
  const pend = [...cadastro0.pendencias, ...compat.pendencias, ...(ident.classe_peca.pendencia ? [ident.classe_peca.pendencia] : []), ...ident.ambiguidades, ...(tax.pendencia ? [tax.pendencia] : []),
    ...ident.duplicidades.map((d) => `possível duplicidade com ${d.sku}`)];
  const cadastro = { ...cadastro0, pendencias: [...new Set(pend)] };
  const [aud, dAud] = await cronometrar(async () => auditar(ident, cadastro, compat, evidencias, { orcamentoEstourado: pesq.adiados.length > 0 }));
  await reg({ capacidade: "auditor", tarefa: "auditar", tipo: "deterministica", duracao_ms: dAud });

  const custos = somar(regs);
  const base = { plano, auditoria: aud, custos };
  if (!aud.aprovado_para_revisao) {
    for (const b of aud.bloqueios) await porta.registrarConflito(it, { tipo: "auditoria", campo: b.regra, lado_a: { valor: b.detalhe, fonte: "auditor", tipo_fonte: "inferida" }, lado_b: { valor: "revisão humana necessária", fonte: "auditor", tipo_fonte: "inferida" } });
  }
  const abertos = (await porta.obter(it.id)).conflitos_abertos;
  if (abertos > 0) {
    it = await porta.avancar(it, "conflito", { motivo: aud.aprovado_para_revisao ? "conflito entre fontes: decisão do lojista" : "auditor bloqueou: revisão humana", resultado: { cadastro, ...base } });
  } else {
    it = await porta.avancar(it, "validado", { motivo: pend.length ? `${pend.length} pendência(s)` : "validado sem pendências", resultado: { validacao: { pendencias: cadastro.pendencias } } });
    it = await porta.avancar(it, "enriquecido", { motivo: "cadastro montado só com dado que tem fonte", evidencias: [...new Set(evidencias.map((x) => x.fonte))].map((f) => ({ fonte: f, consultado_em: agora })), resultado: { cadastro, ...base } });
    it = await porta.avancar(it, "aguardando_aprovacao", { motivo: "auditado; pronto para decisão do lojista" });
  }
  return { sku, estado: it.estado, plano, auditoria: aud, custos, registros: regs, duracao_ms: Date.now() - t0, adiados: pesq.adiados };
}

/** Worker multiagente: itens novos passam pelo coordenador; os demais estados seguem o passo a passo da máquina de estados existente. */
export async function processarFilaMultiagente(porta: PortaPipeline, deps: DepsMultiagente, limite = 10): Promise<{ resumos: ResumoMultiagente[]; falhas: { item: string; erro: string }[] }> {
  const limitar = criarLimitador(Math.max(1, deps.concorrenciaItens ?? 3));
  const resumos: ResumoMultiagente[] = [];
  const falhas: { item: string; erro: string }[] = [];
  const ids = await porta.reservar(limite);
  await Promise.all(ids.map((id) => limitar(async () => {
    let item = await porta.obter(id);
    try {
      if (item.estado === "entrada") resumos.push(await processarItemMultiagente(porta, deps, item));
      else { for (let i = 0; i < 14 && !["conflito", "aguardando_aprovacao", "sincronizado", "rejeitado", "falhou"].includes(item.estado); i++) item = await executarPasso(porta, deps, item); }
    } catch (err) { const erro = err instanceof Error ? err.message : String(err); falhas.push({ item: id, erro }); await porta.falhar(item, erro); }
  })));
  return { resumos, falhas };
}
