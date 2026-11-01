// Modelo PURO do editor de banner (sem DOM, sem Konva): formatos, layout "contain", operações permitidas e rascunho local.
// Só existem operações que a Skill de fidelidade permite sobre a foto da peça: mover e redimensionar COM ESCALA UNIFORME.
// Não há operação de recortar, espelhar, girar, inclinar ou editar a peça: o editor não oferece o que o validador proíbe.
// Toda mudança volta ao validador (fidelidadeVisual.ts); este arquivo não decide o que é permitido, só monta o documento.
import type { Camada, Documento, Retangulo } from "./fidelidadeVisual.ts";

export interface Formato { id: string; rotulo: string; w: number; h: number }
export const FORMATOS: Formato[] = [
  { id: "1:1", rotulo: "Quadrado 1:1 (1200×1200)", w: 1200, h: 1200 },
  { id: "4:5", rotulo: "Retrato 4:5 (1080×1350)", w: 1080, h: 1350 },
  { id: "16:9", rotulo: "Paisagem 16:9 (1280×720)", w: 1280, h: 720 },
];
export const MARGEM = 40;
export const ESCALA_MIN = 0.05;
export const ESCALA_MAX = 4;
export const PASSO_PX = 10;
export const TEXTO_RASCUNHO = "RASCUNHO — não publicar";

const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Área segura: o banner inteiro menos a margem. A peça precisa caber toda aqui. */
export const areaSeguraDe = (f: Formato): Retangulo => ({ x: MARGEM, y: MARGEM, w: f.w - 2 * MARGEM, h: f.h - 2 * MARGEM });

/** Faixas livres para texto, fora da região da peça: topo (título) e base (loja e chamada). A peça nasce no meio. */
export function faixasDe(f: Formato) {
  const a = areaSeguraDe(f);
  const alturaTopo = Math.round(f.h * 0.14), alturaBase = Math.round(f.h * 0.1);
  const topo: Retangulo = { x: a.x, y: a.y, w: a.w, h: alturaTopo };
  const base: Retangulo = { x: a.x, y: a.y + a.h - alturaBase, w: a.w, h: alturaBase };
  const meio: Retangulo = { x: a.x, y: topo.y + topo.h + MARGEM / 2, w: a.w, h: base.y - (topo.y + topo.h) - MARGEM };
  return { topo, base, meio };
}

export interface FotoBase { assetId: string; sha256: string; w: number; h: number }
export interface Entrada { lojaId: string; sku: string; formato: Formato; foto: FotoBase; titulo: string; lojaNome: string }

/** Enquadramento 'contain': a maior escala UNIFORME em que a peça inteira cabe na região do meio (nunca amplia além de 100 %). */
export function escalaContain(natural: { w: number; h: number }, regiao: Retangulo): number {
  return Math.floor(Math.min(1, regiao.w / natural.w, regiao.h / natural.h) * 1e4) / 1e4; // arredonda para baixo: nunca estoura a região
}

function camadaProduto(d: Pick<Documento, "foto">): Retangulo {
  return { x: d.foto.posicao.x, y: d.foto.posicao.y, w: d.foto.natural.w * d.foto.transform.scaleX, h: d.foto.natural.h * d.foto.transform.scaleY };
}
const comProduto = (d: Documento): Documento => ({ ...d, camadas: d.camadas.map((c) => (c.tipo === "produto" ? { ...c, retangulo: camadaProduto(d) } : c)) });

/** Documento inicial: foto centralizada em 'contain', título no topo, loja e chamada na base. Nenhum preço, garantia ou dado técnico. */
export function documentoInicial(e: Entrada): Documento {
  const { topo, base, meio } = faixasDe(e.formato);
  const s = escalaContain(e.foto, meio);
  const w = e.foto.w * s, h = e.foto.h * s;
  const x = meio.x + (meio.w - w) / 2, y = meio.y + (meio.h - h) / 2;
  const doc: Documento = {
    loja_id: e.lojaId, sku: e.sku, status: "rascunho", formato: { w: e.formato.w, h: e.formato.h }, area_segura: areaSeguraDe(e.formato),
    camadas: [
      { id: "fundo", tipo: "fundo", retangulo: { x: 0, y: 0, w: e.formato.w, h: e.formato.h } },
      { id: "foto", tipo: "produto", retangulo: { x, y, w, h }, bloqueada: true },
      { id: "titulo", tipo: "texto", retangulo: topo, texto: e.titulo },
      { id: "loja", tipo: "texto", retangulo: { ...base, w: Math.round(base.w * 0.6) }, texto: e.lojaNome },
      { id: "cta", tipo: "cta", retangulo: { x: base.x + Math.round(base.w * 0.65), y: base.y, w: Math.round(base.w * 0.35), h: base.h }, texto: "Ver peça" },
    ],
    foto: { asset_id: e.foto.assetId, sha256: e.foto.sha256, natural: { w: e.foto.w, h: e.foto.h }, posicao: { x, y }, transform: { scaleX: s, scaleY: s }, recorte: null, apresentada_como: "real" },
    hash_aprovado: null,
  };
  return comProduto(doc);
}

