// Investigação técnica (especificação 02/11/2026, seções 3, 5 e 9). Executa o plano de consultas contra um ProvedorBusca EXISTENTE (ia/busca.ts), com orçamento, cache,
// timeout por consulta e FALHA FECHADA, e devolve um relatório que separa CONFIRMADO, INFERIDO, NÃO ENCONTRADO e NÃO TESTADO.
// O QUE PROVA: só afirma que "o código aparece escrito" onde o trecho o contém literalmente; compatibilidade só com evidência FORTE (fabricante/montadora/distribuidor
// autorizado de domínio cadastrado e verificado) COM contexto de aplicação; senão responde APLICAÇÃO NÃO CONFIRMADA. Nenhuma escrita (Bling, banco, fiscal, publicação).
// O QUE NÃO PROVA: que a página diz a verdade, nem equivalência mecânica, nem direito de uso de imagem. Sem provedor configurado devolve "nao_testada", sem inventar.
import { BuscaErro, MSG_SEM_PROVEDOR, type Candidata, type ProvedorBusca, type ResultadoTecnico } from "../ia/busca.ts";
import { classeDaFonte, hashTrecho, provaCompatibilidade, validarEvidencia, type ClasseFonte, type EvidenciaBusca, type NivelEvidencia } from "./evidencia.ts";
import { montarGaleria, type CandidataEntrada, type Galeria } from "./galeria.ts";
import { ORCAMENTO_PADRAO, planejarConsultas, reformular, type Consulta, type DadosProduto, type Orcamento } from "./plano_pesquisa.ts";

export interface OpcoesInvestigacao {
  produto: DadosProduto;
  /** Códigos que provam identidade (SKU, GTIN, OEM/fabricante aprovados). Similar/substituto nunca entram. */
  codigos: string[];
  hoje: string;
  provedor: ProvedorBusca | null;
  orcamento?: Orcamento;
  sinonimos?: Record<string, string[]>;
  /** Domínios de fabricante/montadora JÁ verificados por uma pessoa (ver fabricantes.ts). Sem isso nenhuma fonte vira "oficial". */
  dominios?: Readonly<Record<string, ClasseFonte>>;
  timeoutMs?: number;
  cache?: Map<string, unknown>;
}
export interface ConsultaFeita { etapa: string; texto: string; alvo: "web" | "imagens"; resultados: number; do_cache: boolean; erro?: string }
export interface FonteConsultada { url: string; host: string; classe: ClasseFonte; nivel: NivelEvidencia; codigo: string; coletada_em: string; com_contexto_de_aplicacao: boolean }
export type StatusCompatibilidade = "confirmada" | "nao_confirmada" | "nao_testada";
export interface RelatorioPesquisa {
  sku: string;
  compatibilidade: { status: StatusCompatibilidade; mensagem: string };
  confirmado: string[]; inferido: string[]; nao_encontrado: string[]; nao_testado: string[];
  pendencias: string[];
  consultas: ConsultaFeita[];
  fontes: FonteConsultada[];
  galeria: Galeria;
  limites: { consultas_usadas: number; orcamento: Orcamento; omitidas: number; interrompida_por: string | null };
  /** Esta investigação nunca grava nada. */
  sem_escrita: true;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const colapsa = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "");
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "origem inválida"; } };
/** O primeiro código conhecido escrito literalmente no texto (grafias com hífen, espaço ou ponto valem; prefixo/sufixo de outro código não). */
function codigoNoTexto(texto: string, codigos: string[]): string | null {
  for (const c of codigos) {
    const partes = c.split(/[^A-Za-z0-9]+/).filter(Boolean).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (partes.length && new RegExp(`(^|[^A-Za-z0-9])${partes.join("[\\s_.-]*")}($|[^A-Za-z0-9])`, "i").test(texto)) return c;
  }
  return null;
}

async function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new BuscaErro(504, "timeout", "A consulta não respondeu a tempo.")), ms); })]); }
  finally { if (t) clearTimeout(t); }
}

