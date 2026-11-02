// Atividade do agente externo (MCP) no chat do Nano. O resumo é texto do agente: NÃO CONFIÁVEL. Limpa, recusa dado sigiloso e grava só o resumo (nunca a conversa).
export const RESUMO_MAX = 600;
const SIGILOSO = /\b(custo|pre[cç]o de compra|fornecedor|margem|ncm|cest|cfop|cst|cpf|cnpj)\b|@|\b(?:eyJ[\w-]{10,}|sk-[\w-]{10,}|sbp_[\w]{6,})/i;

export type ResumoLimpo = { ok: true; texto: string } | { ok: false; erro: string };

/** Remove HTML/controle, preserva só texto simples; recusa vazio, dado sigiloso e excesso de tamanho. */
export function limparResumo(bruto: unknown): ResumoLimpo {
  if (typeof bruto !== "string") return { ok: false, erro: "Informe um resumo em texto." };
  const texto = bruto.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!texto) return { ok: false, erro: "Resumo vazio." };
  if (texto.length > RESUMO_MAX) return { ok: false, erro: `Resumo acima de ${RESUMO_MAX} caracteres.` };
  if (SIGILOSO.test(texto)) return { ok: false, erro: "O resumo não pode conter custo, fornecedor, dado fiscal, dado pessoal nem credencial." };
  return { ok: true, texto };
}

export interface AdminInsert { from(t: string): { insert(v: Record<string, unknown>): PromiseLike<{ error: unknown }> } & { select(c: string): any } }

/** Grava o resumo; falha fechada (erro devolvido ao agente, nada some em silêncio). */
export async function registrarResumo(admin: AdminInsert, lojaId: string, chaveId: string | null, e: Record<string, unknown>): Promise<unknown> {
  const r = limparResumo(e.resumo);
  if (!r.ok) return { erro: r.erro };
  const linha: Record<string, unknown> = { loja_id: lojaId, mcp_chave_id: chaveId, origem: "gateway_mcp", tipo: "resumo", ferramenta: "nano.atividade.registrar", resumo: r.texto };
  if (typeof e.sku === "string" && e.sku.trim()) {
    const { data } = await (admin.from("produtos") as any).select("id").eq("loja_id", lojaId).eq("sku", e.sku.trim()).limit(1);
    const id = Array.isArray(data) && data[0]?.id;
    if (!id) return { erro: "Produto não encontrado nesta loja." };
    linha.produto_id = id;
  }
  const { error } = await admin.from("agente_atividades").insert(linha);
  if (error) return { erro: "Não foi possível registrar a atividade." };
  return { ok: true, aviso: "Resumo registrado no histórico do Nano, marcado como vindo do agente externo." };
}
