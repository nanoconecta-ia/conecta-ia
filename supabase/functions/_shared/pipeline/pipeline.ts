// Orquestrador do pipeline de indexação: ENTRADA → NORMALIZAÇÃO → IDENTIFICAÇÃO → PESQUISA → COMPARAÇÃO → VALIDAÇÃO → ENRIQUECIMENTO
// → APROVAÇÃO (humana) → SINCRONIZAÇÃO. Cada passo é uma transição registrada no banco; o agente nunca aprova nem escreve no ERP:
// a sincronização passa pelo executor existente (proposta versionada, hash, idempotência, leitura de confirmação).
import { extrair, type Extracao } from "./extracao.ts";
import { compararEvidencias, type Conflito, type Evidencia } from "./comparacao.ts";
import { aplicacoesDeExtracao, consultarConectores, type ConectorPesquisa } from "./conectores.ts";
import { montarCadastro, type Cadastro, type EntradaBling } from "./cadastro.ts";
import { confereAnos, type EventoBrasil } from "./periodos.ts";

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
export type EstadoPipeline = "entrada" | "normalizado" | "identificado" | "pesquisado" | "comparado" | "conflito" | "validado" | "enriquecido" | "aguardando_aprovacao" | "aprovado" | "sincronizando" | "sincronizado" | "rejeitado" | "falhou";
export interface ItemPipeline { id: string; loja_id: string; sku: string | null; estado: EstadoPipeline; versao: number; entrada: any; resultado: any; tentativas: number; proposta_id: string | null; conflitos_abertos: number }
export interface EntradaPipeline { nome: string; descricao?: string; marca?: string; gtin?: string; bling?: EntradaBling }

export interface PortaPipeline {
  criar(sku: string, entrada: EntradaPipeline, idem: string, produtoId?: string | null): Promise<string>;
  obter(id: string): Promise<ItemPipeline>;
  avancar(item: ItemPipeline, para: EstadoPipeline, o?: { ator?: string; motivo?: string; evidencias?: unknown[]; resultado?: Record<string, unknown>; proposta?: string }): Promise<ItemPipeline>;
  registrarConflito(item: ItemPipeline, c: Conflito): Promise<string>;
  reservar(limite?: number): Promise<string[]>;
  falhar(item: ItemPipeline, erro: string): Promise<{ estado: string; tentativas: number }>;
}

export function portaPipeline(rpc: Rpc, lojaId: string): PortaPipeline {
  const chamar = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await rpc(fn, args); if (error) throw new Error(error.message); return data; };
  const porta: PortaPipeline = {
    criar: (sku, entrada, idem, produtoId = null) => chamar("pipeline_criar", { p_loja: lojaId, p_sku: sku, p_produto: produtoId, p_entrada: entrada, p_idem: idem }),
    obter: (id) => chamar("pipeline_obter", { p_loja: lojaId, p_item: id }),
    async avancar(item, para, o = {}) {
      await chamar("pipeline_avancar", { p_loja: lojaId, p_item: item.id, p_para: para, p_versao_esperada: item.versao, p_ator: o.ator ?? "pipeline", p_user: null,
        p_motivo: o.motivo ?? null, p_evidencias: o.evidencias ?? [], p_resultado: o.resultado ?? null, p_proposta: o.proposta ?? null });
      return porta.obter(item.id);
    },
    registrarConflito: (item, c) => chamar("pipeline_registrar_conflito", { p_loja: lojaId, p_item: item.id, p_tipo: c.tipo, p_campo: c.campo, p_a: c.lado_a, p_b: c.lado_b }),
    reservar: async (limite = 10) => (await chamar("pipeline_reservar", { p_loja: lojaId, p_limite: limite, p_lease_s: 120, p_max_simultaneos: 5 })) ?? [],
    falhar: (item, erro) => chamar("pipeline_falhar", { p_loja: lojaId, p_item: item.id, p_erro: erro, p_max_tentativas: 5 }),
  };
  return porta;
}

export interface DepsPipeline {
  agora(): string;
  conectores: ConectorPesquisa[];
  /** marca (sem acento, minúscula) → fonte que a classifica como OEM. Vazio por padrão: sem fonte, a classe fica "a_confirmar". */
  homologados?: Record<string, string>;
  eventosBrasil?(sku: string): Promise<EventoBrasil[]>;
  permitirNavegacao?: boolean;
  /** Cria a proposta versionada (aprovação humana + executor). Obrigatório para sincronizar. */
  criarProposta?(item: ItemPipeline, cadastro: Cadastro): Promise<string>;
  /** Lê de volta o resultado da execução da proposta. Sem confirmação, não se declara sucesso. */
  confirmarSincronizacao?(propostaId: string): Promise<{ confirmado: boolean; evidencia: unknown }>;
}

