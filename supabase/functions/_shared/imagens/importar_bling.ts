// Importador de imagens do Bling (piloto). Pipeline idempotente por produto, SOMENTE LEITURA no Bling (GET), com portas injetadas.
// Regras: identidade conferida (SKU + bling_id) antes de tudo; link assinado do Bling é credencial e NUNCA é persistido (só o caminho-base);
// original guardado sem alteração em bucket PRIVADO; imagem nasce NÃO aprovada, sem direitos e sem confiança (NULL); nada é escrito no Bling.
import type { ResultadoImagem } from "../busca_segura/imagem_original.ts";

export interface ProdutoEspelho { id: string; loja_id: string; sku: string; bling_id: string }
export interface MidiaBling { interna: string[]; externa: string[] }
export interface PortasImportacao {
  produtoPorSku(lojaId: string, sku: string): Promise<ProdutoEspelho | null>;
  /** GET /produtos/{id} no Bling: devolve o id e o código que o Bling informa e os links de mídia. */
  lerProdutoBling(blingId: string): Promise<{ id: string; codigo: string; midia: MidiaBling } | null>;
  baixar(url: string): Promise<ResultadoImagem>;
  /** Grava no bucket privado sem sobrescrever (upsert=false). */
  guardar(caminho: string, bytes: Uint8Array, mime: string): Promise<{ ok: boolean; jaExistia?: boolean }>;
  gravarLinha(linha: Record<string, unknown>): Promise<{ ok: boolean; duplicada?: boolean }>;
  /** Remove um objeto recém-guardado que ficou sem linha (duplicado ou registro recusado): não deixa arquivo órfão. */
  descartar(caminho: string): Promise<void>;
  novoId(): string;
  agora(): Date;
}
export type ResultadoItem = { sku: string; estado: "importada" | "ja_existia" | "recusada"; motivo?: string; imagem_id?: string; sha256?: string; origem?: "bling_interna" | "bling_externa" };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Remove query e fragmento: a assinatura do link interno do Bling (AWSAccessKeyId/Signature) nunca é guardada. */
export function caminhoBase(url: string): string { try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return ""; } }

export function extrairMidia(corpo: unknown): MidiaBling | null {
  const d = (corpo as { data?: { midia?: { imagens?: { internas?: { link?: unknown }[]; externas?: { link?: unknown }[] } } } } | null)?.data;
  if (!d) return null;
  const links = (a?: { link?: unknown }[]) => (Array.isArray(a) ? a.map((x) => x?.link).filter((l): l is string => typeof l === "string" && l.length > 0) : []);
  return { interna: links(d.midia?.imagens?.internas), externa: links(d.midia?.imagens?.externas) };
}

export async function importarProduto(p: PortasImportacao, lojaId: string, sku: string): Promise<ResultadoItem[]> {
  const prod = await p.produtoPorSku(lojaId, sku);
  if (!prod || prod.loja_id !== lojaId) return [{ sku, estado: "recusada", motivo: "produto_nao_encontrado_na_loja" }];
  const bling = await p.lerProdutoBling(prod.bling_id);
  if (!bling) return [{ sku, estado: "recusada", motivo: "bling_nao_respondeu" }];
  // identidade: o Bling precisa confirmar o MESMO id e o MESMO código do espelho; senão interrompe sem tocar em nada
  if (String(bling.id) !== String(prod.bling_id) || bling.codigo !== prod.sku) return [{ sku, estado: "recusada", motivo: "identidade_divergente_espelho_x_bling" }];
  const itens: { link: string; origem: "bling_interna" | "bling_externa" }[] = [
    ...bling.midia.interna.map((link) => ({ link, origem: "bling_interna" as const })),
    ...bling.midia.externa.map((link) => ({ link, origem: "bling_externa" as const })),
  ].slice(0, 8);
  if (!itens.length) return [{ sku, estado: "recusada", motivo: "bling_sem_imagem" }];
  const saidas: ResultadoItem[] = [];
  for (const it of itens) {
    const r = await p.baixar(it.link);
    if (!r.ok) { saidas.push({ sku, estado: "recusada", motivo: `download: ${r.erro}`, origem: it.origem }); continue; }
    const img = r.imagem;
    if (!img.conteudo) { saidas.push({ sku, estado: "recusada", motivo: "download_sem_bytes", origem: it.origem }); continue; }
    const imagemId = p.novoId();
    const caminho = `lojas/${lojaId}/produtos/${prod.id}/${imagemId}/original.${EXT[img.mime]}`;
    const gravado = await p.guardar(caminho, img.conteudo, img.mime);
    if (!gravado.ok) { saidas.push({ sku, estado: "recusada", motivo: "storage_recusou", origem: it.origem }); continue; }
    const quando = p.agora().toISOString();
    const linha = await p.gravarLinha({
      id: imagemId, loja_id: lojaId, produto_id: prod.id,
      url: caminhoBase(img.url_final) || caminhoBase(it.link), // sem query/assinatura; coluna obrigatória
      tipo: "ilustrativa", origem: it.origem, importada_de: it.origem, aprovada: false, principal: false,
      largura_px: img.largura_px, altura_px: img.altura_px,
      arquivo_original_path: caminho, arquivo_original_sha256: img.sha256, arquivo_original_bytes: img.bytes, arquivo_original_mime: img.mime,
      evidencias: [
        { fato: it.origem === "bling_interna" ? "veio do cadastro do próprio produto no Bling (mídia interna)" : "link externo cadastrado no produto do Bling (mídia externa)", bling_id: prod.bling_id, lido_em: quando },
        { fato: "identidade conferida: SKU e id do Bling iguais aos do espelho" },
        ...img.avisos.map((a) => ({ fato: a })),
        { fato: "direitos de uso NÃO confirmados; confiança NÃO avaliada; aguarda aprovação humana" },
      ],
    });
    if (!linha.ok) await p.descartar(caminho).catch(() => undefined);
    if (!linha.ok && linha.duplicada) saidas.push({ sku, estado: "ja_existia", imagem_id: imagemId, sha256: img.sha256, origem: it.origem });
    else if (!linha.ok) saidas.push({ sku, estado: "recusada", motivo: "registro_recusado", origem: it.origem });
    else saidas.push({ sku, estado: "importada", imagem_id: imagemId, sha256: img.sha256, origem: it.origem });
  }
  return saidas;
}
