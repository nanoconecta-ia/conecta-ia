// Handlers das ferramentas ATIVAS do registro. Cada um recebe a entrada já validada pelo esquema e o contexto da loja.
// Nenhum handler escreve no Bling: as ferramentas "preparar_*" só montam PROPOSTA; quem escreve é o executor, depois da aprovação.
import { MAPA_CAMPOS, montarCorpoProduto } from "./bling_campos.ts";
import { interpretarConsulta, type Vocabulario } from "../consulta/interpretar.ts";
import type { PortaDados } from "./dados.ts";
import type { PortaBling } from "./porta_bling.ts";
import type { Rpc } from "./executor.ts";
import { buscarDefinicao } from "./registro.ts";
import { proporAplicacao, proporBanner, proporCodigo, proporEnriquecimento, proporImagem, type AdminRpc } from "../ia/escrita.ts";
import { chamarPlugin, type PluginRegistro } from "../ia/plugin.ts";
import { buscarImagens } from "../ia/google.ts";

export interface ContextoFerramenta {
  lojaId: string;
  /** Humano responsável pela sessão (chat) ou criador da chave (MCP). Nunca um agente. */
  userId: string;
  dados: PortaDados;
  rpc: Rpc;
  admin: AdminRpc;
  bling?: PortaBling;
  conversaId?: string | null;
  tarefaId?: string | null;
  agente?: { nome: string; provedor?: string; modelo?: string; promptVersao?: number };
  plugins?: PluginRegistro[];
  credencialPlugin?: (id: string) => Promise<string | null>;
  buscaImagem?: { chave: string; cx: string } | null;
  fetch?: typeof fetch;
}