/** Muda a escala da peça de forma UNIFORME em torno do centro dela. Fator ≤ 0 ou não finito é ignorado. */
export function escalar(d: Documento, fator: number): Documento {
  if (!Number.isFinite(fator) || fator <= 0) return d;
  const atual = d.foto.transform.scaleX;
  const nova = limitar(atual * fator, ESCALA_MIN, ESCALA_MAX);
  return definirEscala(d, nova);
}
/** Define a escala uniforme absoluta, mantendo o centro da peça. */
export function definirEscala(d: Documento, escala: number): Documento {
  if (!Number.isFinite(escala) || escala <= 0) return d;
  const s = limitar(escala, ESCALA_MIN, ESCALA_MAX);
  const antes = camadaProduto(d);
  const cx = antes.x + antes.w / 2, cy = antes.y + antes.h / 2;
  const w = d.foto.natural.w * s, h = d.foto.natural.h * s;
  return comProduto({ ...d, foto: { ...d.foto, posicao: { x: cx - w / 2, y: cy - h / 2 }, transform: { scaleX: s, scaleY: s } } });
}
/** Move a peça. Não limita ao banner: se sair da área segura, o validador bloqueia e a tela mostra o motivo. */
export function moverFoto(d: Documento, x: number, y: number): Documento {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return d;
  return comProduto({ ...d, foto: { ...d.foto, posicao: { x, y } } });
}
/** Aplica o que o Transformer do Konva devolveu, SEM corrigir: se vier escala diferente nos eixos, o validador precisa enxergar e bloquear. */
export function aplicarTransformacaoFoto(d: Documento, x: number, y: number, scaleX: number, scaleY: number): Documento {
  if (![x, y, scaleX, scaleY].every(Number.isFinite)) return d;
  return comProduto({ ...d, foto: { ...d.foto, posicao: { x, y }, transform: { ...d.foto.transform, scaleX, scaleY } } });
}
export const deslocarFoto = (d: Documento, dx: number, dy: number) => moverFoto(d, d.foto.posicao.x + dx, d.foto.posicao.y + dy);
/** Volta ao enquadramento 'contain' centralizado na região do meio. */
export function ajustarContain(d: Documento, f: Formato): Documento {
  const { meio } = faixasDe(f);
  const s = escalaContain(d.foto.natural, meio);
  const w = d.foto.natural.w * s, h = d.foto.natural.h * s;
  return comProduto({ ...d, foto: { ...d.foto, posicao: { x: meio.x + (meio.w - w) / 2, y: meio.y + (meio.h - h) / 2 }, transform: { scaleX: s, scaleY: s } } });
}
export function moverCamada(d: Documento, id: string, x: number, y: number): Documento {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return d;
  return { ...d, camadas: d.camadas.map((c) => (c.id === id && c.tipo !== "produto" && c.tipo !== "fundo" ? { ...c, retangulo: { ...c.retangulo, x, y } } : c)) };
}
export function definirTexto(d: Documento, id: string, texto: string): Documento {
  return { ...d, camadas: d.camadas.map((c) => (c.id === id && c.tipo !== "produto" && c.tipo !== "fundo" ? { ...c, texto: texto.slice(0, 80) } : c)) };
}
export const camada = (d: Documento, id: string): Camada | undefined => d.camadas.find((c) => c.id === id);

/** Rascunho local: SÓ a composição (camadas, escala, posição, SHA). Os bytes da foto nunca entram aqui nem saem do navegador. */
const CHAVE = "conecta:banner-rascunho";
export const chaveRascunho = (lojaId: string, sku: string) => `${CHAVE}:${lojaId}:${sku}`;
export function serializarRascunho(d: Documento): string {
  return JSON.stringify({ ...d, status: "rascunho", hash_aprovado: null });
}
/** Lê um rascunho guardado; descarta se for de outra loja, outro SKU ou outra foto (SHA diferente) ou se estiver malformado. */
export function lerRascunho(bruto: string | null, esperado: { loja_id: string; sku: string; sha256: string }): Documento | null {
  try {
    if (!bruto) return null;
    const d = JSON.parse(bruto) as Documento;
    if (d?.loja_id !== esperado.loja_id || d.sku !== esperado.sku || d.foto?.sha256 !== esperado.sha256) return null;
    if (!Array.isArray(d.camadas) || !d.foto?.transform || !d.foto.natural || !d.foto.posicao) return null;
    return { ...d, status: "rascunho", hash_aprovado: null };
  } catch { return null; }
}
export function gravarRascunho(armazem: Pick<Storage, "setItem"> | null, d: Documento): void {
  try { armazem?.setItem(chaveRascunho(d.loja_id, d.sku), serializarRascunho(d)); } catch { /* sem storage: vale só nesta sessão */ }
}