const MONTADORAS = ["Hyundai", "Kia", "Toyota", "Mitsubishi", "Nissan", "Ford", "Fiat", "Volkswagen", "Chevrolet", "Mercedes-Benz"];
const semAcento = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

function classeDaPeca(marca: string | null, texto: string, homologados: Record<string, string>) {
  const m = semAcento(marca ?? "").replace(/^marca\s*:\s*/, "");
  if (!m) return { classe: "a_confirmar", evidencia: null, pendencia: "marca ausente" };
  const declara = ["genuina", "genuino", "original hyundai", "original kia"].some((p) => semAcento(texto).includes(p));
  if (["hyundai", "kia", "mobis", "hyundai mobis"].includes(m) && declara) return { classe: "genuina", evidencia: `marca '${marca}' e o texto declara peça genuína`, pendencia: "confirmar no catálogo da montadora" };
  if (homologados[m]) return { classe: "oem", evidencia: homologados[m], pendencia: null };
  return { classe: "a_confirmar", evidencia: null, pendencia: `marca '${marca}' sem fonte que a classifique (OEM ou reposição)` };
}

function evidenciaDoCadastro(sku: string, ext: Extracao, bling: EntradaBling | undefined, agora: string): Evidencia {
  const ap = aplicacoesDeExtracao(ext);
  return {
    fonte: `bling:${sku}`, tipo_fonte: "bling", consultado_em: agora,
    dados: { oem: ext.codigos_oem.filter((c) => c.confianca === "media").map((c) => c.normalizado), gtin: ext.gtin?.valido ? ext.gtin.valor : undefined, peso_kg: bling?.peso_kg && bling.peso_kg > 0 ? bling.peso_kg : undefined, aplicacoes: ap.aplicacoes },
  };
}

