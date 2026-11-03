// Importador PONTUAL de imagens do Bling para o piloto (OC1224 e 80692). verify_jwt = true. NÃO IMPLANTADA: deploy só com aprovação específica.
// Só lojista da loja; confirmação textual; lista fechada de SKUs do piloto; Bling só por GET; arquivo original em bucket PRIVADO; nada é aprovado.
import { autenticar, blingLeitura, json } from "../_shared/conector/edge.ts";
import { baixarImagemOriginal } from "../_shared/busca_segura/imagem_original.ts";
import { extrairMidia, importarProduto, type PortasImportacao } from "../_shared/imagens/importar_bling.ts";

const SKUS_DO_PILOTO = ["OC1224", "80692"] as const;
const CONFIRMACAO = "importar-imagens-bling";
const BUCKET = "produto-imagens";
const denoDns = (globalThis as { Deno?: { resolveDns?: (h: string, t: string) => Promise<string[]> } }).Deno?.resolveDns;
const resolver = denoDns ? async (h: string) => { const [a, b] = await Promise.all([denoDns(h, "A").catch(() => []), denoDns(h, "AAAA").catch(() => [])]); return [...a, ...b]; } : undefined;

Deno.serve(async (req) => {
  const c = await req.clone().json().catch(() => ({}));
  const s = await autenticar(req, c?.loja_id);
  if (s instanceof Response) return s;
  if (s.papel !== "lojista") return json({ erro: "Só o lojista pode importar imagens." }, 403);
  if (c.confirmar !== CONFIRMACAO) return json({ erro: `Envie confirmar: "${CONFIRMACAO}".` }, 400);
  const skus: unknown = c.skus;
  if (!Array.isArray(skus) || !skus.length || skus.length > SKUS_DO_PILOTO.length || skus.some((x) => !(SKUS_DO_PILOTO as readonly string[]).includes(String(x)))) return json({ erro: "Nesta etapa só são aceitos os SKUs do piloto.", aceitos: SKUS_DO_PILOTO }, 400);
  const bling = await blingLeitura(s);
  if (!bling) return json({ erro: "Chave de cifra da plataforma não configurada." }, 503);

  const portas: PortasImportacao = {
    produtoPorSku: async (lojaId, sku) => { const { data } = await s.admin.from("produtos").select("id, loja_id, sku, bling_id").eq("loja_id", lojaId).eq("sku", sku).limit(2); return Array.isArray(data) && data.length === 1 ? data[0] : null; },
    lerProdutoBling: async (blingId) => {
      const r = await bling.ler("bling.produtos.confirmar", { id: blingId });
      if (r.status !== 200) return null;
      const d = (r.corpo as { data?: { id?: unknown; codigo?: unknown } } | null)?.data; const m = extrairMidia(r.corpo);
      return d && m ? { id: String(d.id), codigo: String(d.codigo ?? ""), midia: m } : null;
    },
    baixar: (url) => baixarImagemOriginal(url, { devolverBytes: true, resolver }),
    guardar: async (caminho, bytes, mime) => { const { error } = await s.admin.storage.from(BUCKET).upload(caminho, bytes, { contentType: mime, upsert: false }); return error ? { ok: false } : { ok: true }; },
    gravarLinha: async (linha) => { const { error } = await s.admin.from("produto_imagens").insert(linha); return error ? { ok: false, duplicada: (error as { code?: string }).code === "23505" } : { ok: true }; },
    descartar: async (caminho) => { await s.admin.storage.from(BUCKET).remove([caminho]); },
    novoId: () => crypto.randomUUID(), agora: () => new Date(),
  };
  const resultados = [];
  for (const sku of skus as string[]) resultados.push(...await importarProduto(portas, s.lojaId, sku));
  return json({ resultados, aviso: "Imagens entram NÃO aprovadas, sem direitos e sem confiança. Nada foi escrito no Bling." });
});
