// Validador DETERMINÍSTICO de fidelidade visual e técnica (Skill nano-fidelidade-visual). Função pura, sem dependências, sem rede e sem relógio.
// Chamado pelo editor (painel/src/lib/fidelidadeVisual.ts, CÓPIA IDÊNTICA conferida por teste) e pelo servidor ao salvar, solicitar revisão, autorizar, exportar e publicar.
//
// O que isto PROVA: escala uniforme, ausência de espelho/inclinação/máscara/edição generativa, ausência de recorte, peça inteira dentro da área segura,
// nenhuma camada de arte sobre a caixa da peça, SHA do original, mesma loja/SKU, dado técnico/preço/garantia só se confirmado, direitos, identidade,
// aprovação humana e hash da versão aprovada.
// O que isto NÃO PROVA: que os PIXELS da peça não foram alterados, que a foto é mesmo daquele produto, nem compatibilidade. Passar aqui não dispensa a
// revisão humana (três checagens) nem a prova de identidade e de direitos. Edição generativa da peça é proibida por contrato (flags abaixo), não detectada.

export type Acao = "salvar" | "solicitar_revisao" | "autorizar" | "exportar" | "publicar";
export type Ator = "agente" | "usuario";
export type Destino = "download" | "site" | "bling" | "meta";
export type Status = "rascunho" | "aguardando_revisao" | "aprovado_para_destino" | "publicado";
export type TipoCamada = "fundo" | "produto" | "texto" | "logo" | "preco" | "selo" | "cta";

export interface Retangulo { x: number; y: number; w: number; h: number }
export interface Transformacao {
  scaleX: number; scaleY: number;
  flipX?: boolean; flipY?: boolean; skewX?: number; skewY?: number; rotacao?: number;
  perspectiva?: boolean; mascara?: boolean; inpainting?: boolean; generativa?: boolean;
}
export interface Camada {
  id: string; tipo: TipoCamada; retangulo: Retangulo;
  texto?: string;
  /** Campo do produto de onde o texto vem (ex.: "preco", "garantia", "codigo_fabricante"). Texto de dado técnico sem `campo` é bloqueado. */
  campo?: string;
  bloqueada?: boolean;
}
export interface Documento {
  loja_id: string; sku: string; status: Status;
  formato: { w: number; h: number };
  area_segura: Retangulo;
  camadas: Camada[];
  foto: {
    asset_id: string; sha256: string; natural: { w: number; h: number };
    posicao: { x: number; y: number }; transform: Transformacao;
    /** Recorte da foto (em pixels da imagem natural). Qualquer recorte que não cubra a imagem inteira é proibido. */
    recorte?: Retangulo | null;
    apresentada_como: "real" | "ilustrativa";
  };
  /** Hash (SHA-256 hex) da composição no momento da aprovação. Qualquer edição posterior muda o hash e invalida a aprovação. */
  hash_aprovado?: string | null;
}
export interface Evidencia { url?: string; documento?: string; data: string }
export interface Ativo {
  asset_id: string; loja_id: string; sha256_original: string;
  tipo: "real" | "gerada_ia" | "ilustrativa";
  origem: string | null; licenca_confirmada: boolean;
  /** URL de página de terceiros de onde veio a candidata. Nunca pode ser o destino final de catálogo. */
  url_terceiro?: string | null;
  identidade: { codigo_fabricante: string | null; oem: string | null; evidencias: Evidencia[] };
}
export interface Fato { valor: string; confirmado: boolean; fonte?: string }
export interface Produto { loja_id: string; sku: string; fatos: Record<string, Fato> }
export interface Autorizacoes { identidade_aprovada: boolean; direitos_aprovados: boolean }
export interface Contexto {
  acao: Acao; ator: Ator; destino?: Destino; url_destino?: string | null;
  /** Hash da composição ATUAL (calculado por `hashComposicao`). Exigido para exportar/publicar. */
  hash_atual?: string | null;
  /** As três checagens humanas (furos/bordas, encaixes, inscrições). Exigidas para autorizar/exportar/publicar. */
  checagens_humanas?: readonly boolean[];
}

export interface Bloqueio { codigo: string; mensagem: string }
export interface Resultado { ok: boolean; bloqueios: Bloqueio[]; avisos: string[]; manuais: string[] }

