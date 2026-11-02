// Galeria de até 8 candidatas de imagem (PR #242, requisito 4; testes de aceite 6 e 7). Pura. REAPROVEITA `imagens/regras.ts` (direitos, cruzamento, publicação) e
// `busca_segura/evidencia.ts` (prova do código); não cria regra paralela de aprovação.
// O QUE PROVA: cada candidata sai com origem, código, resolução, ângulo, licença, evidência e um ESTADO (aprovável/pendente/rejeitada); no máximo 8 e distintas;
// NENHUMA nasce aprovada nem publicável sem direitos; marca d'água de terceiros torna a candidata inutilizável (e nunca é removida); imagem de peça semelhante é rejeitada;
// o tratamento só aceita operações não destrutivas e preserva o original (SHA-256).
// O QUE NÃO PROVA: que os pixels da peça não foram alterados (isso é contrato + revisão humana, como em imagens/fidelidade_visual.ts) nem que a licença é real.
import { direitosConfirmados, type Licenca } from "../imagens/regras.ts";
import { validarEvidencia, type AlvoEvidencia, type EvidenciaBusca } from "./evidencia.ts";

export const LIMITE_GALERIA = 8;
export type AnguloImagem = "frontal" | "lateral" | "traseira" | "superior" | "detalhe" | "embalagem" | "desconhecido";
export type EstadoCandidata = "aprovavel" | "pendente" | "rejeitada";

export interface CandidataEntrada {
  url: string; pagina: string; titulo?: string | null;
  largura_px?: number | null; altura_px?: number | null; angulo?: AnguloImagem;
  /** true = tem marca d'água; false = conferido sem; null/undefined = não conferido. */
  marca_dagua?: boolean | null;
  licenca?: Licenca | null; direitos_confirmados_em?: string | null;
  sha256_imagem?: string | null;
  /** Prova do código na página de origem. Sem ela, a candidata é só pista. */
  evidencia?: EvidenciaBusca | null;
  /** O código que a candidata afirma mostrar é de OUTRA peça (semelhante, não a mesma). */
  e_peca_semelhante?: boolean;
  /** Imagem do mesmo produto, em ângulo alternativo, cujo código foi confirmado na mesma página. */
  mesmo_produto_confirmado?: boolean;
}
export interface ItemGaleria {
  url: string; pagina: string; origem: string; codigo: string | null; resolucao: string; angulo: AnguloImagem; angulo_alternativo: boolean;
  licenca: Licenca | "desconhecida"; evidencia: { url: string; coletada_em: string; nivel: string } | null;
  estado: EstadoCandidata; motivos: string[]; manuais: string[];
  /** Sempre false na saída: aprovar é decisão de uma PESSOA, por imagem; publicar só depois, com direitos (imagens/regras.ts: podePublicar). */
  aprovada: false; publicavel: false;
}
export interface Galeria { itens: ItemGaleria[]; omitidas: number; duplicadas: number; aprovacoes_automaticas: 0 }