type Handler = (e: any, c: ContextoFerramenta) => Promise<unknown>;
const rpc = async (c: ContextoFerramenta, fn: string, args: Record<string, unknown>) => {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

/** Campos do produto no Bling que o agente pode VER (nunca custo, fornecedor, fiscal). */
export function filtrarProdutoBling(p: any): Record<string, unknown> {
  if (!p || typeof p !== "object") return {};
  const pick = (o: any, ks: string[]) => Object.fromEntries(ks.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
  return {
    ...pick(p, ["id", "codigo", "nome", "preco", "situacao", "formato", "tipo", "unidade", "condicao", "marca", "gtin", "gtinEmbalagem", "descricaoCurta", "descricaoComplementar", "pesoLiquido", "pesoBruto", "volumes"]),
    dimensoes: p.dimensoes ? pick(p.dimensoes, ["largura", "altura", "profundidade", "unidadeMedida"]) : undefined,
    categoria: p.categoria ? pick(p.categoria, ["id"]) : undefined,
    estoque: p.estoque ? { saldoVirtualTotal: p.estoque.saldoVirtualTotal } : undefined,
  };
}

const valorEm = (o: any, caminho: readonly string[]) => caminho.reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);

/** Lê um produto no Bling pelo SKU (leitura em tempo real). */
async function produtoNoBling(c: ContextoFerramenta, sku: string) {
  if (!c.bling) return { erro: "Leitura do Bling indisponível neste contexto." } as const;
  const r = await c.bling.ler("bling.produtos.consultar", { sku });
  if (r.status !== 200) return { erro: `O Bling respondeu ${r.status} ao consultar o produto.` } as const;
  const achados = ((r.corpo as any)?.data ?? []) as any[];
  if (achados.length === 0) return { erro: "Produto não encontrado no Bling com esse SKU." } as const;
  if (achados.length > 1) return { erro: "Mais de um produto no Bling com esse SKU; resolva a duplicidade antes." } as const;
  return { produto: achados[0] } as const;
}

type ItemEntrada = { produto_id?: string; sku?: string; operacao: string; alvo?: string; campos?: string[]; antes?: unknown; depois: Record<string, unknown>; fontes: unknown[]; validacoes?: string[]; risco?: string };

/** Cria a proposta (rascunho -> itens -> envio). É a única porta de entrada de mudanças que dependem de aprovação humana. */
export async function criarPropostaVersionada(c: ContextoFerramenta, o: { titulo: string; resumo?: string; lote?: boolean; itens: ItemEntrada[] }) {
  const erros: string[] = [];
  const resolvidos: (ItemEntrada & { produto_id?: string })[] = [];
  for (const [i, it] of o.itens.entries()) {
    const def = buscarDefinicao(it.operacao);
    if (!def || def.permissao !== "executar") { erros.push(`item ${i}: operação '${it.operacao}' não é executável`); continue; }
    let produtoId = it.produto_id;
    if (!produtoId && it.sku) produtoId = (await c.dados.produtoPorSku(it.sku))?.id;
    if (!produtoId && it.operacao !== "bling.categorias.criar") { erros.push(`item ${i}: produto não encontrado nesta loja`); continue; }
    if (it.operacao === "bling.produtos.alterar" || it.operacao === "bling.produtos.criar") {
      const m = montarCorpoProduto(it.depois);
      if (m.erros.length) { erros.push(`item ${i}: ${m.erros.join("; ")}`); continue; }
    }
    resolvidos.push({ ...it, produto_id: produtoId });
  }
  if (erros.length) return { erro: "Proposta recusada antes de existir.", detalhes: erros };

  const tarefaId = c.tarefaId ?? await rpc(c, "agente_tarefa_criar", { p_loja: c.lojaId, p_user: c.userId, p_conversa: c.conversaId ?? null, p_objetivo: o.titulo });
  const propostaId = await rpc(c, "agente_proposta_criar", { p_loja: c.lojaId, p_user: c.userId, p_tarefa: tarefaId, p_conversa: c.conversaId ?? null,
    p_agente: c.agente?.nome ?? "Conector IA", p_provedor: c.agente?.provedor ?? null, p_modelo: c.agente?.modelo ?? null, p_prompt_versao: c.agente?.promptVersao ?? null,
    p_titulo: o.titulo, p_resumo: o.resumo ?? null, p_lote: o.lote ?? resolvidos.length > 1 });
  for (const [i, it] of resolvidos.entries()) {
    await rpc(c, "agente_proposta_item_adicionar", { p_loja: c.lojaId, p_proposta: propostaId, p_produto: it.produto_id ?? null, p_operacao: it.operacao, p_alvo: it.alvo ?? null,
      p_campos: it.campos ?? Object.keys(it.depois), p_antes: it.antes ?? null, p_depois: it.depois, p_fontes: it.fontes, p_validacoes: it.validacoes ?? [],
      p_risco: it.risco ?? buscarDefinicao(it.operacao)!.risco, p_idempotency_key: `${String(propostaId).slice(0, 8)}-${i}-${crypto.randomUUID().slice(0, 12)}` });
  }
  const env = await rpc(c, "agente_proposta_enviar", { p_loja: c.lojaId, p_proposta: propostaId });
  return { proposta_id: propostaId, titulo: o.titulo, versao: env.versao, hash: env.hash, risco: env.risco, itens: resolvidos.length, aviso: "Nada foi alterado. O lojista precisa aprovar esta versão exata na Central de Inteligência." };
}

export const HANDLERS: Record<string, Handler> = {
  "conecta.catalogo.resumo": (_e, c) => c.dados.resumo(),
  "conecta.catalogo.listar": (e, c) => c.dados.listarProdutos({ apenasNaoPublicados: e.apenas_nao_publicados === true, busca: e.busca, limite: e.limite }),
  "conecta.catalogo.ver": (e, c) => c.dados.verProduto(e.sku),
  "engenharia.duplicidade.detectar": (e, c) => rpc(c, "detectar_duplicidade", { p_loja: c.lojaId, p_sku: e.sku ?? null, p_gtin: e.gtin ?? null, p_nome: e.nome ?? null }),
  "engenharia.cruzados.verificar": (e, c) => rpc(c, "verificar_cruzados_do_sku", { p_loja: c.lojaId, p_sku: e.sku }),
  "engenharia.aplicacoes.validar": (e, c) => rpc(c, "validar_aplicacoes_do_sku", { p_loja: c.lojaId, p_sku: e.sku, p_ano: e.ano ?? null }),
  "engenharia.oem.buscar": (e, c) => rpc(c, "dna_por_codigo_oem", { p_loja: c.lojaId, p_codigo: e.codigo, p_apenas_aprovados: e.incluir_a_confirmar !== true }),
  "engenharia.compartilhamento.sugerir": (e, c) => rpc(c, "candidatas_por_compartilhamento", { p_codigo: e.codigo, p_apenas_aprovados: e.incluir_a_confirmar !== true }),
  "engenharia.loja.pecas_do_veiculo": (e, c) => rpc(c, "pecas_da_loja_para_veiculo", { p_loja: c.lojaId, p_versao: e.versao_id, p_ano: e.ano ?? null }),
  "engenharia.intercambio.listar": (e, c) => rpc(c, "intercambio_da_peca", { p_codigo: e.codigo, p_apenas_aprovados: e.incluir_a_confirmar !== true }),
  "engenharia.bula.verificar": (e, c) => rpc(c, "bula_tecnica_do_sku", { p_loja: c.lojaId, p_sku: e.sku }),
  "engenharia.loja.filtros": (_e, c) => rpc(c, "filtros_da_vitrine", { p_loja: c.lojaId }),
  "engenharia.consulta.interpretar": async (e, c) => interpretarConsulta(String(e.texto), (await rpc(c, "vocabulario_de_busca", {})) as Vocabulario),
  "engenharia.loja.condicoes": (e, c) => rpc(c, "condicoes_comerciais", { p_loja: c.lojaId, p_cep: e.cep ?? null }),
  "conecta.enriquecimento.pendentes": (e, c) => c.dados.itensPendentes(e.limite),
  "conecta.travas.consultar": (e, c) => c.dados.travas({ produtoId: e.produto_id, sku: e.sku }),
  "conecta.proposta.estado": (e, c) => c.dados.propostaEstado(e.proposta_id),
  "conecta.publicacao.preparar": async (e, c) => {
    if (!e.sku && !e.produto_id) return { erro: "Informe o sku do produto." };
    return c.dados.prontoPublicacao({ sku: e.sku });
  },
  "conecta.proposta.criar": (e, c) => criarPropostaVersionada(c, e),
  "conecta.enriquecimento.propor": (e, c) => proporEnriquecimento(c.admin, c.lojaId, e),
  "conecta.codigo.propor": (e, c) => proporCodigo(c.admin, c.lojaId, e),
  "conecta.aplicacao.propor": (e, c) => proporAplicacao(c.admin, c.lojaId, e),
  "conecta.imagem.propor": (e, c) => proporImagem(c.admin, c.lojaId, e),
  "conecta.banner.propor": (e, c) => proporBanner(c.admin, c.lojaId, e),
  "conecta.imagem.buscar_web": async (e, c) => {
    if (!c.buscaImagem) return { erro: "Busca de imagens não configurada. Cole a chave do Google em Integrações de IA." };
    try { return { candidatas: await buscarImagens(c.buscaImagem.chave, c.buscaImagem.cx, String(e.consulta ?? ""), c.fetch) }; }
    catch (err) { return { erro: err instanceof Error ? err.message : "Falha na busca de imagens." }; }
  },
  "conecta.plugins.listar": async (_e, c) => (c.plugins ?? []).filter((p) => p.ativo).map((p) => ({ nome: p.nome, tipo: p.tipo, capacidades: p.capacidades, risco: p.risco })),
  "conecta.plugins.chamar": async (e, c) => {
    const p = (c.plugins ?? []).find((x) => x.nome.toLowerCase() === String(e.plugin).toLowerCase());
    if (!p) return { erro: "Plugin não encontrado." };
    const r = await chamarPlugin(p, (await c.credencialPlugin?.(p.id)) ?? null, String(e.capacidade), e.entrada ?? {}, c.fetch);
    return r.ok ? { dados_do_plugin_a_conferir: r.dados } : { erro: r.erro };
  },
  "conhecimento.buscar": (e, c) => c.dados.buscarConhecimento(e.texto, e.tipo, e.limite),
  "engenharia.taxonomia.buscar": (e, c) => c.dados.buscarTaxonomia(e.texto),
  "bling.status.consultar": (_e, c) => c.dados.statusBling(),
  "bling.produtos.consultar": async (e, c) => {
    const r = await produtoNoBling(c, e.sku);
    return "erro" in r ? r : { fonte: "Bling (leitura em tempo real)", lido_em: new Date().toISOString(), produto: filtrarProdutoBling(r.produto) };
  },
  "bling.categorias.consultar": async (e, c) => {
    if (!c.bling) return { erro: "Leitura do Bling indisponível neste contexto." };
    const r = await c.bling.ler("bling.categorias.consultar", {});
    if (r.status !== 200) return { erro: `O Bling respondeu ${r.status} ao listar categorias.` };
    const busca = String(e.busca ?? "").toLowerCase();
    return ((r.corpo as any)?.data ?? []).map((x: any) => ({ id: x.id, descricao: x.descricao, categoria_pai_id: x.categoriaPai?.id || null }))
      .filter((x: any) => !busca || String(x.descricao).toLowerCase().includes(busca));
  },
  // Lê o Bling AGORA, calcula antes/depois dos campos pedidos e cria a proposta. Não grava nada no Bling.
  "bling.produtos.preparar_atualizacao": async (e, c) => {
    const r = await produtoNoBling(c, e.sku);
    if ("erro" in r) return r;
    const campos = Object.keys(e.campos ?? {});
    if (campos.length === 0) return { erro: "Informe ao menos um campo em 'campos'." };
    const m = montarCorpoProduto(e.campos);
    if (m.erros.length) return { erro: "Campos recusados", detalhes: m.erros };
    const antes = Object.fromEntries(campos.map((k) => {
      const mp = MAPA_CAMPOS.find((x) => x.conecta === k)!;
      const v = valorEm(r.produto, mp.caminho);
      return [k, v === undefined || v === "" || v === 0 ? null : (mp.tipo === "id_numerico" ? String(v) : v)];
    }));
    const local = await c.dados.produtoPorSku(e.sku);
    return criarPropostaVersionada(c, { titulo: `Atualizar ${campos.join(", ")} de ${e.sku} no Bling`, itens: [{
      produto_id: local?.id, sku: e.sku, operacao: "bling.produtos.alterar", alvo: String(r.produto.id), campos, antes, depois: e.campos, fontes: e.fontes,
      validacoes: [`produto lido no Bling em ${new Date().toISOString()}`, "corpo montado e validado contra a lista de campos permitidos"] }] });
  },
};
