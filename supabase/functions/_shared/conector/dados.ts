// Porta de leitura do Conector IA sobre o banco. TODA consulta é escopada pela loja AQUI (não depende do chamador lembrar).
// Implementação com cliente estilo supabase-js (service_role no servidor). Os testes rodam esta mesma implementação sobre
// um cliente que fala SQL com um Postgres local, para provar nomes de colunas e filtros contra o esquema real.
import { classificarSku, erroSku, type ResultadoSku } from "../produto_sku.ts";
export interface ClienteDados { from(tabela: string): any }
export interface ProdutoLocal { id: string; bling_id: string; sku: string; nome: string | null; publicado: boolean }

export interface PortaDados {
  resumo(): Promise<{ produtos: number; publicados: number; aguardando_aprovacao: number }>;
  listarProdutos(o: { apenasNaoPublicados?: boolean; busca?: string; limite?: number }): Promise<unknown[]>;
  verProduto(sku: string): Promise<Record<string, unknown> | { erro: string }>;
  produtoPorSku(sku: string): Promise<ResultadoSku<ProdutoLocal>>;
  itensPendentes(limite?: number): Promise<unknown[]>;
  buscarTaxonomia(texto: string): Promise<unknown[]>;
  statusBling(): Promise<unknown>;
  travas(o: { produtoId?: string; sku?: string }): Promise<unknown>;
  propostaEstado(id: string): Promise<unknown>;
  prontoPublicacao(o: { sku: string }): Promise<{ pronto: boolean; faltando: string[] } | { erro: string }>;
  buscarConhecimento(texto: string, tipo?: string, limite?: number): Promise<unknown[]>;
}

const lim = (v: unknown, padrao = 10, max = 20) => Math.min(Math.max(Number.isInteger(v) ? (v as number) : padrao, 1), max);
const seguro = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