const TOL_ESCALA = 0.005;   // 0,5 % de diferença entre os eixos é arredondamento; acima disso é deformação
const TOL_PX = 0.5;         // meio pixel de tolerância ao comparar caixas
const HEX64 = /^[0-9a-f]{64}$/;
const ACOES_FINAIS: readonly Acao[] = ["autorizar", "exportar", "publicar"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const hostDe = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export const CHECAGENS_HUMANAS = [
  "Furos, bordas e proporções iguais ao original",
  "Conectores e encaixes iguais",
  "Inscrições, marcas e gravações legíveis e iguais",
] as const;

/** Caixa da foto no banner: tamanho natural × escala, no ponto de posição. */
export function caixaDaFoto(d: Pick<Documento, "foto">): Retangulo {
  const f = d.foto;
  return { x: f.posicao.x, y: f.posicao.y, w: f.natural.w * f.transform.scaleX, h: f.natural.h * f.transform.scaleY };
}
const dentro = (a: Retangulo, area: Retangulo) =>
  a.x >= area.x - TOL_PX && a.y >= area.y - TOL_PX && a.x + a.w <= area.x + area.w + TOL_PX && a.y + a.h <= area.y + area.h + TOL_PX;
const cruza = (a: Retangulo, b: Retangulo) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const igual = (a: Retangulo, b: Retangulo) => Math.abs(a.x - b.x) <= TOL_PX && Math.abs(a.y - b.y) <= TOL_PX && Math.abs(a.w - b.w) <= TOL_PX && Math.abs(a.h - b.h) <= TOL_PX;
const retanguloOk = (r: Retangulo | undefined) => !!r && [r.x, r.y, r.w, r.h].every(finito) && r.w > 0 && r.h > 0;

/** Dados técnicos que só podem aparecer no banner se vierem de um fato confirmado do produto. */
const PADROES_TECNICOS: { campo: string; re: RegExp; codigo: string; rotulo: string }[] = [
  { campo: "preco", re: /r\$\s*\d|\d+[.,]\d{2}\s*(reais)?\b/i, codigo: "preco_sem_origem", rotulo: "preço" },
  { campo: "garantia", re: /garantia|\b\d+\s*(meses|anos|dias)\b/i, codigo: "garantia_sem_origem", rotulo: "garantia" },
  { campo: "dentes", re: /\b\d+\s*dentes\b/i, codigo: "tecnico_sem_origem", rotulo: "número de dentes" },
  { campo: "medida", re: /\b\d+([.,]\d+)?\s*(mm|cm|cv|hp)\b/i, codigo: "tecnico_sem_origem", rotulo: "medida" },
];

/** Valida o documento (composição) contra o ativo, o produto e as autorizações. Pura: mesmo dado, mesmo resultado. */
export function validarFidelidadeVisual(doc: Documento, ativo: Ativo, produto: Produto, aut: Autorizacoes, ctx: Contexto): Resultado {
  const b: Bloqueio[] = []; const a: string[] = []; const m: string[] = [];
  const no = (codigo: string, mensagem: string) => b.push({ codigo, mensagem });
  const final = ACOES_FINAIS.includes(ctx.acao);
  const t = doc.foto?.transform;

  // ── Isolamento e identidade do registro
  if (ativo.loja_id !== doc.loja_id) no("loja_diferente", "O ativo pertence a outra loja.");
  if (produto.loja_id !== doc.loja_id) no("loja_diferente", "O produto pertence a outra loja.");
  if (produto.sku !== doc.sku) no("sku_diferente", `O banner é do SKU ${doc.sku}, mas o produto lido é ${produto.sku}.`);
  if (!doc.foto?.asset_id || doc.foto.asset_id !== ativo.asset_id) no("ativo_diferente", "A foto do banner não é o ativo informado.");

  // ── SHA do original (nenhuma operação sobrescreve o original)
  if (!HEX64.test(ativo.sha256_original ?? "")) no("sha_original_ausente", "O SHA-256 do arquivo original não está registrado.");
  else if (doc.foto?.sha256 !== ativo.sha256_original) no("sha_divergente", "O SHA-256 da foto usada não é o do original preservado.");

  // ── Transformação da foto da peça
  if (!t || !finito(t.scaleX) || !finito(t.scaleY) || t.scaleX <= 0 || t.scaleY <= 0) no("escala_invalida", "A escala da foto precisa ser um número maior que zero.");
  else {
    const maior = Math.max(t.scaleX, t.scaleY);
    if (Math.abs(t.scaleX - t.scaleY) / maior > TOL_ESCALA) no("escala_nao_uniforme", "A foto da peça foi esticada em um eixo: só é permitida escala proporcional.");
  }
  if (t?.flipX || t?.flipY) no("espelhamento", "A foto da peça não pode ser espelhada.");
  if ((t?.skewX ?? 0) !== 0 || (t?.skewY ?? 0) !== 0) no("inclinacao", "A foto da peça não pode ser inclinada (skew).");
  if ((t?.rotacao ?? 0) !== 0) no("rotacao_nao_permitida", "Rotação da foto da peça não é permitida por padrão.");
  if (t?.perspectiva) no("perspectiva", "Correção de perspectiva ou warp da peça não é permitida.");
  if (t?.mascara) no("mascara", "Máscara sobre a peça não é permitida.");
  if (t?.inpainting || t?.generativa) no("edicao_generativa", "Edição generativa, reparo ou reconstrução da peça com IA é proibido.");

  // ── Recorte: a peça não pode perder nenhuma parte
  const r = doc.foto?.recorte;
  if (r) {
    const inteira = retanguloOk(r) && r.x <= 0 && r.y <= 0 && r.x + r.w >= (doc.foto.natural?.w ?? 0) && r.y + r.h >= (doc.foto.natural?.h ?? 0);
    if (!inteira) no("crop_proibido", "A foto da peça foi recortada: use enquadramento 'contain' e adapte o fundo, não a peça.");
  }

  // ── Geometria no banner
  const naturalOk = finito(doc.foto?.natural?.w) && finito(doc.foto?.natural?.h) && doc.foto.natural.w > 0 && doc.foto.natural.h > 0;
  const posOk = finito(doc.foto?.posicao?.x) && finito(doc.foto?.posicao?.y);
  if (!naturalOk || !posOk || !retanguloOk(doc.area_segura)) no("geometria_invalida", "Tamanho, posição da foto ou área segura inválidos.");
  else if (t && finito(t.scaleX) && finito(t.scaleY) && t.scaleX > 0 && t.scaleY > 0) {
    const caixa = caixaDaFoto(doc);
    if (!dentro(caixa, doc.area_segura)) no("peca_fora_da_area_segura", "A peça não cabe inteira na área segura do banner: reduza a escala (contain).");
    const produtos = doc.camadas.filter((c) => c.tipo === "produto");
    if (produtos.length !== 1) no("camada_produto_invalida", "O banner precisa ter exatamente uma camada de produto.");
    else {
      const cp = produtos[0];
      if (!cp.bloqueada) no("camada_produto_desbloqueada", "A camada da peça precisa estar protegida contra transformações.");
      if (!retanguloOk(cp.retangulo) || !igual(cp.retangulo, caixa)) no("camada_produto_inconsistente", "A camada da peça não corresponde à foto original com a escala declarada.");
    }
    // Arte sobre a peça: usa a caixa inteira da foto (conservador: o contorno real não é conhecido aqui).
    for (const c of doc.camadas) {
      if (c.tipo === "fundo" || c.tipo === "produto") continue;
      if (!retanguloOk(c.retangulo)) { no("camada_invalida", `A camada ${c.id} tem tamanho inválido.`); continue; }
      if (cruza(c.retangulo, caixa)) no("camada_sobre_a_peca", `A camada ${c.id} (${c.tipo}) cobre a caixa da peça.`);
    }
  }

  // ── Texto: dado técnico, preço e garantia só com origem confirmada
  for (const c of doc.camadas) {
    const texto = c.texto ?? "";
    if (!texto.trim()) continue;
    if (c.campo) {
      const fato = produto.fatos[c.campo];
      if (!fato) no("dado_inventado", `A camada ${c.id} usa "${c.campo}", que não existe nos dados do produto.`);
      else if (!fato.confirmado) no("dado_nao_confirmado", `A camada ${c.id} usa "${c.campo}", que ainda não foi confirmado.`);
      else if (!norm(texto).includes(norm(fato.valor))) no("texto_diverge_do_dado", `O texto da camada ${c.id} não é o valor confirmado de "${c.campo}".`);
    } else {
      for (const p of PADROES_TECNICOS) if (p.re.test(texto)) no(p.codigo, `A camada ${c.id} mostra ${p.rotulo} sem indicar a origem confirmada (campo).`);
    }
  }

  // ── Identidade e direitos (vale para o que vira uso externo)
  if (final) {
    if (ativo.tipo !== "real" && doc.foto.apresentada_como === "real") no("sintetica_como_real", "Imagem gerada ou ilustrativa não pode ser apresentada como foto real da peça.");
    const idn = ativo.identidade;
    if (!(idn.codigo_fabricante || idn.oem) || idn.evidencias.length === 0) no("identidade_sem_evidencia", "Falta o código do fabricante ou OEM com evidência (URL ou documento e data).");
    if (!aut.identidade_aprovada) no("identidade_nao_aprovada", "A identidade da peça ainda não foi aprovada por uma pessoa.");
    if (!ativo.licenca_confirmada || !aut.direitos_aprovados) no("direitos_nao_confirmados", "Os direitos de uso da imagem não estão confirmados.");
    const marcadas = ctx.checagens_humanas ?? [];
    if (marcadas.length !== CHECAGENS_HUMANAS.length || !marcadas.every(Boolean)) no("checagem_humana_pendente", "As três checagens humanas (furos/bordas, encaixes, inscrições) não foram concluídas.");
  } else if (!(ativo.identidade.codigo_fabricante || ativo.identidade.oem)) a.push("Identidade ainda sem código do fabricante/OEM: o rascunho não poderá ser autorizado.");

  // ── Quem pode o quê
  if (ctx.ator === "agente") {
    if (final) no("agente_nao_autoriza", "O agente só cria rascunho e solicita revisão: autorizar, exportar e publicar são de uma pessoa.");
    if (doc.status === "aprovado_para_destino" || doc.status === "publicado") no("agente_nao_define_status", "O agente não pode marcar um documento como aprovado ou publicado.");
  }

  // ── Destino
  if (ctx.acao === "publicar" || ctx.acao === "exportar") {
    const dest = ctx.destino;
    if (!dest) no("destino_ausente", "Informe o destino da exportação ou publicação.");
    if (dest === "bling" || dest === "site" || dest === "meta") {
      const u = ctx.url_destino ?? "";
      if (!/^https:\/\//i.test(u)) no("url_destino_invalida", "O destino exige uma URL https própria.");
      else if (/(^|\.)(drive|docs)\.google\.com|googleusercontent\.com/i.test(hostDe(u))) no("url_destino_invalida", "Link público do Drive não pode ser a URL definitiva de catálogo.");
      else if (ativo.url_terceiro && u === ativo.url_terceiro) no("url_destino_invalida", "A URL de terceiros não pode ser a URL definitiva de catálogo.");
    }
    // Versão aprovada = versão exportada
    if (!doc.hash_aprovado) no("sem_aprovacao", "Não há versão aprovada para exportar ou publicar.");
    else if (!ctx.hash_atual || ctx.hash_atual !== doc.hash_aprovado) no("aprovacao_invalidada", "O banner foi alterado depois da aprovação: é preciso aprovar de novo.");
    if (doc.status !== "aprovado_para_destino" && doc.status !== "publicado") no("status_invalido", "O documento ainda não está aprovado para o destino.");
  }

  m.push("A validação automática não detecta alteração de pixels nem prova que a foto é desta peça: compare original e banner lado a lado e faça as três checagens humanas.");
  return { ok: b.length === 0, bloqueios: b, avisos: a, manuais: m };
}

/** JSON canônico (chaves em ordem) da COMPOSIÇÃO: o que muda quando alguém edita. Status e hash aprovado ficam de fora de propósito. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export async function hashComposicao(doc: Documento): Promise<string> {
  const { status: _s, hash_aprovado: _h, ...comp } = doc;
  const dados = new TextEncoder().encode(canonico(comp));
  const h = await crypto.subtle.digest("SHA-256", dados);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Transições de estado. Uma etapa de cada vez; o agente só chega a "aguardando_revisao". */
const ORDEM: Status[] = ["rascunho", "aguardando_revisao", "aprovado_para_destino", "publicado"];
export function transicaoPermitida(de: Status, para: Status, ator: Ator): boolean {
  if (de === para) return true;
  if (ORDEM.indexOf(para) === 0) return true; // voltar a rascunho é sempre possível (edição)
  if (ORDEM.indexOf(para) !== ORDEM.indexOf(de) + 1) return false;
  return ator === "usuario" || para === "aguardando_revisao";
}
/** Depois de qualquer edição da composição, a aprovação anterior deixa de valer. */
export async function aposEdicao(doc: Documento): Promise<Documento> {
  if (!doc.hash_aprovado) return doc;
  return (await hashComposicao(doc)) === doc.hash_aprovado ? doc : { ...doc, status: "rascunho", hash_aprovado: null };
}

export class FidelidadeBloqueio extends Error {
  bloqueios: Bloqueio[];
  constructor(bloqueios: Bloqueio[]) { super(bloqueios.map((x) => x.mensagem).join(" ")); this.bloqueios = bloqueios; }
}
/** Para o servidor: lança se houver qualquer bloqueio. A trava é de código, não de prompt. */
export function exigirFidelidade(doc: Documento, ativo: Ativo, produto: Produto, aut: Autorizacoes, ctx: Contexto): Resultado {
  const r = validarFidelidadeVisual(doc, ativo, produto, aut, ctx);
  if (!r.ok) throw new FidelidadeBloqueio(r.bloqueios);
  return r;
}
