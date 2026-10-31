// Ferramentas de ESCRITA do agente: tudo entra como "a_confirmar", com fonte e data; nada é aprovado sozinho.
// Usam o cliente de service_role (passado pelo chamador) porque gravam fora do que a RLS do usuário permite.
// Cada RPC confere, no banco, que o produto pertence à loja (defesa em profundidade além da checagem aqui).
export const CAMPOS_ENRIQUECIMENTO = [
  "marca_peca", "descricao_curta", "descricao_longa", "peso_kg", "dimensoes", "categoria_sugerida", "ncm_sugerido",
  // Loja virtual / site ligado ao Bling (issue #166): busca, SEO. Especificações técnicas vão como "espec:<campo>" (ver abaixo).
  "tags", "seo_titulo", "seo_descricao",
] as const;
/** Especificação técnica / campo customizado do ERP: "espec:" + nome do campo normalizado (a-z, 0-9, _), ex.: espec:diametro_externo_mm. */
export const CAMPO_ESPEC = /^espec:[a-z0-9_]{2,30}$/;
export const campoEnriquecimentoValido = (c: string) => (CAMPOS_ENRIQUECIMENTO as readonly string[]).includes(c) || CAMPO_ESPEC.test(c);
/** Limites por campo (o que vai para o site precisa caber nos campos do ERP/loja). null = ok; texto = motivo da recusa. */
export function problemaNoValor(campo: string, valor: unknown): string | null {
  const t = typeof valor === "string" ? valor.trim() : typeof valor === "number" ? String(valor) : "";
  if (campo === "tags") { const tags = t.split(",").map((x) => x.trim()).filter(Boolean); return !tags.length ? "Informe ao menos uma tag." : tags.length > 20 ? "No máximo 20 tags." : tags.some((x) => x.length > 40) ? "Cada tag deve ter até 40 caracteres." : null; }
  if (campo === "seo_titulo") return t.length < 10 || t.length > 70 ? "Título SEO deve ter de 10 a 70 caracteres." : null;
  if (campo === "seo_descricao") return t.length < 50 || t.length > 160 ? "Descrição SEO deve ter de 50 a 160 caracteres." : null;
  if (CAMPO_ESPEC.test(campo)) return !t || t.length > 200 ? "Especificação deve ter de 1 a 200 caracteres." : null;
  return null;
}
export const TIPOS_CODIGO = ["oem", "fabricante", "ean", "similar", "substituto", "antigo"] as const; // "sku" é do Bling, o agente não propõe

// deno-lint-ignore no-explicit-any
export interface AdminRpc { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>; from: (t: string) => any }

const txt = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const conf = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 1 ? v : null);

async function idDoSku(admin: AdminRpc, lojaId: string, sku: string): Promise<string | null> {
  const { data } = await admin.from("produtos").select("id").eq("loja_id", lojaId).eq("sku", sku).maybeSingle();
  return data?.id ?? null;
}

export async function proporEnriquecimento(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80), campo = txt(e.campo, 40), fonte = txt(e.fonte, 400);
  if (!sku) return { erro: "Informe o SKU do produto." };
  if (!campoEnriquecimentoValido(campo)) return { erro: `Campo não reconhecido. Use um de: ${CAMPOS_ENRIQUECIMENTO.join(", ")} ou espec:<campo> para especificação técnica.` };
  if (!fonte) return { erro: "Informe a fonte (URL ou documento) de onde veio o dado. Sem fonte, não posso propor." };
  if (e.valor == null || e.valor === "") return { erro: "Informe o valor proposto." };
  const problema = problemaNoValor(campo, e.valor);
  if (problema) return { erro: problema };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  const { error } = await admin.rpc("enriquecimento_propor", { p_loja: lojaId, p_produto: produtoId, p_campo: campo, p_valor: JSON.stringify(e.valor), p_fonte: fonte, p_confianca: conf(e.confianca) });
  if (error) return { erro: "Não foi possível registrar a proposta (talvez já exista um valor aprovado para este campo)." };
  return { ok: true, status: "a_confirmar", aviso: "Entrou na fila de aprovação. O lojista decide." };
}

export async function proporCodigo(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80), tipo = txt(e.tipo, 20), valor = txt(e.valor, 120), fonte = txt(e.fonte, 400);
  if (!sku || !valor) return { erro: "Informe o SKU e o código." };
  if (!(TIPOS_CODIGO as readonly string[]).includes(tipo)) return { erro: `Tipo não reconhecido. Use um de: ${TIPOS_CODIGO.join(", ")}.` };
  if (!fonte) return { erro: "Informe a fonte de onde veio o código." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  const { error } = await admin.rpc("codigo_propor", { p_loja: lojaId, p_produto: produtoId, p_tipo: tipo, p_valor: valor, p_fonte: fonte, p_confianca: conf(e.confianca) });
  if (error) return { erro: "Não foi possível registrar o código (talvez já exista)." };
  return { ok: true, status: "a_confirmar" };
}

export async function proporAplicacao(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80), modelo = txt(e.modelo, 80), motor = txt(e.motorizacao, 60), fonte = txt(e.fonte, 400);
  const ini = Number.isInteger(e.ano_inicial) ? e.ano_inicial as number : null, fim = Number.isInteger(e.ano_final) ? e.ano_final as number : null;
  if (!sku || !modelo) return { erro: "Informe o SKU e o modelo do veículo." };
  if (!fonte) return { erro: "Informe a fonte da aplicação (catálogo, manual, cruzamento de código)." };
  if (ini != null && fim != null && fim < ini) return { erro: "O ano final não pode ser antes do ano inicial." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  const { error } = await admin.rpc("aplicacao_propor", { p_loja: lojaId, p_produto: produtoId, p_modelo: modelo, p_motorizacao: motor || null, p_ano_inicial: ini, p_ano_final: fim, p_fonte: fonte, p_confianca: conf(e.confianca) });
  if (error) return { erro: "Não foi possível registrar a aplicação." };
  return { ok: true, status: "a_confirmar" };
}

export async function proporImagem(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80), url = txt(e.url, 600), origem = txt(e.origem, 200), pagina = txt(e.pagina, 600);
  if (!sku || !url) return { erro: "Informe o SKU e o endereço da imagem." };
  if (!/^https:\/\//i.test(url)) return { erro: "A imagem precisa ser um endereço https." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  // cruzamento = o próprio SKU buscado (sinal disponível numa busca por texto; a Fila avisa que os direitos ainda não foram confirmados)
  const { error } = await admin.rpc("imagem_propor", { p_loja: lojaId, p_produto: produtoId, p_url: url, p_origem: origem || "busca_web", p_sku: sku, p_pagina: pagina || null });
  if (error) return { erro: "Não foi possível propor a imagem." };
  return { ok: true, status: "a_confirmar", aviso: "A imagem entrou pendente de aprovação na Fila; direitos de uso ainda não confirmados." };
}
