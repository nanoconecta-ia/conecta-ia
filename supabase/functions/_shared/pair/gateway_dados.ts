// Implementação de Dados (gateway.ts) sobre o cliente service_role do Supabase. TODA consulta filtra por loja_id vindo da sessão.
// Colunas selecionadas são lista fechada: nunca bling_id, custo, fornecedor ou campos internos.
import { proporEnriquecimento, type AdminRpc } from "../ia/escrita.ts";
import type { Dados, PropostaAprovacao } from "./gateway.ts";

const seguro = (s: string) => s.replace(/[%,()*\\]/g, " "); // vai para filtro .or(): sem caracteres de sintaxe
const COLUNAS_PRODUTO = "nome, sku, preco, estoque, marca, publicado, situacao";

export function dadosSupabase(admin: AdminRpc, agora: () => Date = () => new Date()): Dados {
  return {
    async listarProdutos(loja, f) {
      let q = admin.from("produtos").select(COLUNAS_PRODUTO).eq("loja_id", loja).limit(f.limite);
      if (f.apenasPublicados) q = q.eq("publicado", true);
      const b = seguro(f.busca).trim();
      if (b) q = q.or(`nome.ilike.%${b}%,sku.ilike.%${b}%`);
      const { data } = await q;
      return data ?? [];
    },
    async obterProduto(loja, sku) {
      const { data: p } = await admin.from("produtos").select(`id, ${COLUNAS_PRODUTO}, gtin, descricao_curta, peso_kg`).eq("loja_id", loja).eq("sku", sku).maybeSingle();
      if (!p) return null;
      const { id, ...resto } = p;
      const falta: string[] = [];
      if (!p.preco) falta.push("preço"); if (!p.descricao_curta) falta.push("descrição"); if (!p.marca) falta.push("marca"); if (!p.gtin) falta.push("GTIN"); if (!p.peso_kg) falta.push("peso");
      const { count } = await admin.from("produto_enriquecimento").select("id", { count: "exact", head: true }).eq("loja_id", loja).eq("produto_id", id).eq("status", "aprovado");
      return { ...resto, itens_aprovados: count ?? 0, faltando_para_publicar: falta };
    },
    async skuParaId(loja, sku) {
      const { data } = await admin.from("produtos").select("id").eq("loja_id", loja).eq("sku", sku).maybeSingle();
      return data?.id ?? null;
    },
    proporEnriquecimento: (loja, a) => proporEnriquecimento(admin, loja, a), // mesma validação do agente interno: fonte obrigatória, a_confirmar
    async proporAprovacao(p: PropostaAprovacao) {
      const { data, error } = await admin.rpc("aprovacao_propor", {
        p_loja: p.loja_id, p_tipo: p.tipo, p_ferramenta: p.ferramenta, p_agente: p.agente, p_sessao: p.sessao_id, p_dispositivo: p.dispositivo_id,
        p_usuario: p.usuario_id, p_alvos: p.alvos, p_antes: p.antes, p_depois: p.depois, p_riscos: p.riscos, p_risco: p.risco,
        p_idempotency_key: p.idempotency_key, p_ttl_min: p.ttl_min, p_grupo: p.grupo ?? null,
      });
      if (error) {
        if (error.code === "23505") return { erro: "A chave de idempotência já foi usada com outro conteúdo. Use uma chave nova." };
        if (error.code === "54000") return { erro: "Há propostas pendentes demais. Aguarde o lojista decidir as anteriores antes de enviar novas." };
        throw new Error("falha ao registrar a proposta"); // detalhe fica no log do servidor, não no modelo
      }
      return { ...data, mensagem: "Pedido enviado à Central de Aprovações. Nada foi publicado: o lojista precisa aprovar esta versão (hash_proposta)." };
    },
    async aprovacoesPendentes(loja, limite) {
      const { data } = await admin.from("aprovacoes").select("id, tipo, ferramenta, agente, risco, versao, expira_em, criado_em")
        .eq("loja_id", loja).eq("estado", "pendente").gt("expira_em", agora().toISOString()).order("criado_em", { ascending: false }).limit(limite);
      return data ?? [];
    },
    async statusTarefa(loja, id) {
      const { data: a } = await admin.from("aprovacoes").select("id, tipo, ferramenta, estado, versao, expira_em, decidido_em, motivo_decisao, hash_proposta").eq("loja_id", loja).eq("id", id).maybeSingle();
      if (a) return { origem: "aprovacao", ...a };
      const { data: t } = await admin.from("enriquecimento_tarefas").select("id, tipo, status, tentativas, criado_em, concluido_em").eq("loja_id", loja).eq("id", id).maybeSingle();
      return t ? { origem: "enriquecimento", ...t } : null;
    },
  };
}