async function evidenciaDe(titulo: string, pagina: string, resumo: string, o: OpcoesInvestigacao): Promise<EvidenciaBusca | null> {
  const trecho = `${titulo} ${resumo}`.trim().slice(0, 500);
  const codigo = codigoNoTexto(trecho, o.codigos);
  if (!codigo || !/^https:\/\//i.test(pagina)) return null;
  const alvos = [o.produto.motor, o.produto.veiculo].filter((x): x is string => !!x && x.trim().length > 1);
  const contexto = alvos.some((a) => colapsa(trecho).includes(colapsa(a))) ? trecho.slice(0, 200) : null;
  return { url: pagina, titulo: titulo.slice(0, 160) || host(pagina), editor: host(pagina), coletada_em: o.hoje, trecho, codigo_exato: codigo, contexto_aplicacao: contexto,
    sha256: await hashTrecho(trecho), classe: classeDaFonte(pagina, o.dominios ?? {}) };
}

export async function investigar(o: OpcoesInvestigacao): Promise<RelatorioPesquisa> {
  const orc = o.orcamento ?? ORCAMENTO_PADRAO, alvoEv = { codigos: o.codigos };
  const plano = planejarConsultas(o.produto, orc);
  const rel: RelatorioPesquisa = {
    sku: o.produto.sku, compatibilidade: { status: "nao_testada", mensagem: "APLICAÇÃO NÃO CONFIRMADA: a pesquisa não foi executada." },
    confirmado: [], inferido: [], nao_encontrado: [], nao_testado: [], pendencias: [], consultas: [], fontes: [],
    galeria: { itens: [], omitidas: 0, duplicadas: 0, aprovacoes_automaticas: 0 }, limites: { consultas_usadas: 0, orcamento: orc, omitidas: plano.omitidas, interrompida_por: null }, sem_escrita: true,
  };
  const NAO_TESTADO = ["diferenças físicas entre a peça e as referências (fixação, polia, conexões, dimensões)", "se o código está visível dentro da fotografia", "licença e autorização de uso de cada imagem", "marca d'água, resolução real e hash de cada imagem (nenhuma imagem é baixada aqui)", "termos de uso e robots das páginas"];
  const p = o.produto;
  if (!p.gtin?.trim()) rel.pendencias.push("GTIN/EAN ausente");
  if (!(p.oem ?? []).length) rel.pendencias.push("código OEM não confirmado");
  if (!p.codigo_fabricante?.trim()) rel.pendencias.push("código do fabricante ausente (o SKU interno não o substitui nem é OEM)");
  rel.pendencias.push("licença de uso das imagens");

  if (!o.provedor) {
    rel.nao_testado.push("pesquisa na web (nenhum provedor de busca configurado)", ...NAO_TESTADO);
    rel.compatibilidade = { status: "nao_testada", mensagem: `APLICAÇÃO NÃO CONFIRMADA: nenhuma pesquisa foi feita. ${MSG_SEM_PROVEDOR}` };
    rel.limites.interrompida_por = "sem_provedor"; return rel;
  }
  const cache = o.cache ?? new Map<string, unknown>(), timeoutMs = o.timeoutMs ?? 15_000;
  const evs: EvidenciaBusca[] = [], imagens: CandidataEntrada[] = [], vistos = new Set<string>();
  const executar = async (c: Consulta): Promise<boolean> => {
    const chave = `${c.alvo}|${c.texto}`, noCache = cache.has(chave);
    const feita: ConsultaFeita = { etapa: c.etapa, texto: c.texto, alvo: c.alvo, resultados: 0, do_cache: noCache };
    try {
      const dados: unknown = noCache ? cache.get(chave) : c.alvo === "imagens" ? await comTimeout(o.provedor!.imagens(c.texto), timeoutMs) : await comTimeout(o.provedor!.tecnico(c.texto), timeoutMs);
      if (!noCache) cache.set(chave, dados);
      if (!Array.isArray(dados)) throw new BuscaErro(502, "erro_provedor", "Resposta inesperada do provedor.");
      feita.resultados = dados.length; rel.consultas.push(feita);
      if (c.alvo === "web") for (const r of dados as ResultadoTecnico[]) { const ev = await evidenciaDe(r.titulo ?? "", r.pagina ?? "", r.resumo ?? "", o); if (ev && !vistos.has(ev.url)) { vistos.add(ev.url); evs.push(ev); } }
      else for (const k of dados as Candidata[]) { const ev = await evidenciaDe(k.titulo ?? "", k.pagina ?? "", "", o); imagens.push({ url: k.url, pagina: k.pagina, titulo: k.titulo, evidencia: ev }); }
      return true;
    } catch (e) {
      const motivo = e instanceof BuscaErro ? e.motivo : "erro_provedor";
      feita.erro = `${motivo}: ${e instanceof Error ? e.message : "falha"}`; rel.consultas.push(feita);
      if (["limite", "credencial_invalida", "sem_provedor", "recusada"].includes(motivo)) { rel.limites.interrompida_por = motivo; return false; }
      return true; // falha isolada: segue para a próxima, sem inventar resultado
    }
  };
  let seguir = true;
  for (const c of plano.consultas) { if (!seguir) break; seguir = await executar(c); }
  // sem nenhuma evidência: reformula (sinônimos fornecidos como dado) dentro do orçamento que sobrou
  if (seguir && evs.length === 0 && o.sinonimos) {
    for (const c of reformular(p, o.sinonimos, rel.consultas.map((x) => x.texto), orc.max_consultas - rel.consultas.length)) { if (!seguir) break; seguir = await executar(c); }
  }
  rel.limites.consultas_usadas = rel.consultas.filter((x) => !x.do_cache).length;

  // fontes e classificação
  for (const e of evs) {
    const v = validarEvidencia(e, alvoEv, o.hoje);
    if (v.nivel === "rejeitada") continue;
    rel.fontes.push({ url: e.url, host: host(e.url), classe: e.classe, nivel: v.nivel, codigo: e.codigo_exato, coletada_em: e.coletada_em, com_contexto_de_aplicacao: !!e.contexto_aplicacao?.trim() });
  }
  rel.galeria = montarGaleria(imagens, alvoEv, o.hoje);
  const porCodigo = new Map<string, string[]>();
  for (const f of rel.fontes) porCodigo.set(f.codigo, [...(porCodigo.get(f.codigo) ?? []), f.host]);
  for (const [cod, hs] of porCodigo) rel.confirmado.push(`O código ${cod} aparece escrito em ${hs.length} página(s): ${[...new Set(hs)].slice(0, 6).join(", ")}.`);
  const oficiais = rel.fontes.filter((f) => ["fabricante_oficial", "montadora_oficial", "distribuidor_b2b"].includes(f.classe));
  if (!oficiais.length) rel.nao_encontrado.push("Nenhuma fonte de fabricante, montadora ou distribuidor autorizado (domínio verificado) com o código.");
  if (!rel.fontes.length) rel.nao_encontrado.push("Nenhuma página em que algum código do produto apareça escrito.");
  const comCtx = rel.fontes.filter((f) => f.com_contexto_de_aplicacao && f.nivel !== "forte");
  if (comCtx.length) rel.inferido.push(`A aplicação é citada por ${comCtx.length} fonte(s) de descoberta (${[...new Set(comCtx.map((f) => f.host))].slice(0, 4).join(", ")}): é indício, não prova.`);
  if (!(p.oem ?? []).length) rel.nao_encontrado.push("OEM confirmado para este código.");
  rel.nao_testado.push(...NAO_TESTADO);
  const prova = provaCompatibilidade(evs, alvoEv, o.hoje);
  rel.compatibilidade = prova.prova
    ? { status: "confirmada", mensagem: `Aplicação sustentada por fonte forte: ${prova.motivo}. A pessoa ainda aprova antes de qualquer alteração.` }
    : { status: "nao_confirmada", mensagem: `APLICAÇÃO NÃO CONFIRMADA: ${prova.motivo}.` };
  if (rel.limites.interrompida_por) rel.pendencias.push(`pesquisa interrompida (${rel.limites.interrompida_por}): resultados parciais`);
  if (rel.consultas.some((c) => c.erro)) rel.pendencias.push("há consultas com erro; ver o campo consultas");
  return rel;
}