export function dadosSupabase(c: ClienteDados, lojaId: string): PortaDados {
  const contar = async (t: string, f?: (b: any) => any) => {
    const b = c.from(t).select("id", { count: "exact", head: true }).eq("loja_id", lojaId);
    return (await (f ? f(b) : b)).count ?? 0;
  };
  const dados: PortaDados = {
    async resumo() {
      const [p, pub, pend] = await Promise.all([contar("produtos"), contar("produtos", (b) => b.eq("publicado", true)), contar("produto_enriquecimento", (b) => b.eq("status", "a_confirmar"))]);
      return { produtos: p, publicados: pub, aguardando_aprovacao: pend };
    },
    async listarProdutos(o) {
      let q = c.from("produtos").select("nome, sku, preco, estoque, publicado, situacao").eq("loja_id", lojaId).limit(lim(o.limite));
      if (o.apenasNaoPublicados) q = q.eq("publicado", false);
      const b = seguro(o.busca ?? "");
      if (b) q = q.or(`nome.ilike.%${b}%,sku.ilike.%${b}%`);
      return (await q).data ?? [];
    },
    async verProduto(sku) {
      const { data } = await c.from("produtos").select("id, nome, sku, preco, estoque, marca, gtin, descricao_curta, peso_kg, situacao, publicado, categoria_bling_id, taxonomia_no_id")
        .eq("loja_id", lojaId).eq("sku", sku).limit(2);
      const r = classificarSku<any>(data);
      if (r.estado !== "ok") return erroSku(r);
      const p = r.produto;
      const { id, ...resto } = p;
      const falta: string[] = [];
      if (!p.sku) falta.push("SKU"); if (!p.preco) falta.push("preço"); if (!p.descricao_curta) falta.push("descrição");
      if (!p.marca) falta.push("marca"); if (!p.gtin) falta.push("GTIN"); if (!p.peso_kg) falta.push("peso");
      const aprovados = (await c.from("produto_enriquecimento").select("id", { count: "exact", head: true }).eq("produto_id", id).eq("status", "aprovado")).count ?? 0;
      return { ...resto, itens_aprovados: aprovados, faltando_para_publicar: falta };
    },
    async produtoPorSku(sku) {
      const { data } = await c.from("produtos").select("id, bling_id, sku, nome, publicado").eq("loja_id", lojaId).eq("sku", sku).limit(2);
      return classificarSku<ProdutoLocal>(data);
    },
    async itensPendentes(limite) {
      return (await c.from("produto_enriquecimento").select("campo, valor, fonte, confianca, coletado_em").eq("loja_id", lojaId).eq("status", "a_confirmar").limit(lim(limite))).data ?? [];
    },
    async buscarTaxonomia(texto) {
      const t = seguro(texto);
      if (!t) return [];
      return (await c.from("taxonomia_nos").select("nome, slug, status").ilike("nome", `%${t}%`).limit(15)).data ?? [];
    },
    async statusBling() {
      return (await c.from("bling_conexoes").select("status, ultimo_sync_ok_em, ultimo_erro").eq("loja_id", lojaId).maybeSingle()).data ?? { status: "pendente" };
    },
    async travas(o) {
      let produtoId = o.produtoId;
      if (!produtoId && o.sku) {
        const r = await dados.produtoPorSku(o.sku);
        if (r.estado === "ambiguo") return erroSku(r);
        if (r.estado === "ok") produtoId = r.produto.id;
      }
      if (!produtoId) return { erro: "Informe produto_id ou sku de um produto desta loja." };
      const { data } = await c.from("produto_travas").select("estado, motivo, alterado_em").eq("loja_id", lojaId).eq("produto_id", produtoId).maybeSingle();
      return data ?? { estado: "liberado_propostas", motivo: null };
    },
    async propostaEstado(id) {
      const { data: p } = await c.from("agente_propostas").select("id, titulo, versao, hash, estado, risco, expira_em, agente, provedor, modelo").eq("loja_id", lojaId).eq("id", id).maybeSingle();
      if (!p) return { erro: "Proposta não encontrada nesta loja." };
      const itens = (await c.from("agente_proposta_itens").select("ordem, operacao, alvo, campos, estado, motivo, risco").eq("loja_id", lojaId).eq("proposta_id", id).order("ordem")).data ?? [];
      const ap = (await c.from("agente_aprovacoes").select("decisao, versao, decidido_em, user_id").eq("loja_id", lojaId).eq("proposta_id", id).maybeSingle()).data ?? null;
      return { ...p, itens, aprovacao: ap };
    },
    async prontoPublicacao(o) {
      const { data } = await c.from("produtos").select("id, sku, preco, descricao_curta, situacao").eq("loja_id", lojaId).eq("sku", o.sku).limit(2);
      const r = classificarSku<any>(data);
      if (r.estado !== "ok") return erroSku(r);
      const p = r.produto;
      const faltando: string[] = [];
      if (p.situacao !== "A") faltando.push("produto ativo");
      if (!p.sku) faltando.push("sku"); if (p.preco == null) faltando.push("preço");
      if (!p.descricao_curta) {
        const e = (await c.from("produto_enriquecimento").select("id", { count: "exact", head: true }).eq("produto_id", p.id).eq("campo", "descricao_curta").eq("status", "aprovado")).count ?? 0;
        if (!e) faltando.push("descrição curta");
      }
      const img = (await c.from("produto_imagens").select("id", { count: "exact", head: true }).eq("produto_id", p.id).eq("aprovada", true).eq("principal", true).is("removida_em", null)).count ?? 0;
      if (!img) faltando.push("imagem principal aprovada");
      return { pronto: faltando.length === 0, faltando };
    },
    async buscarConhecimento(texto, tipo, limite) {
      const t = seguro(texto);
      if (!t) return [];
      let q = c.from("agente_conhecimento").select("tipo, titulo, conteudo, fonte, fonte_versao, versao, status, coletado_em")
        .or(`loja_id.eq.${lojaId},loja_id.is.null`).textSearch("busca", t, { config: "portuguese", type: "websearch" }).neq("status", "rejeitado").limit(lim(limite, 5, 10));
      if (tipo) q = q.eq("tipo", tipo);
      return (await q).data ?? [];
    },
  };
  return dados;
}