/** Executa UMA transição. Estados que esperam uma pessoa (conflito, aguardando_aprovacao) e estados finais não andam. */
export async function executarPasso(porta: PortaPipeline, deps: DepsPipeline, item: ItemPipeline): Promise<ItemPipeline> {
  const agora = deps.agora();
  const sku = item.sku ?? "";
  const e: EntradaPipeline = item.entrada;
  const r = item.resultado ?? {};
  switch (item.estado) {
    case "entrada": {
      const ext = extrair(sku, e.nome ?? "", e.descricao ?? "", e.marca ?? "", e.gtin ?? "");
      return porta.avancar(item, "normalizado", { motivo: "texto normalizado e extraído", resultado: { extracao: ext } });
    }
    case "normalizado": {
      const ext: Extracao = r.extracao;
      const homologados = deps.homologados ?? {};
      const classe = classeDaPeca(ext.marca_fabricante, ext.texto_fonte, homologados);
      const montadoras = MONTADORAS.filter((m) => new RegExp(`(?<![A-Za-z])${m}(?![A-Za-z])`, "i").test(ext.texto_fonte));
      const ident = {
        sku, marca_da_peca: ext.marca_fabricante, montadoras_citadas: montadoras, classe_peca: classe,
        gtin_valido: ext.gtin ? ext.gtin.valido : null, codigos_oem: ext.codigos_oem,
        ambiguidades: [...(aplicacoesDeExtracao(ext).ambigua ? ["mais de um veículo ou motor no mesmo texto: não se deduz aplicação; separar por versão"] : [])],
      };
      return porta.avancar(item, "identificado", { motivo: "peça identificada (marca da peça ≠ montadora do veículo)", resultado: { identificacao: ident } });
    }
    case "identificado": {
      const ext: Extracao = r.extracao;
      const rel = await consultarConectores(deps.conectores, { sku, oem: ext.codigos_oem.map((c) => c.normalizado), gtin: ext.gtin?.valor, marca: ext.marca_fabricante ?? undefined }, { agora, permitirNavegacao: deps.permitirNavegacao });
      if (rel.tentados > 0 && rel.falhas.length === rel.tentados) throw new Error(`todos os conectores falharam: ${rel.falhas.map((f) => `${f.id}: ${f.erro}`).join("; ")}`);
      const evidencias = [evidenciaDoCadastro(sku, ext, e.bling, agora), ...rel.evidencias];
      return porta.avancar(item, "pesquisado", { motivo: `${rel.evidencias.length} evidência(s) externa(s)`, resultado: { evidencias, pesquisa: { ignorados: rel.ignorados, falhas: rel.falhas, ambiguas: rel.ambiguas } } });
    }
    case "pesquisado": {
      const conflitos = compararEvidencias(r.evidencias as Evidencia[]);
      for (const c of conflitos) await porta.registrarConflito(item, c);
      return porta.avancar(item, "comparado", { motivo: `${conflitos.length} conflito(s) entre fontes`, resultado: { conflitos_detectados: conflitos.length } });
    }
    case "comparado": {
      if (item.conflitos_abertos > 0) return porta.avancar(item, "conflito", { motivo: "há conflito entre fontes; decisão do lojista" });
      const ext: Extracao = r.extracao;
      const pend: string[] = [];
      if (ext.gtin && !ext.gtin.valido) pend.push("GTIN com dígito verificador inválido");
      pend.push(...confereAnos(ext.aplicacao.anos_informados, deps.eventosBrasil ? await deps.eventosBrasil(sku) : []));
      if (r.identificacao?.classe_peca?.pendencia) pend.push(r.identificacao.classe_peca.pendencia);
      pend.push(...(r.identificacao?.ambiguidades ?? []));
      return porta.avancar(item, "validado", { motivo: pend.length ? `${pend.length} pendência(s) de validação` : "validado sem pendências", resultado: { validacao: { pendencias: pend } } });
    }
    case "validado": {
      const cadastro = montarCadastro(sku, { ...(e.bling ?? {}), nome: e.bling?.nome ?? e.nome, marca: e.marca }, r.extracao, r.evidencias, agora);
      const fontes = [...new Set((r.evidencias as Evidencia[]).map((x) => x.fonte))];
      return porta.avancar(item, "enriquecido", { motivo: "cadastro montado só com dado que tem fonte", evidencias: fontes.map((f) => ({ fonte: f, consultado_em: agora })), resultado: { cadastro: { ...cadastro, pendencias: [...cadastro.pendencias, ...(r.validacao?.pendencias ?? [])] } } });
    }
    case "enriquecido":
      return porta.avancar(item, "aguardando_aprovacao", { motivo: "pronto para decisão do lojista" });
    case "aprovado": {
      if (!deps.criarProposta) throw new Error("sincronização não configurada: falta criarProposta (aprovação humana + executor)");
      const propostaId = await deps.criarProposta(item, r.cadastro);
      return porta.avancar(item, "sincronizando", { ator: "executor", motivo: "proposta criada a partir do cadastro aprovado", proposta: propostaId });
    }
    case "sincronizando": {
      if (!deps.confirmarSincronizacao || !item.proposta_id) throw new Error("sem como confirmar a sincronização");
      const c = await deps.confirmarSincronizacao(item.proposta_id);
      if (!c.confirmado) throw new Error("leitura de confirmação não confirmou a escrita; não se declara sucesso");
      return porta.avancar(item, "sincronizado", { ator: "executor", motivo: "leitura após escrita confirmou", evidencias: [c.evidencia] });
    }
    default:
      return item;
  }
}

const ESPERA: EstadoPipeline[] = ["conflito", "aguardando_aprovacao", "sincronizado", "rejeitado", "falhou"];
export interface ResumoFila { processados: number; paradosEm: Record<string, number>; falhas: { item: string; erro: string }[] }

/** Worker: reserva itens vencidos (com limite por loja), anda cada um até um ponto de espera e, em erro, agenda nova tentativa com recuo. */
export async function processarFila(porta: PortaPipeline, deps: DepsPipeline, limite = 10, passosMax = 14): Promise<ResumoFila> {
  const resumo: ResumoFila = { processados: 0, paradosEm: {}, falhas: [] };
  for (const id of await porta.reservar(limite)) {
    let item = await porta.obter(id);
    try {
      for (let i = 0; i < passosMax && !ESPERA.includes(item.estado); i++) item = await executarPasso(porta, deps, item);
      resumo.processados++;
      resumo.paradosEm[item.estado] = (resumo.paradosEm[item.estado] ?? 0) + 1;
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err);
      resumo.falhas.push({ item: id, erro });
      await porta.falhar(item, erro);
    }
  }
  return resumo;
}
