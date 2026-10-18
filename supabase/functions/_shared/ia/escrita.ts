// Ferramentas de ESCRITA do agente: tudo entra como "a_confirmar", com fonte e data; nada é aprovado sozinho.
// Usam o cliente de service_role (passado pelo chamador) porque gravam fora do que a RLS do usuário permite.
// Cada RPC confere, no banco, que o produto pertence à loja (defesa em profundidade além da checagem aqui).
export const CAMPOS_ENRIQUECIMENTO = [
  "marca_peca", "descricao_curta", "descricao_longa", "peso_kg", "dimensoes", "categoria_sugerida", "ncm_sugerido",
] as const;
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
  if (!(CAMPOS_ENRIQUECIMENTO as readonly string[]).includes(campo)) return { erro: `Campo não reconhecido. Use um de: ${CAMPOS_ENRIQUECIMENTO.join(", ")}.` };
  if (!fonte) return { erro: "Informe a fonte (URL ou documento) de onde veio o dado. Sem fonte, não posso propor." };
  if (e.valor == null || e.valor === "") return { erro: "Informe o valor proposto." };
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
  const sku = txt(e.sku, 80), url = txt(e.url, 600), origem = txt(e.origem, 200);
  if (!sku || !url) return { erro: "Informe o SKU e o endereço da imagem." };
  if (!/^https:\/\//i.test(url)) return { erro: "A imagem precisa ser um endereço https." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  const { error } = await admin.rpc("imagem_propor", { p_loja: lojaId, p_produto: produtoId, p_url: url, p_origem: origem || "busca_web", p_tipo: "ilustrativa" });
  if (error) return { erro: "Não foi possível propor a imagem." };
  return { ok: true, status: "a_confirmar", aviso: "A imagem entrou pendente de aprovação na Fila; direitos de uso ainda não confirmados." };
}
