// Leitura do Contexto Vivo pelo Nano (chat e MCP). Só leitura, só da loja da chave/sessão (c.lojaId vem do servidor, nunca do argumento).
// Devolve ids, SKU, nome e marca: NUNCA custo, fornecedor, dado fiscal ou credencial. Sem contexto válido: "contexto_indisponivel" (não adivinha).
import { SELECAO_MAX } from "./contexto.ts";

export interface AdminLeitura { from(t: string): any }
export interface ProdutoContexto { id: string; sku: string | null; nome: string | null; marca: string | null }
export type RespostaContexto =
  | { disponivel: true; versao: number; origem: string; atualizado_em: string; produto_ativo: ProdutoContexto | null; selecionados: ProdutoContexto[]; aviso: string }
  | { disponivel: false; erro: "contexto_indisponivel"; aviso: string };

/** `principal` (ex.: "u:<user_id>") restringe à sessão de UMA pessoa (chat do painel). Sem ele, vale o contexto mais recente da loja (agente externo por chave). */
export async function lerContextoDaLoja(admin: AdminLeitura, lojaId: string, agora = new Date(), principal?: string): Promise<RespostaContexto> {
  let q = admin.from("contexto_sessoes").select("origem, produto_ativo_id, produtos_selecionados, versao, atualizado_em").eq("loja_id", lojaId);
  if (principal) q = q.eq("principal", principal);
  const { data, error } = await q.gt("expira_em", agora.toISOString()).order("atualizado_em", { ascending: false }).limit(1);
  const linha = Array.isArray(data) ? data[0] : null;
  if (error || !linha) return { disponivel: false, erro: "contexto_indisponivel", aviso: "Nenhum produto está selecionado ou aberto agora (ou o contexto expirou). Peça ao lojista para selecionar o produto no Conecta.IA; não adivinhe o SKU." };
  const ids: string[] = [...new Set<string>([...(linha.produtos_selecionados ?? []), ...(linha.produto_ativo_id ? [linha.produto_ativo_id] : [])])].slice(0, SELECAO_MAX);
  const mapa = new Map<string, ProdutoContexto>();
  if (ids.length) {
    const r = await admin.from("produtos").select("id, sku, nome, marca").eq("loja_id", lojaId).in("id", ids);
    for (const p of (r.data ?? []) as ProdutoContexto[]) mapa.set(p.id, { id: p.id, sku: p.sku ?? null, nome: p.nome ?? null, marca: p.marca ?? null });
  }
  const pegar = (id: string) => mapa.get(id) ?? null;
  return {
    disponivel: true, versao: linha.versao, origem: linha.origem, atualizado_em: linha.atualizado_em,
    produto_ativo: linha.produto_ativo_id ? pegar(linha.produto_ativo_id) : null,
    selecionados: (linha.produtos_selecionados ?? []).map(pegar).filter((p: ProdutoContexto | null): p is ProdutoContexto => p !== null),
    aviso: "Contexto efêmero (30 min) escolhido pelo lojista no painel. Use o SKU devolvido nas ferramentas de leitura; não altera nada.",
  };
}

/** Texto direto para o chat, sem IA. Só id/SKU/nome/marca autorizados; nunca inventa produto quando o contexto está vazio. */
export function textoDoContexto(r: RespostaContexto): string {
  if (!r.disponivel) return "Não há produto aberto nem selecionado compartilhado com o Nano agora (ou o contexto expirou, após 30 minutos). No Catálogo, ligue \"Compartilhar a seleção com o Nano\" e selecione o produto. Não vou adivinhar o SKU.";
  const linha = (p: ProdutoContexto) => `• ${p.sku ?? "sem SKU"} — ${p.nome ?? "sem nome"}${p.marca ? ` (${p.marca})` : ""}`;
  const partes: string[] = [];
  if (r.produto_ativo) partes.push(`Produto ativo:\n${linha(r.produto_ativo)}`);
  if (r.selecionados.length) partes.push(`Selecionados (${r.selecionados.length}):\n${r.selecionados.map(linha).join("\n")}`);
  if (!partes.length) partes.push("O compartilhamento está ligado, mas nenhum produto está selecionado agora.");
  return `${partes.join("\n\n")}\n\nResposta direta do banco, sem IA (versão ${r.versao}, origem ${r.origem}).`;
}
