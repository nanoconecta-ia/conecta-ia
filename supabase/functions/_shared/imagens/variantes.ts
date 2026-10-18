// Variantes otimizadas: especificação e nomes de arquivo determinísticos. O processamento de pixels fica atrás de uma porta
// (PortaImagem); aqui só há um MOCK de teste. Nada presume serviço de imagem, e nunca se amplia a imagem (sem upscaling).
import { podePublicar, type Imagem } from "./regras.ts";

export interface EspecVariante { id: "site_lista" | "site_detalhe" | "merchant" | "og"; largura: number; altura: number; formato: "webp" | "jpg"; fundoBranco: boolean; ajuste: "contain" | "cover" }
export const VARIANTES: readonly EspecVariante[] = [
  { id: "site_lista", largura: 400, altura: 400, formato: "webp", fundoBranco: false, ajuste: "contain" },
  { id: "site_detalhe", largura: 1200, altura: 1200, formato: "webp", fundoBranco: false, ajuste: "contain" },
  { id: "merchant", largura: 800, altura: 800, formato: "jpg", fundoBranco: true, ajuste: "contain" },
  { id: "og", largura: 1200, altura: 630, formato: "jpg", fundoBranco: true, ajuste: "contain" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Caminho no armazenamento privado/público do projeto. Só UUIDs entram (nada vindo de nome de arquivo de terceiros). */
export function chaveArmazenamento(lojaId: string, produtoId: string, imagemId: string, spec: EspecVariante, versao = 1): string {
  for (const [n, v] of [["loja", lojaId], ["produto", produtoId], ["imagem", imagemId]] as const) if (!UUID.test(v)) throw new Error(`id inválido (${n})`);
  if (!Number.isInteger(versao) || versao < 1) throw new Error("versão inválida");
  return `lojas/${lojaId}/produtos/${produtoId}/${imagemId}/${spec.id}.v${versao}.${spec.formato}`.toLowerCase();
}

export interface SaidaProcessamento { largura: number; altura: number; bytes: number; fundoBrancoAplicado: boolean }
export interface PortaImagem { processar(origemUrl: string, spec: EspecVariante, larguraOrigem: number, alturaOrigem: number): Promise<SaidaProcessamento> }

/** Implementação de teste: devolve metadados determinísticos, sem tocar em pixel nem em rede. `simulado` sempre true. */
export class ProcessadorMock implements PortaImagem {
  chamadas: { url: string; spec: string }[] = [];
  async processar(origemUrl: string, spec: EspecVariante, lo: number, ao: number): Promise<SaidaProcessamento> {
    this.chamadas.push({ url: origemUrl, spec: spec.id });
    const escala = Math.min(spec.largura / lo, spec.altura / ao, 1); // nunca amplia
    const largura = Math.max(1, Math.round(lo * escala)), altura = Math.max(1, Math.round(ao * escala));
    return { largura, altura, bytes: largura * altura, fundoBrancoAplicado: spec.fundoBranco };
  }
}

export interface VarianteGerada { spec: EspecVariante["id"]; chave: string; largura: number; altura: number; ampliada: false; simulado: boolean; fundoBrancoAplicado: boolean }
/** Só processa imagem publicável (aprovada e com direitos). Sem resolução conhecida, não processa (não presume). */
export async function gerarVariantes(lojaId: string, img: Imagem, porta: PortaImagem, simulado: boolean, versao = 1): Promise<{ variantes: VarianteGerada[]; recusa: string | null }> {
  const pub = podePublicar(img);
  if (!pub.ok) return { variantes: [], recusa: pub.bloqueios.join("; ") };
  if (!img.largura_px || !img.altura_px) return { variantes: [], recusa: "resolução desconhecida: medir a imagem antes de gerar variantes" };
  const out: VarianteGerada[] = [];
  for (const spec of VARIANTES) {
    const r = await porta.processar(img.url, spec, img.largura_px, img.altura_px);
    if (r.largura > img.largura_px || r.altura > img.altura_px) throw new Error("a porta ampliou a imagem (upscaling proibido)");
    out.push({ spec: spec.id, chave: chaveArmazenamento(lojaId, img.produto_id, img.id, spec, versao), largura: r.largura, altura: r.altura, ampliada: false, simulado, fundoBrancoAplicado: r.fundoBrancoAplicado });
  }
  return { variantes: out, recusa: null };
}
