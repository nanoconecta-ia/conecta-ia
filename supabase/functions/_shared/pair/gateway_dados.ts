// Implementação de Dados (gateway.ts) sobre o cliente service_role do Supabase. TODA consulta filtra por loja_id vindo da sessão.
// Colunas selecionadas são lista fechada: nunca bling_id, custo, fornecedor ou campos internos.
import { proporAplicacao, proporCodigo, proporEnriquecimento, proporImagem, type AdminRpc } from "../ia/escrita.ts";
import { consultarProduto } from "../assistente/bling_consultar.ts";
import type { Config } from "../bling_token.ts";
import type { Dados, PropostaAprovacao } from "./gateway.ts";

const seguro = (s: string) => s.replace(/[%,()*\\]/g, " "); // vai para filtro .or(): sem caracteres de sintaxe
const COLUNAS_PRODUTO = "nome, sku, preco, estoque, marca, publicado, situacao";

export function dadosSupabase(admin: AdminRpc, agora: () => Date = () => new Date(), bling?: { cfg: Config; ambiente: "real" | "sintetico" | "nao_validado" }): Dados {
  async function idDoSku(loja: string, sku: string): Promise<string | null> {
    const { data } = await admin.from("produtos").select("id").eq("loja_id", loja).eq("sku", sku).maybeSingle();
    return data?.id ?? null;
  }
  /** Se o lojista pausou o cadastro automático deste produto, nenhuma proposta passa (o banco também recusa, por gatilho). */
  async function pausado(loja: string, sku: unknown): Promise<{ erro: string } | null> {
    if (typeof sku !== "string" || !sku) return null;
    const id = await idDoSku(loja, sku);
    if (!id) return null;
    const { data } = await admin.from("produto_automacao").select("pausado").eq("loja_id", loja).eq("produto_id", id).maybeSingle();
    return data?.pausado === true ? { erro: "O lojista pausou o cadastro automático deste produto. Não proponha nada nele; avise que está pausado." } : null;
  }
  return {
    async consultarProdutoBling(sessao, sku) {
      // Defesa extra para uso desta porta fora do roteador. Nenhuma loja vem dos argumentos do agente.
      if (!sessao.escopos.includes("bling:consultar") || !bling) throw new Error("Consulta Bling não autorizada ou não configurada.");
      return consultarProduto({ sku }, {
        usuario: admin, admin, lojaId: sessao.loja_id, userId: sessao.usuario_id,
        pair: { sessaoId: sessao.sessao_id, dispositivoId: sessao.dispositivo_id, ambiente: bling.ambiente },
        cfg: bling.cfg, simulado: bling.ambiente === "sintetico", chamadas: [], evidencias: [],
      });
    },
    async listarProdutos(loja, f) {
      let q = admin.from("produtos").select(COLUNAS_PRODUTO).eq("loja_id", loja).limit(f.limite);
      if (f.apenasPublicados) q = q.eq("publicado", true);
      const b = seguro(f.busca).trim();
      if (b) q = q.or(`nome.ilike.%${b}%,sku.ilike.%${b}%`);
      const { data } = await q;
      return data ?? [];
    },
    async obterProduto(loja, sku) {
      const { data: p } = await admin.from("produtos").select(`id, ${COLUNAS_PRODUTO}, gtin, descricao_curta, descricao_complementar, peso_kg, sincronizado_em`).eq("loja_id", loja).eq("sku", sku).maybeSingle();
      if (!p) return null;
      const { id, descricao_complementar, ...resto } = p;
      const falta: string[] = [];
      // descrição = curta OU longa (complementar) do ERP; antes só a curta contava e o Nano dizia "falta descrição" com a longa preenchida
      if (!p.preco) falta.push("preço"); if (!p.descricao_curta && !descricao_complementar) falta.push("descrição"); if (!p.marca) falta.push("marca"); if (!p.gtin) falta.push("GTIN"); if (!p.peso_kg) falta.push("peso");
      const { data: pend } = await admin.rpc("produto_pendencias", { p_loja: loja, p_produto: id }); // exigências reais de publicação; antes da migração, cai no cálculo simples
      const { count } = await admin.from("produto_enriquecimento").select("id", { count: "exact", head: true }).eq("loja_id", loja).eq("produto_id", id).eq("status", "aprovado");
      return { ...resto, tem_descricao_longa: !!descricao_complementar, itens_aprovados: count ?? 0, faltando_para_publicar: pend?.faltando ?? falta, automacao_pausada: pend?.automacao_pausada ?? false };
    },
    async registrarContexto(loja, usuario, sku, acao) {
      // A função do banco resolve o SKU DENTRO da loja da sessão e grava como a pessoa que aprovou o pareamento. Falha fechada, sem vazar erro interno.
      const { data, error } = await admin.rpc("contexto_registrar_extensao", { p_loja: loja, p_user: usuario, p_sku: sku, p_acao: acao });
      if (error || !data) return { erro: "Não foi possível registrar o contexto agora." };
      const r = data as { ok?: boolean; erro?: string; versao?: number };
      return r.ok ? { ok: true, versao: r.versao, aviso: "Contexto compartilhado com o Nano por 30 minutos. Nada foi alterado no produto nem no ERP." } : { erro: r.erro === "produto_nao_encontrado" ? "Produto não encontrado nesta loja." : "Contexto não registrado." };
    },
    async skuParaId(loja, sku) {
      const { data } = await admin.from("produtos").select("id").eq("loja_id", loja).eq("sku", sku).maybeSingle();
      return data?.id ?? null;
    },
    proporEnriquecimento: async (loja, a) => (await pausado(loja, a.sku)) ?? proporEnriquecimento(admin, loja, a), // mesma validação do agente interno: fonte obrigatória, a_confirmar
    proporCodigo: async (loja, a) => (await pausado(loja, a.sku)) ?? proporCodigo(admin, loja, a),
    proporAplicacao: async (loja, a) => (await pausado(loja, a.sku)) ?? proporAplicacao(admin, loja, a),
    proporImagem: async (loja, a) => (await pausado(loja, a.sku)) ?? proporImagem(admin, loja, a),
    async proporBula(loja, a) {
      const bloqueio = await pausado(loja, a.sku);
      if (bloqueio) return bloqueio;
      const id = await idDoSku(loja, String(a.sku ?? ""));
      if (!id) return { erro: "Produto não encontrado nesta loja." };
      const { data, error } = await admin.rpc("bula_propor", { p_loja: loja, p_produto: id, p_medidas: a.medidas, p_contra: Array.isArray(a.contraindicacoes) ? a.contraindicacoes.map(String) : [], p_fonte: String(a.fonte ?? "") });
      if (error) return { erro: "Não foi possível registrar a bula (verifique as medidas: cada uma precisa de valor numérico e unidade; bula já aprovada não é alterada)." };
      return data;
    },
    async consultarPeca(loja, termo) {
      const t = seguro(termo).trim();
      const bruto = termo.replace(/[^0-9A-Za-z]/g, "");
      const filtros = [`nome.ilike.%${t}%`, `sku.ilike.%${t}%`, `descricao_curta.ilike.%${t}%`];
      if (/^\d{8,14}$/.test(bruto)) filtros.push(`gtin.eq.${bruto}`);
      const { data: porCampo } = await admin.from("produtos").select(COLUNAS_PRODUTO).eq("loja_id", loja).or(filtros.join(",")).limit(10);
      const { data: porCodigo } = await admin.from("produto_codigos").select("produto_id, tipo, valor, status").eq("loja_id", loja).ilike("valor", `%${t}%`).limit(10);
      const ids = [...new Set((porCodigo ?? []).map((c: { produto_id: string }) => c.produto_id))];
      const { data: viaCodigo } = ids.length ? await admin.from("produtos").select(COLUNAS_PRODUTO).eq("loja_id", loja).in("id", ids) : { data: [] };
      const vistos = new Set<string>();
      const produtos = [...(porCampo ?? []), ...(viaCodigo ?? [])].filter((p: { sku: string | null }) => { const k = String(p.sku); if (vistos.has(k)) return false; vistos.add(k); return true; });
      let tecnico: unknown = null;
      if (bruto.length >= 5) { const { data } = await admin.rpc("dna_por_codigo_oem", { p_loja: loja, p_codigo: termo, p_apenas_aprovados: true }); tecnico = data ?? null; }
      return { termo, produtos_da_loja: produtos, codigos_cadastrados: (porCodigo ?? []).map((c: { tipo: string; valor: string; status: string }) => ({ tipo: c.tipo, valor: c.valor, status: c.status })), cadastro_tecnico_aprovado: tecnico,
        aviso: "Só dado aprovado no cadastro técnico. Sem registro = não confirmado. Para completar, proponha com FONTE real." };
    },
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
    async camposAprovados(loja, sku) {
      const id = await idDoSku(loja, sku);
      if (!id) return null;
      // Lista fechada; nunca ncm_sugerido (fiscal). Especificações técnicas: espec:<campo>.
      const CAMPOS = ["marca_peca", "descricao_curta", "descricao_longa", "peso_kg", "categoria_sugerida", "tags", "seo_titulo", "seo_descricao"];
      const [{ data: enr }, { data: cod }, { data: imgs }] = await Promise.all([
        admin.from("produto_enriquecimento").select("id, campo, valor, fonte, coletado_em").eq("loja_id", loja).eq("produto_id", id).eq("status", "aprovado").or(`campo.in.(${CAMPOS.join(",")}),campo.like.espec:%`).order("coletado_em", { ascending: false }).limit(100),
        admin.from("produto_codigos").select("id, valor, fonte, coletado_em").eq("loja_id", loja).eq("produto_id", id).eq("tipo", "ean").eq("status", "aprovado").order("coletado_em", { ascending: false }).limit(1),
        // imagens aprovadas pelo lojista (inclui as que o Nano.IA achou na web e o lojista aprovou), na ordem da vitrine
        admin.from("produto_imagens").select("id, url, origem, criado_em").eq("loja_id", loja).eq("produto_id", id).eq("aprovada", true).order("principal", { ascending: false }).order("ordem").limit(10),
      ]);
      const vistos = new Set<string>(), campos: { id: string; campo: string; valor: string; fonte: string | null; aprovado_em: string | null }[] = [];
      for (const e of (enr ?? []) as { id: string; campo: string; valor: unknown; fonte: string | null; coletado_em: string | null }[]) {
        if (vistos.has(e.campo) || !(CAMPOS.includes(e.campo) || /^espec:[a-z0-9_]{2,30}$/.test(e.campo))) continue; // o mais recente de cada campo; lista fechada
        const v = typeof e.valor === "string" ? e.valor : typeof e.valor === "number" ? String(e.valor) : null; // objeto (ex.: dimensões) não vira texto de campo
        if (v === null) continue;
        vistos.add(e.campo); campos.push({ id: e.id, campo: e.campo, valor: v, fonte: e.fonte, aprovado_em: e.coletado_em });
      }
      for (const c of (cod ?? []) as { id: string; valor: string; fonte: string | null; coletado_em: string | null }[]) campos.push({ id: c.id, campo: "ean", valor: c.valor, fonte: c.fonte, aprovado_em: c.coletado_em });
      for (const i of (imgs ?? []) as { id: string; url: string; origem: string | null; criado_em: string | null }[]) if (/^https:\/\//.test(i.url)) campos.push({ id: i.id, campo: "imagem", valor: i.url, fonte: i.origem, aprovado_em: i.criado_em });
      return { sku, campos };
    },
    async statusSincronizacao(loja) {
      const umaHora = new Date(agora().getTime() - 3600_000).toISOString();
      const umDia = new Date(agora().getTime() - 24 * 3600_000).toISOString();
      const [{ data: con }, { data: erros }, { count: velhos }] = await Promise.all([
        admin.from("bling_conexoes").select("status, ultimo_sync_ok_em, ultimo_erro").eq("loja_id", loja).maybeSingle(),
        admin.from("sync_erros").select("mensagem, detalhe").eq("loja_id", loja).gte("criado_em", umaHora).order("criado_em", { ascending: false }).limit(500),
        admin.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", loja).eq("situacao", "A").lt("sincronizado_em", umDia),
      ]);
      const porTipo = new Map<string, number>();
      const repetidos = new Map<string, Set<string>>();
      for (const e of (erros ?? []) as { mensagem: string; detalhe: { sku?: string; bling_id?: string | number } | null }[]) {
        porTipo.set(e.mensagem, (porTipo.get(e.mensagem) ?? 0) + 1);
        const sku = e.detalhe?.sku;
        if (e.mensagem === "SKU repetido entre IDs do Bling" && typeof sku === "string") (repetidos.get(sku) ?? repetidos.set(sku, new Set()).get(sku)!).add(String(e.detalhe?.bling_id ?? ""));
      }
      const c = con as { status?: string; ultimo_sync_ok_em?: string | null; ultimo_erro?: string | null } | null;
      return {
        conexao: c?.status ?? "sem_conexao", ultimo_sync_completo_em: c?.ultimo_sync_ok_em ?? null, ultimo_erro: c?.ultimo_erro ?? null,
        erros_ultima_hora: [...porTipo].map(([mensagem, total]) => ({ mensagem, total })).sort((a, b) => b.total - a.total),
        // nunca o ID interno do ERP: só o SKU e quantos cadastros extras ele tem
        skus_repetidos_no_erp: [...repetidos].map(([sku, ids]) => ({ sku, cadastros_extras: ids.size })).slice(0, 20),
        produtos_ativos_com_espelho_mais_velho_que_24h: velhos ?? 0,
        aviso: "Marca, descrição, categoria e fotos alteradas só no ERP não aparecem na listagem: o espelho só as relê em 24 h ou com 'Reler do Bling' no Studio.",
      };
    },
    async imagensProduto(loja, sku) {
      const id = await idDoSku(loja, sku);
      if (!id) return null;
      const { data } = await admin.from("produto_imagens").select("url, origem, tipo, ordem, principal, aprovada, direitos_confirmados_em, removida_em")
        .eq("loja_id", loja).eq("produto_id", id).order("ordem").limit(20);
      const lista = ((data ?? []) as { url: string; origem: string | null; tipo: string; ordem: number; principal: boolean; aprovada: boolean; direitos_confirmados_em: string | null; removida_em: string | null }[])
        .filter((i) => !i.removida_em && /^https:\/\//.test(i.url))
        .map((i) => ({ url: i.url, origem: i.origem, tipo: i.tipo, ordem: i.ordem, principal: i.principal, aprovada: i.aprovada, direitos_confirmados: !!i.direitos_confirmados_em,
          aparece_na_loja: i.aprovada && !!i.direitos_confirmados_em }));
      return { sku, total: lista.length, aprovadas: lista.filter((i) => i.aprovada).length, na_loja: lista.filter((i) => i.aparece_na_loja).length, imagens: lista,
        aviso: "Aprovar imagem e confirmar direitos é decisão do lojista na Fila." };
    },
    async statusTarefa(loja, id) {
      const { data: a } = await admin.from("aprovacoes").select("id, tipo, ferramenta, estado, versao, expira_em, decidido_em, motivo_decisao, hash_proposta").eq("loja_id", loja).eq("id", id).maybeSingle();
      if (a) return { origem: "aprovacao", ...a };
      const { data: t } = await admin.from("enriquecimento_tarefas").select("id, tipo, status, tentativas, criado_em, concluido_em").eq("loja_id", loja).eq("id", id).maybeSingle();
      return t ? { origem: "enriquecimento", ...t } : null;
    },
  };
}
