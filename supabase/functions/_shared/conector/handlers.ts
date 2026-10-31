// Handlers das ferramentas ATIVAS do registro. Cada um recebe a entrada já validada pelo esquema e o contexto da loja.
// Nenhum handler escreve no Bling: as ferramentas "preparar_*" só montam PROPOSTA; quem escreve é o executor, depois da aprovação.
import { MAPA_CAMPOS, montarCorpoProduto } from "./bling_campos.ts";
import { interpretarConsulta, type Vocabulario } from "../consulta/interpretar.ts";
import type { PortaDados } from "./dados.ts";
import type { PortaBling } from "./porta_bling.ts";
import type { Rpc } from "./executor.ts";
import { buscarDefinicao } from "./registro.ts";
import { montarItensCategoria, type Pendencia } from "./categoria_bling.ts";
import { proporAplicacao, proporCodigo, proporEnriquecimento, proporImagem, type AdminRpc } from "../ia/escrita.ts";
import { chamarPlugin, type PluginRegistro } from "../ia/plugin.ts";
import { buscarDadosTecnicos, buscarImagens } from "../ia/google.ts";

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
  const recebidos = (r.corpo as any)?.data;
  if (!Array.isArray(recebidos)) return { erro: "Resposta inesperada do Bling; consulta inconclusiva." } as const;
  // Não presumir que uma única página contenha todos os produtos quando o limite é atingido.
  if (recebidos.length >= 100) return { erro: "A consulta atingiu 100 registros; conferir paginação antes de propor alterações." } as const;
  // A API pode fazer buscas aproximadas: só o código EXATO é seguro para propor alteração.
  const achados = recebidos.filter((p: any) => String(p?.codigo ?? "") === sku) as any[];
  if (achados.length === 0) return { erro: "Produto com código exato não encontrado entre ativos, inativos e excluídos; não criar duplicata sem busca completa." } as const;
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
    // exceções sem produto no espelho: criar categoria, e reativar (o espelho só tem ATIVOS; o alvo é o id do Bling, lido agora)
    const reativacao = it.operacao === "bling.produtos.alterar" && /^\d{1,20}$/.test(it.alvo ?? "") && JSON.stringify(it.campos ?? Object.keys(it.depois)) === '["situacao"]';
    if (!produtoId && it.operacao !== "bling.categorias.criar" && !reativacao) { erros.push(`item ${i}: produto não encontrado nesta loja`); continue; }
    if (it.operacao === "bling.produtos.alterar" || it.operacao === "bling.produtos.criar") {
      const m = montarCorpoProduto(it.depois);
      if (m.erros.length) { erros.push(`item ${i}: ${m.erros.join("; ")}`); continue; }
    }
    resolvidos.push({ ...it, produto_id: produtoId });
  }
  if (erros.length) return { erro: "Proposta recusada antes de existir.", detalhes: erros };

  const tarefaId = c.tarefaId ?? await rpc(c, "agente_tarefa_criar", { p_loja: c.lojaId, p_user: c.userId, p_conversa: c.conversaId ?? null, p_objetivo: o.titulo });
  const propostaId = await rpc(c, "agente_proposta_criar", { p_loja: c.lojaId, p_user: c.userId, p_tarefa: tarefaId, p_conversa: c.conversaId ?? null,
    p_agente: c.agente?.nome ?? "Nano.ia", p_provedor: c.agente?.provedor ?? null, p_modelo: c.agente?.modelo ?? null, p_prompt_versao: c.agente?.promptVersao ?? null,
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
  "conecta.imagem.buscar_web": async (e, c) => {
    if (!c.buscaImagem) return { erro: "Busca de imagens não configurada. Cole a chave do Google em Integrações de IA." };
    try { return { candidatas: await buscarImagens(c.buscaImagem.chave, c.buscaImagem.cx, String(e.consulta ?? ""), c.fetch) }; }
    catch (err) { return { erro: err instanceof Error ? err.message : "Falha na busca de imagens." }; }
  },
  "conecta.web.pesquisar_tecnico": async (e, c) => {
    if (!c.buscaImagem) return { erro: "Pesquisa técnica não configurada. Configure Google API Key e CX em Integrações de IA." };
    try { return { resultados_candidatos: await buscarDadosTecnicos(c.buscaImagem.chave, c.buscaImagem.cx, String(e.consulta ?? "").trim().slice(0, 200), c.fetch), aviso: "Resumos não comprovam aplicação, OEM, GTIN ou medidas. Confirme na página do fabricante antes de propor alterações." }; }
    catch (err) { return { erro: err instanceof Error ? err.message : "Falha na pesquisa técnica." }; }
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
  // Troca de categoria no Bling a partir das sugestões APROVADAS. Só os SKUs pedidos; só a categoria; lê o Bling AGORA para o "antes". Não grava no Bling.
  "bling.categorias.preparar_alteracao_lote": async (e, c) => {
    if (!c.bling) return { erro: "Leitura do Bling indisponível: sem ela não há como montar o 'antes' da proposta." };
    const base = await c.dados.categoriasAprovadas();
    const porSku = new Map(base.entradas.filter((x) => x.sku).map((x) => [x.sku as string, x]));
    const pedidos: string[] = [...new Set<string>(e.skus)];
    const selecionadas = pedidos.map((s) => porSku.get(s)).filter((x): x is NonNullable<typeof x> => !!x);
    const pendencias: Pendencia[] = [];
    for (const s of pedidos) if (!porSku.has(s)) pendencias.push({ produto_id: null, sku: s, motivo: "sem_sugestao_aprovada", detalhe: "não há sugestão de categoria APROVADA para este SKU" });
    const escolhas: Record<string, string> = {};
    for (const [sku, id] of Object.entries((e.escolhas ?? {}) as Record<string, unknown>)) { const en = porSku.get(sku); if (en) escolhas[en.produto_id] = String(id); }
    const excluir = new Map<string, string>();
    for (const en of selecionadas) if (!en.aplicado) excluir.set(en.produto_id, "a decisão aprovada ainda não foi aplicada ao nó da taxonomia; aguarde a próxima sincronização");
    const r = montarItensCategoria(selecionadas, base.pontes, { categoriasExistentes: new Set(base.categoriasExistentes), escolhas, excluir });
    pendencias.push(...r.pendencias);
    const itens: typeof r.itens = [];
    for (const it of r.itens) {
      const lido = await c.bling.ler("bling.produtos.confirmar", { id: it.alvo }).catch(() => null);
      if (!lido || lido.status !== 200) { pendencias.push({ produto_id: it.produto_id, sku: it.sku ?? null, motivo: "leitura_indisponivel", detalhe: "não consegui ler o produto no Bling agora" }); continue; }
      const atual = (lido.corpo as any)?.data?.categoria?.id;
      const atualId = atual ? String(atual) : null;
      if (atualId === it.depois.categoria_bling_id) { pendencias.push({ produto_id: it.produto_id, sku: it.sku ?? null, motivo: "ja_na_categoria", detalhe: "o Bling já tem essa categoria" }); continue; }
      itens.push({ ...it, antes: { categoria_bling_id: atualId }, validacoes: [...it.validacoes, `categoria lida no Bling em ${new Date().toISOString()}: ${atualId ?? "nenhuma"}`] });
    }
    if (itens.length === 0) return { aviso: "Nenhum item entrou na proposta.", pendencias };
    const prop = await criarPropostaVersionada(c, { titulo: `Trocar a categoria de ${itens.length} produto(s) no Bling`, resumo: "Só o campo categoria, a partir de sugestões aprovadas pelo lojista.", lote: itens.length > 1, itens });
    return { ...(prop as Record<string, unknown>), pendencias };
  },
  // Criação de categoria: lê as categorias do Bling AGORA (não duplica nome, confere o pai) e cria a proposta. Não grava no Bling.
  "bling.categorias.preparar_criacao": async (e, c) => {
    if (!c.bling) return { erro: "Leitura do Bling indisponível: sem ela não dá para conferir duplicidade." };
    const nome = String(e.nome).trim().replace(/\s+/g, " ");
    if (!nome) return { erro: "Informe o nome da categoria." };
    const lido = await c.bling.ler("bling.categorias.consultar", {});
    if (lido.status !== 200) return { erro: `O Bling respondeu ${lido.status} ao listar categorias.` };
    const existentes = ((lido.corpo as any)?.data ?? []) as any[];
    const norm = (t: unknown) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const pai = e.pai_id ? String(e.pai_id) : null;
    if (pai && !existentes.some((x) => String(x.id) === pai)) return { erro: `A categoria pai ${pai} não existe no Bling.` };
    const igual = existentes.find((x) => norm(x.descricao) === norm(nome) && String(x.categoriaPai?.id || "") === (pai ?? ""));
    if (igual) return { aviso: "Essa categoria já existe no Bling; nada foi proposto.", categoria: { id: igual.id, descricao: igual.descricao } };
    return criarPropostaVersionada(c, { titulo: `Criar a categoria "${nome}" no Bling`, resumo: "Só a criação de uma categoria de produto; nenhum produto é alterado.", itens: [{
      operacao: "bling.categorias.criar", campos: ["descricao", ...(pai ? ["categoria_pai_id"] : [])], antes: { descricao: null, ...(pai ? { categoria_pai_id: null } : {}) }, depois: { descricao: nome, ...(pai ? { categoria_pai_id: pai } : {}) }, fontes: e.fontes,
      validacoes: [`categorias do Bling lidas em ${new Date().toISOString()}: nenhuma com este nome${pai ? ` sob o pai ${pai}` : ""}`] }] });
  },
  // Reativação: lê o produto pelo id AGORA (funciona para excluído), exige que não esteja ativo e que não haja OUTRO ativo com o mesmo código/GTIN
  // (evita duplicar), e cria a proposta só da situação. Não grava nada no Bling.
  "bling.produtos.preparar_reativacao": async (e, c) => {
    if (!c.bling) return { erro: "Leitura do Bling indisponível: sem ela não dá para conferir o produto nem a duplicidade." };
    const id = String(e.bling_id).trim();
    if (!/^\d{1,20}$/.test(id)) return { erro: "Informe o id numérico do produto no Bling." };
    const lido = await c.bling.ler("bling.produtos.confirmar", { id });
    if (lido.status === 404) return { erro: `Produto ${id} não encontrado no Bling.` };
    if (lido.status !== 200) return { erro: `O Bling respondeu ${lido.status} ao ler o produto.` };
    const p = (lido.corpo as any)?.data ?? {};
    const situacao = String(p.situacao ?? "");
    if (situacao === "A") return { aviso: "Este produto já está ATIVO no Bling; nada foi proposto.", produto: { id, codigo: p.codigo ?? null, nome: p.nome ?? null } };
    if (situacao !== "E" && situacao !== "I") return { erro: `Situação desconhecida no Bling (${situacao || "vazia"}); não proponho reativar às cegas.` };
    const conflitos: { id: string; codigo: unknown; nome: unknown; por: string }[] = [];
    for (const [por, args] of [["codigo", p.codigo ? { sku: String(p.codigo) } : null], ["gtin", p.gtin ? { gtin: String(p.gtin) } : null]] as const) {
      if (!args) continue;
      const r = await c.bling.ler("bling.produtos.consultar_ativos", args);
      if (r.status !== 200) return { erro: `Não consegui conferir duplicidade por ${por} no Bling (${r.status}); nada foi proposto.` };
      for (const x of ((r.corpo as any)?.data ?? []) as any[]) if (String(x.id) !== id) conflitos.push({ id: String(x.id), codigo: x.codigo ?? null, nome: x.nome ?? null, por });
    }
    if (conflitos.length) return { aviso: "Já existe produto ATIVO com o mesmo código ou GTIN; reativar duplicaria o cadastro. Nada foi proposto.", conflitos };
    const local = p.codigo ? await c.dados.produtoPorSku(String(p.codigo)) : null;
    return criarPropostaVersionada(c, { titulo: `Reativar no Bling o produto ${p.codigo ?? id} (${String(p.nome ?? "").slice(0, 80)})`, resumo: "Só a situação: de excluído/inativo para ativo. Nenhum outro campo é alterado.", itens: [{
      produto_id: local?.id, sku: p.codigo ?? undefined, operacao: "bling.produtos.alterar", alvo: id, campos: ["situacao"], antes: { situacao }, depois: { situacao: "A" }, fontes: e.fontes,
      validacoes: [`produto ${id} lido no Bling em ${new Date().toISOString()}: situação ${situacao}`, `nenhum outro produto ATIVO com o código ${p.codigo ?? "(sem código)"}${p.gtin ? ` ou o GTIN ${p.gtin}` : ""}`] }] });
  },
  // Lê o Bling AGORA, calcula antes/depois dos campos pedidos e cria a proposta. Não grava nada no Bling.
  "bling.produtos.preparar_atualizacao": async (e, c) => {
    const r = await produtoNoBling(c, e.sku);
    if ("erro" in r) return r;
    // A atualização de cadastro só vale para produtos ATIVOS.
    // Um excluído como a INDISA 854008 segue primeiro para a proposta de reativação específica.
    if (r.produto.situacao !== "A") return {
      erro: "Produto excluído/inativo no Bling. Não atualizar campos: primeiro conferir duplicidade e preparar reativação pelo ID.",
      bling_id: r.produto.id, situacao: r.produto.situacao,
    };
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
