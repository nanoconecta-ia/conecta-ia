// Anexos recebidos pelo MCP do ChatGPT: somente staging PRIVADO e a_confirmar.
// A URL de download temporária é segredo transitório; NUNCA salvar nem registrar em auditoria.
import { baixarImagemOriginal, urlImagemSegura, type ResultadoImagem, type OpcoesBaixar } from "../busca_segura/imagem_original.ts";
import type { AdminRpc } from "../ia/escrita.ts";

type Finalidade = "foto_produto" | "banner";
type ArquivoMcp = { download_url: string; file_id: string; mime_type?: string; file_name?: string };
type Armazenamento = {
  from(bucket: string): {
    upload(path: string, body: Uint8Array, options: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>;
    remove(paths: string[]): Promise<unknown>;
  };
};
type Contexto = { lojaId: string; userId: string; admin: AdminRpc & { storage?: Armazenamento } };
type Verificador = (url: string, op: OpcoesBaixar) => Promise<ResultadoImagem>;

const MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const texto = (s: unknown, n: number) => typeof s === "string" ? s.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, n) : "";
const uuidValido = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const validarArquivoMcp = (arquivo: unknown): { ok: true; arquivo: ArquivoMcp } | { ok: false; erro: string } => {
  if (!arquivo || typeof arquivo !== "object" || Array.isArray(arquivo)) return { ok: false, erro: "Anexe uma imagem no campo file." };
  const f = arquivo as Record<string, unknown>;
  if (typeof f.download_url !== "string" || f.download_url.length > 5000 ||
      typeof f.file_id !== "string" || !/^[A-Za-z0-9_.:-]{5,250}$/.test(f.file_id)) return { ok: false, erro: "Referência de arquivo inválida." };
  const url = urlImagemSegura(f.download_url);
  if (!url.ok) return { ok: false, erro: url.erro };
  if (f.mime_type !== undefined && (typeof f.mime_type !== "string" || !MIMES.has(f.mime_type))) return { ok: false, erro: "Apenas PNG, JPG e WebP são aceitos." };
  if (f.file_name !== undefined && (typeof f.file_name !== "string" || f.file_name.length > 250)) return { ok: false, erro: "Nome de arquivo inválido." };
  return { ok: true, arquivo: { download_url: url.url, file_id: f.file_id, mime_type: f.mime_type as string | undefined, file_name: texto(f.file_name, 180).replace(/[\\/]/g, "_") } };
};

/** Para testes, o verificador e o storage podem ser simulados; em produção baixamos por HTTPS com SSRF guard e limites. */
export async function anexarMidiaMcp(c: Contexto, e: Record<string, unknown>, finalidade: Finalidade,
  op: OpcoesBaixar = {}, verificar: Verificador = baixarImagemOriginal): Promise<unknown> {
  const sku = texto(e.sku, 80), v = validarArquivoMcp(e.file);
  if (!sku || !v.ok) return { erro: !sku ? "Informe o SKU físico." : (v as { erro: string }).erro };
  if (!c.admin.storage) return { erro: "Armazenamento privado não configurado; nada foi anexado." };
  const { data: produto, error: erProduto } = await c.admin.from("produtos").select("id").eq("loja_id", c.lojaId).eq("sku", sku).maybeSingle();
  if (erProduto || !produto?.id) return { erro: "SKU não encontrado nesta loja; nenhum produto foi criado." };
  const produtoId = String(produto.id);

  const titulo = texto(e.titulo, 120), origem = texto(e.origem, 200) || "anexo_chatgpt";
  const direitos = e.direitos === "autor_proprio" || e.direitos === "licenca_informada" ? e.direitos : "a_confirmar";
  let aplicacaoId: string | null = null, paginaSlug: string | null = null;
  if (finalidade === "banner") {
    if (!titulo) return { erro: "Informe o título do banner." };
    if (e.modo === "por_veiculo") {
      if (!uuidValido(e.aplicacao_id)) return { erro: "Informe a aplicação aprovada do veículo; não basta informar o modelo." };
      const { data: aplicacao, error } = await c.admin.from("produto_aplicacoes")
        .select("id,pagina_slug").eq("loja_id", c.lojaId).eq("produto_id", produtoId)
        .eq("id", e.aplicacao_id).eq("status", "aprovado").eq("pagina_indexavel", true).maybeSingle();
      if (error || !aplicacao?.id || !aplicacao.pagina_slug) return { erro: "A aplicação ainda não tem página indexável aprovada; banner de veículo recusado." };
      aplicacaoId = String(aplicacao.id); paginaSlug = String(aplicacao.pagina_slug);
    } else if (e.modo !== "institucional") return { erro: "Use modo institucional ou por_veiculo." };
  }
  let bytes: Uint8Array | null = null;
  const imagem = await verificar(v.arquivo.download_url, { ...op, maxBytes: 8 * 1024 * 1024, capturarBytes: (a) => { bytes = a; } });
  if (!imagem.ok) return { erro: imagem.erro };
  const info = imagem.imagem;
  if (!bytes || bytes.length !== info.bytes || !MIMES.has(info.mime) ||
      info.largura_px > 12000 || info.altura_px > 12000 ||
      (v.arquivo.mime_type && v.arquivo.mime_type !== info.mime)) return { erro: "O arquivo original falhou na conferência de formato, tamanho ou dimensões." };
  const safeBytes: Uint8Array = bytes;
  const path = `mcp-midias/${c.lojaId}/${crypto.randomUUID()}.${EXT[info.mime]}`;
  const storage = c.admin.storage.from("agente-anexos");
  const up = await storage.upload(path, safeBytes, { contentType: info.mime, upsert: false });
  if (up.error) return { erro: "Não foi possível armazenar o anexo privado. Nenhuma proposta foi criada." };
  const { data, error } = await c.admin.from("conecta_midia_pendentes").insert({
    loja_id: c.lojaId, produto_id: produtoId, criado_por: c.userId, sku,
    finalidade, status: "a_confirmar", aplicacao_id: aplicacaoId, titulo: titulo || null,
    origem, direitos_declarados: direitos, nome_arquivo: v.arquivo.file_name || null,
    storage_bucket: "agente-anexos", storage_path: path, sha256: info.sha256,
    mime: info.mime, tamanho_bytes: info.bytes, largura_px: info.largura_px, altura_px: info.altura_px,
  }).select("id").single();
  if (error || !data?.id) {
    await storage.remove([path]).catch(() => {});
    return { erro: "Falha ao registrar o anexo na fila; o arquivo foi descartado." };
  }
  return {
    ok: true, status: "a_confirmar", midia_id: data.id, tipo: finalidade, sku,
    pagina_aplicacao: paginaSlug ? `#/a/${paginaSlug}` : null,
    original: { sha256: info.sha256, bytes: info.bytes, mime: info.mime, largura_px: info.largura_px, altura_px: info.altura_px },
    aviso: "Arquivo recebido em armazenamento PRIVADO, aguardando revisão humana. Não aparece no site, Bling ou banners públicos.",
  };
}