const chave = (c: CandidataEntrada) => (c.sha256_imagem ?? c.url).toLowerCase().replace(/[?#].*$/, "");
const res = (c: CandidataEntrada) => (c.largura_px && c.altura_px ? `${c.largura_px}x${c.altura_px}` : "desconhecida");
const area = (c: CandidataEntrada) => (c.largura_px ?? 0) * (c.altura_px ?? 0);
const RANK: Record<EstadoCandidata, number> = { aprovavel: 0, pendente: 1, rejeitada: 2 };
const MIN_PX = 300;

export function avaliarCandidata(c: CandidataEntrada, alvo: AlvoEvidencia, hoje: string): ItemGaleria {
  const m: string[] = [], manuais: string[] = [];
  let estado: EstadoCandidata = "aprovavel";
  const piora = (e: EstadoCandidata) => { if (RANK[e] > RANK[estado]) estado = e; };
  if (!/^https:\/\/[^\s]+$/i.test(c.url ?? "")) { m.push("URL da imagem não é https"); piora("rejeitada"); }
  if (c.e_peca_semelhante) { m.push("mostra peça semelhante, não a mesma: rejeitada"); piora("rejeitada"); }
  if (c.marca_dagua === true) { m.push("marca d'água de terceiros: não utilizável (o sistema não remove marca d'água)"); piora("rejeitada"); }
  else if (c.marca_dagua == null) { manuais.push("marca d'água não conferida: olhar a imagem antes de aprovar"); piora("pendente"); }
  let ev: ItemGaleria["evidencia"] = null, codigo: string | null = null;
  if (!c.evidencia) { m.push("sem evidência do código na página de origem: só pista"); piora("pendente"); }
  else {
    const v = validarEvidencia(c.evidencia, alvo, hoje);
    ev = { url: c.evidencia.url, coletada_em: c.evidencia.coletada_em, nivel: v.nivel };
    codigo = c.evidencia.codigo_exato;
    if (v.nivel === "rejeitada") { m.push(`evidência rejeitada: ${v.bloqueios.join("; ")}`); piora("pendente"); }
    else if (v.nivel === "descoberta") { m.push("fonte de descoberta (marketplace ou não classificada): dá a pista, não o direito de uso nem a prova"); piora("pendente"); }
  }
  if (c.largura_px == null || c.altura_px == null) { manuais.push("resolução desconhecida: medir"); piora("pendente"); }
  else if (Math.min(c.largura_px, c.altura_px) < MIN_PX) { m.push(`resolução baixa (menor lado ${Math.min(c.largura_px, c.altura_px)}px < ${MIN_PX}px)`); piora("pendente"); }
  const licenca = c.licenca ?? "desconhecida";
  const direitos = c.licenca != null && direitosConfirmados({ licenca_tipo: c.licenca, direitos_confirmados_em: c.direitos_confirmados_em ?? null });
  if (!direitos) m.push("licença/permissão de uso não confirmada: aprovável como identidade, NÃO publicável");
  const alt = (c.angulo ?? "desconhecido") !== "frontal";
  if (alt && !c.mesmo_produto_confirmado && estado === "aprovavel") { m.push("ângulo alternativo sem confirmação de que é o mesmo produto"); piora("pendente"); }
  return {
    url: c.url, pagina: c.pagina, origem: (() => { try { return new URL(c.pagina).hostname; } catch { return "origem inválida"; } })(), codigo, resolucao: res(c),
    angulo: c.angulo ?? "desconhecido", angulo_alternativo: alt && (c.angulo ?? "desconhecido") !== "desconhecido", licenca, evidencia: ev,
    estado, motivos: m, manuais, aprovada: false, publicavel: false,
  };
}

/** Monta a galeria: dedup, avalia, ordena (aprovável antes de pendente antes de rejeitada; depois maior resolução) e corta em 8. Nenhuma sai aprovada. */
export function montarGaleria(candidatas: CandidataEntrada[], alvo: AlvoEvidencia, hoje: string, limite = LIMITE_GALERIA): Galeria {
  const vistos = new Set<string>(); const unicas: CandidataEntrada[] = []; let duplicadas = 0;
  for (const c of candidatas) { const k = chave(c); if (vistos.has(k)) { duplicadas++; continue; } vistos.add(k); unicas.push(c); }
  const ordenadas = unicas.map((c) => ({ c, i: avaliarCandidata(c, alvo, hoje) }))
    .sort((x, y) => RANK[x.i.estado] - RANK[y.i.estado] || area(y.c) - area(x.c) || x.i.url.localeCompare(y.i.url));
  const teto = Math.min(Math.max(limite, 0), LIMITE_GALERIA);
  return { itens: ordenadas.slice(0, teto).map((x) => x.i), omitidas: Math.max(ordenadas.length - teto, 0), duplicadas, aprovacoes_automaticas: 0 };
}

// ── Tratamento NÃO DESTRUTIVO: o original é preservado e a peça não muda de forma.
export const OPERACOES_PERMITIDAS = ["fundo_branco", "enquadramento", "expansao_canvas", "correcao_luz_conservadora", "reducao_para_exibicao"] as const;
export const OPERACOES_PROIBIDAS = ["super_resolucao_generativa", "inpainting", "remover_marca_dagua", "recorte_da_peca", "espelhar", "rotacionar", "perspectiva", "redesenhar", "apagar_inscricao", "gerar_peca"] as const;
export interface PedidoTratamento { original_sha256: string; operacoes: string[]; geometria_alterada?: boolean; inscricoes_alteradas?: boolean }
export function validarTratamento(p: PedidoTratamento): { ok: boolean; bloqueios: string[] } {
  const b: string[] = [];
  if (!/^[0-9a-f]{64}$/i.test(p.original_sha256 ?? "")) b.push("o SHA-256 do original é obrigatório (o original é preservado)");
  if (!p.operacoes?.length) b.push("nenhuma operação informada");
  for (const o of p.operacoes ?? []) {
    if ((OPERACOES_PROIBIDAS as readonly string[]).includes(o)) b.push(`operação proibida: ${o}`);
    else if (!(OPERACOES_PERMITIDAS as readonly string[]).includes(o)) b.push(`operação desconhecida: ${o}`);
  }
  if (p.geometria_alterada) b.push("a geometria da peça (furos, dentes, contorno) não pode mudar");
  if (p.inscricoes_alteradas) b.push("inscrições e códigos gravados na peça não podem mudar");
  return { ok: b.length === 0, bloqueios: b };
}
