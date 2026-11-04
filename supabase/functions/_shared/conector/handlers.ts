// Handlers das ferramentas ATIVAS do registro. Cada um recebe a entrada já validada pelo esquema e o contexto da loja.
// Nenhum handler escreve no Bling: as ferramentas "preparar_*" só montam PROPOSTA; quem escreve é o executor, depois da aprovação.
import { registrarResumo } from "./atividade.ts";
import { lerContextoDaLoja } from "../contexto/ler.ts";
import { baixarImagemOriginal } from "../busca_segura/imagem_original.ts";
/** Resolvedor DNS do runtime (Deno). Fora dele (testes), fica indefinido e vale só a checagem estática do endereço. */
const denoDns = (globalThis as { Deno?: { resolveDns?: (h: string, t: string) => Promise<string[]> } }).Deno?.resolveDns;
const resolverDns: ((host: string) => Promise<string[]>) | undefined = denoDns
  ? async (host) => { const [a, aaaa] = await Promise.all([denoDns(host, "A").catch(() => []), denoDns(host, "AAAA").catch(() => [])]); return [...a, ...aaaa]; }
  : undefined;
import { conflitoDeMarca, validarMarca } from "../cadastro/regras_marca.ts";
import { MAPA_CAMPOS, montarCorpoCriacao, montarCorpoProduto } from "./bling_campos.ts";
import { validarRascunho } from "../cadastro/regras_cadastro.ts";
import { validarPropostaPreco } from "../preco/regras_preco.ts";
import type { Vocabulario } from "../consulta/interpretar.ts";
import { resolverEntidades, type GlossarioMotor } from "../busca_segura/entidades.ts";
import { classeDaFonte, hashTrecho, type EvidenciaBusca } from "../busca_segura/evidencia.ts";
import { montarGaleria, type CandidataEntrada } from "../busca_segura/galeria.ts";
import { investigar } from "../busca_segura/investigacao.ts";
import { proximoSku } from "../busca_segura/regras_sku.ts";
import type { PortaDados } from "./dados.ts";
import type { PortaBling } from "./porta_bling.ts";
import type { Rpc } from "./executor.ts";
import { buscarDefinicao } from "./registro.ts";
import { montarItensCategoria, type Pendencia } from "./categoria_bling.ts";
import { proporAplicacao, proporCodigo, proporEnriquecimento, proporImagem, type AdminRpc } from "../ia/escrita.ts";
import { chamarPlugin, type PluginRegistro } from "../ia/plugin.ts";
import { escolherProvedorBusca } from "../ia/provedor_busca.ts";
import type { ConfigSearxng } from "../ia/searxng.ts";
import { SEM_PROVEDOR, erroDeBusca } from "../ia/busca.ts";

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
  searxng?: ConfigSearxng | null;
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
    if (!produtoId && it.operacao !== "bling.categorias.criar" && it.operacao !== "bling.produtos.criar" && !reativacao) { erros.push(`item ${i}: produto não encontrado nesta loja`); continue; }
    if (it.operacao === "bling.produtos.alterar" || it.operacao === "bling.produtos.criar") {
      const m = it.operacao === "bling.produtos.criar" ? montarCorpoCriacao(it.depois) : montarCorpoProduto(it.depois);
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

/** Códigos que PROVAM identidade do produto (SKU, GTIN e códigos aprovados oem/fabricante/ean/antigo). similar/substituto nunca entram. */
async function codigosConhecidosDoProduto(c: ContextoFerramenta, sku: string): Promise<{ lista: string[]; oem: string[]; fabricante: string[] } | { erro: string }> {
  const p = await c.dados.verProduto(sku) as Record<string, unknown>;
  if ("erro" in p) return { erro: String(p.erro) };
  const lista = new Set<string>([sku]), oem = new Set<string>(), fabricante = new Set<string>();
  if (typeof p.gtin === "string" && p.gtin.trim()) lista.add(p.gtin.trim());
  const loc = await c.dados.produtoPorSku(sku);
  if (loc) {
    const { data } = await c.admin.from("produto_codigos").select("tipo, valor, status").eq("produto_id", loc.id).eq("status", "aprovado");
    for (const r of (data ?? []) as { tipo: string; valor: string }[]) if (["oem", "fabricante", "ean", "antigo", "sku"].includes(r.tipo) && r.valor?.trim()) {
      lista.add(r.valor.trim()); if (r.tipo === "oem") oem.add(r.valor.trim()); if (r.tipo === "fabricante") fabricante.add(r.valor.trim());
    }
  }
  return { lista: [...lista], oem: [...oem], fabricante: [...fabricante] };
}

/** Piloto Mobis (ordem do dono, 02/11/2026): UM cadastro novo por vez, para conferir a taxonomia depois de cada um. Subir o teto (até 10) é decisão do dono, loja a loja. */
export const PILOTO_CADASTRO_MAX_ABERTOS = 1;
const ESTADOS_ABERTOS = ["rascunho", "pendente", "aprovada", "executando"];
async function cadastrosNovosEmAberto(c: ContextoFerramenta): Promise<number | { erro: string }> {
  const { data: props, error } = await c.admin.from("agente_propostas").select("id").eq("loja_id", c.lojaId).in("estado", ESTADOS_ABERTOS);
  if (error) return { erro: "Não consegui conferir se já há cadastro novo aguardando decisão; por segurança nada foi proposto." };
  const ids = ((props ?? []) as { id: string }[]).map((x) => x.id);
  if (!ids.length) return 0;
  const { data: itens, error: e2 } = await c.admin.from("agente_proposta_itens").select("id").eq("loja_id", c.lojaId).eq("operacao", "bling.produtos.criar").in("proposta_id", ids);
  if (e2) return { erro: "Não consegui conferir se já há cadastro novo aguardando decisão; por segurança nada foi proposto." };
  return ((itens ?? []) as unknown[]).length;
}
/** SKU automático (CI + 6 dígitos): depois do maior conhecido no espelho, conferindo o Bling na hora. Só PROPÕE; falha fechada se o Bling não responde. */
async function skuProposto(c: ContextoFerramenta): Promise<{ sku: string } | { erro: string }> {
  if (!c.bling) return { erro: "Sem leitura do Bling: não proponho SKU sem conferir se o código já existe." };
  const { data, error } = await c.admin.from("produtos").select("sku").eq("loja_id", c.lojaId).like("sku", "CI%");
  if (error) return { erro: "Não consegui ler os SKUs conhecidos; nenhum SKU foi proposto." };
  const conhecidos = ((data ?? []) as { sku: string | null }[]).map((x) => x.sku ?? "").filter(Boolean), ocupados: string[] = [];
  for (let t = 0; t < 5; t++) {
    const sku = proximoSku(conhecidos, ocupados);
    const r = await c.bling.ler("bling.produtos.consultar", { sku });
    if (r.status !== 200) return { erro: `O Bling respondeu ${r.status} ao conferir o SKU ${sku}; nenhum SKU foi proposto.` };
    if (!((r.corpo as any)?.data ?? []).length) return { sku };
    ocupados.push(sku);
  }
  return { erro: "Cinco SKUs seguidos já existem no Bling; nenhum foi proposto. Revisar a sequência com o dono." };
}

export const HANDLERS: Record<string, Handler> = {
  // Chat: só a sessão da PRÓPRIA pessoa. Agente externo (MCP): contexto mais recente da loja (decisão C2); userId da chave não vale como identidade aqui.
  "conecta.contexto.produto_ativo": (_e, c) => lerContextoDaLoja(c.admin as any, c.lojaId, new Date(), (c as { origem?: string }).origem === "chat" && c.userId ? `u:${c.userId}` : undefined),
  "nano.atividade.registrar": (e, c) => registrarResumo(c.admin as any, c.lojaId, (c as { mcpChaveId?: string | null }).mcpChaveId ?? null, e),
  "conecta.catalogo.resumo": (_e, c) => c.dados.resumo(),
  "nano.diagnostico.ia": (_e, c) => c.dados.diagnosticoIa(),
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
  // PR #242: a interpretação passa pela resolução de entidades (ano não é motor; códigos de motor são só termos candidatos). Saída retrocompatível:
  // todos os campos antigos continuam, com `motor` e `ano_e_motor` acrescentados. Sem glossário no banco (ou falha ao ler) = vazio: nunca presume motor.
  "engenharia.consulta.interpretar": async (e, c) => {
    const vocab = (await rpc(c, "vocabulario_de_busca", {})) as Vocabulario;
    let gloss: GlossarioMotor = { termos: [] }, glossarioIndisponivel = false;
    try { const g = (await rpc(c, "glossario_de_motores", {})) as GlossarioMotor | null; if (g && Array.isArray(g.termos)) gloss = g; else glossarioIndisponivel = true; }
    catch { glossarioIndisponivel = true; }
    const r = resolverEntidades(String(e.texto), vocab, gloss);
    return { ...r.interpretacao, perguntas: r.perguntas, avisos: [...r.avisos, ...(glossarioIndisponivel ? ["Glossário de motores indisponível: nenhum motor é presumido."] : [])], motor: r.motor, ano_e_motor: false };
  },
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
  "conecta.imagem.propor": (e, c) => proporImagem(c.admin, c.lojaId, e, (u) => baixarImagemOriginal(u, { resolver: resolverDns })),
  "conecta.imagem.buscar_web": async (e, c) => {
    const provedor = escolherProvedorBusca(c);
    if (!provedor) return SEM_PROVEDOR();
    try {
      const candidatas = await provedor.imagens(String(e.consulta ?? ""));
      const sku = typeof e.sku === "string" ? e.sku.trim() : "";
      // Sem SKU: comportamento antigo (lista crua). Com SKU: GALERIA de até 8, com estado, origem e prova do código (PR #242). Nada é aprovado nem salvo.
      if (!sku) return { candidatas, aviso: "Candidatas: origem e direitos de uso NÃO confirmados. Nada foi salvo nem publicado." };
      const codigos = await codigosConhecidosDoProduto(c, sku);
      if ("erro" in codigos) return codigos;
      const hoje = new Date().toISOString().slice(0, 10);
      const entradas: CandidataEntrada[] = [];
      for (const k of candidatas) {
        const achado = codigos.lista.find((cd) => (k.titulo ?? "").toUpperCase().replace(/[\s_-]+/g, "").includes(cd.toUpperCase().replace(/[\s_-]+/g, "")));
        const evidencia: EvidenciaBusca | null = achado ? { url: k.pagina, titulo: k.titulo, coletada_em: hoje, trecho: k.titulo, codigo_exato: achado, contexto_aplicacao: null,
          sha256: await hashTrecho(k.titulo), confianca: 0.5, classe: classeDaFonte(k.pagina) } : null;
        entradas.push({ url: k.url, pagina: k.pagina, titulo: k.titulo, evidencia });
      }
      const galeria = montarGaleria(entradas, { codigos: codigos.lista }, hoje);
      return { sku, galeria, aviso: "Galeria de candidatas (máx. 8): nenhuma está aprovada nem publicável. Marca d'água, resolução e licença ainda precisam ser conferidas por uma pessoa; marketplace dá pista, não direito de uso. Nada foi salvo." };
    }
    catch (err) { return erroDeBusca(err, "Falha na busca de imagens."); }
  },
  // Investigação técnica (especificação 02/11/2026): plano de consultas progressivas com orçamento, evidência estruturada e relatório confirmado/inferido/não encontrado/não testado.
  // Só LEITURA: não grava no Bling, no banco nem no fiscal. Sem provedor de busca devolve "nao_testada" (não inventa).
  "engenharia.pesquisa.investigar": async (e, c) => {
    const sku = typeof e.sku === "string" ? e.sku.trim() : "";
    if (!sku) return { erro: "Informe o SKU do produto." };
    const p = await c.dados.verProduto(sku) as Record<string, unknown>;
    if ("erro" in p) return p;
    const cod = await codigosConhecidosDoProduto(c, sku);
    if ("erro" in cod) return cod;
    const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    return investigar({
      produto: { sku, oem: cod.oem, codigo_fabricante: cod.fabricante[0] ?? null, gtin: texto(p.gtin, 20) || null, marca: texto(p.marca, 60) || null, descricao: texto(p.nome, 160),
        motor: texto(e.motor, 30) || null, veiculo: texto(e.veiculo, 40) || null, ano: Number.isInteger(e.ano) ? e.ano : null },
      codigos: cod.lista, hoje: new Date().toISOString().slice(0, 10), provedor: escolherProvedorBusca(c),
    });
  },
  "conecta.web.pesquisar_tecnico": async (e, c) => {
    const provedor = escolherProvedorBusca(c);
    if (!provedor) return SEM_PROVEDOR();
    try { return { resultados_candidatos: await provedor.tecnico(String(e.consulta ?? "").trim().slice(0, 200)), aviso: "Resumos não comprovam aplicação, OEM, GTIN ou medidas. Confirme na página do fabricante antes de propor alterações." }; }
    catch (err) { return erroDeBusca(err, "Falha na pesquisa técnica."); }
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
  // Produto NOVO: valida o rascunho (regras_cadastro), confere duplicidade no espelho e no Bling AGORA e cria a proposta. Não grava nada no Bling.
  "bling.produtos.preparar_cadastro": async (e, c) => {
    // Piloto: um cadastro novo por vez (taxonomia conferida depois de cada um).
    const abertos = await cadastrosNovosEmAberto(c);
    if (typeof abertos !== "number") return abertos;
    if (abertos >= PILOTO_CADASTRO_MAX_ABERTOS) return { aviso: `Piloto: já há ${abertos} cadastro(s) novo(s) aguardando decisão. Aprove ou rejeite antes de propor outro (limite do piloto: ${PILOTO_CADASTRO_MAX_ABERTOS} por vez; subir é decisão do dono). Nada foi proposto.` };
    let rascunho = e.rascunho, skuAutomatico = false;
    if (rascunho && typeof rascunho === "object" && !Array.isArray(rascunho) && !String((rascunho as Record<string, unknown>).codigo ?? "").trim()) {
      const s = await skuProposto(c); if ("erro" in s) return s;
      rascunho = { ...(rascunho as Record<string, unknown>), codigo: s.sku }; skuAutomatico = true;
    }
    const v = validarRascunho(rascunho, e.fontes, { lojaId: c.lojaId, porPessoa: c.agente?.provedor === "nenhum" });
    if (!v.ok) return { erro: "Rascunho recusado", detalhes: v.erros };
    const p = v.proposta;
    if (!c.bling) return { erro: "Sem acesso de leitura ao Bling; não confiro duplicidade, então nada foi proposto." };
    const conflitos: { id?: string; codigo: unknown; nome: unknown; por: string }[] = [];
    const local = await c.dados.produtoPorSku(p.codigo);
    if (local) conflitos.push({ id: local.id, codigo: p.codigo, nome: (local as any).nome ?? null, por: "codigo (espelho)" });
    for (const [por, args] of [["codigo", { sku: p.codigo }], ["gtin", p.depois.gtin ? { gtin: String(p.depois.gtin) } : null]] as const) {
      if (!args) continue;
      const r = await c.bling.ler("bling.produtos.consultar_ativos", args);
      if (r.status !== 200) return { erro: `Não consegui conferir duplicidade por ${por} no Bling (${r.status}); nada foi proposto.` };
      for (const x of ((r.corpo as any)?.data ?? []) as any[]) conflitos.push({ id: String(x.id), codigo: x.codigo ?? null, nome: x.nome ?? null, por: `${por} (Bling)` });
    }
    if (conflitos.length) return { aviso: "Já existe produto com o mesmo código ou GTIN; criar duplicaria o cadastro. Nada foi proposto. Use a atualização do produto existente ou vincule como origem do mesmo mestre.", conflitos };
    return criarPropostaVersionada(c, { titulo: `Cadastrar no Bling o produto novo ${p.codigo} (${String(p.depois.nome).slice(0, 80)})`,
      resumo: `Produto novo. Pendências para publicar: ${p.pendencias.join("; ")}.`, itens: [{
        sku: p.codigo, operacao: "bling.produtos.criar", campos: Object.keys(p.depois), depois: p.depois, antes: {}, fontes: e.fontes,
        validacoes: [`nenhum produto com o código ${p.codigo}${p.depois.gtin ? ` ou o GTIN ${p.depois.gtin}` : ""} no espelho nem no Bling em ${new Date().toISOString()}`, ...(skuAutomatico ? [`SKU ${p.codigo} proposto automaticamente (CI + 6 dígitos, depois do maior conhecido): a aprovação é sua`] : []), ...p.validacoes, ...p.pendencias.map((x) => `pendente: ${x}`)] }] });
  },
  // Preço de VENDA de produto ativo: o "atual" vem do ESPELHO, é conferido no Bling AGORA (se divergir, nada é proposto) e a proposta nasce pendente de
  // aprovação humana. Nunca custo, compra, margem, fornecedor nem fiscal (regras_preco.ts). Não grava nada no Bling; a execução real não é suportada.
  "bling.produtos.preparar_alteracao_preco": async (e, c) => {
    const sku = String(e.sku ?? "").trim();
    const esp = await c.dados.verProduto(sku) as Record<string, unknown>;
    if ("erro" in esp) return { erro: "Produto não encontrado no espelho desta loja. Só produto ATIVO e sincronizado tem preço proposto." };
    if (esp.situacao !== "A") return { erro: "O produto não está ativo no espelho; o preço só é proposto para produto ativo." };
    const local = await c.dados.produtoPorSku(sku);
    if (!local?.bling_id) return { erro: "O produto não tem o id do Bling no espelho; sincronize com o Bling antes de propor o preço." };
    const precoAtual = esp.preco == null || esp.preco === "" ? null : Number(esp.preco);
    const v = validarPropostaPreco({ sku, preco_novo: e.preco_novo, motivo: e.motivo }, { lojaId: c.lojaId, precoAtual });
    if (!v.ok) return { erro: v.erro };
    const p = v.proposta;
    if (!c.bling) return { erro: "Leitura do Bling indisponível: sem ela não confiro o preço atual, então nada foi proposto." };
    const lido = await c.bling.ler("bling.produtos.confirmar", { id: String(local.bling_id) });
    if (lido.status !== 200) return { erro: `O Bling respondeu ${lido.status} ao ler o produto; sem conferir o preço atual nada foi proposto.` };
    const vivo = Number((lido.corpo as any)?.data?.preco);
    if (!Number.isFinite(vivo) || vivo <= 0) return { erro: "O Bling não devolveu o preço atual do produto; nada foi proposto." };
    if (Math.round(vivo * 100) !== Math.round(p.preco_atual * 100)) return { aviso: `O preço no Bling (R$ ${vivo.toFixed(2)}) é diferente do que o espelho mostra (R$ ${p.preco_atual.toFixed(2)}): o espelho está desatualizado. Sincronize e peça de novo. Nada foi proposto.`, preco_no_bling: vivo, preco_no_espelho: p.preco_atual };
    const brl = (n: number) => n.toFixed(2).replace(".", ",");
    const agora = new Date().toISOString();
    return criarPropostaVersionada(c, { titulo: `Alterar o preço de venda de ${sku}: R$ ${brl(p.preco_atual)} → R$ ${brl(p.preco_novo)} (${p.percentual > 0 ? "+" : ""}${p.percentual}%)`,
      resumo: `Só o preço de venda. Diferença R$ ${brl(p.diferenca)}. Motivo: ${p.motivo}`, itens: [{
        produto_id: local.id, sku, operacao: "bling.produtos.alterar_preco", alvo: String(local.bling_id), campos: ["preco_venda"],
        antes: { preco_venda: p.preco_atual }, depois: { preco_venda: p.preco_novo },
        fontes: [{ documento: `Pedido de alteração de preço de venda feito pelo lojista (motivo informado: ${p.motivo})`, consultado_em: agora }],
        validacoes: [`preço atual R$ ${brl(p.preco_atual)} lido do espelho e conferido no Bling em ${agora}`, `diferença calculada pelo servidor: R$ ${brl(p.diferenca)} (${p.percentual}%)`, ...p.alertas, `chave de idempotência ${p.idempotency_key}`] }] });
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
    // A listagem do Bling é um RESUMO (sem marca, descrições, peso, medidas): o "antes" tem de vir da leitura completa pelo id,
    // senão a proposta mostra vazio onde há valor e o desfazer perde o texto original (caso CI001086: marca " MARCA: TRIM GO").
    const completo = await c.bling!.ler("bling.produtos.confirmar", { id: String(r.produto.id) });
    const atual = (completo.corpo as any)?.data;
    if (completo.status !== 200 || !atual || typeof atual !== "object") return { erro: `O Bling respondeu ${completo.status} ao ler o produto completo; sem o valor atual não há como registrar o "antes". Tente de novo.` };
    const antes = Object.fromEntries(campos.map((k) => {
      const mp = MAPA_CAMPOS.find((x) => x.conecta === k)!;
      const v = valorEm(atual, mp.caminho);
      return [k, v === undefined || v === "" || v === 0 ? null : (mp.tipo === "id_numerico" ? String(v) : v)];
    }));
    // Marca: nunca inventada. Exige evidência (URL externa, marca escrita no próprio cadastro/nota, ou documento descrito por uma PESSOA).
    const extras: string[] = [];
    if (campos.includes("marca")) {
      const vm = validarMarca(e.campos.marca, e.fontes, { textosDoCadastro: [r.produto.nome, (atual as any).nome, (atual as any).descricaoCurta, (atual as any).descricaoComplementar], porPessoa: c.agente?.provedor === "nenhum" });
      if (!vm.ok) return { erro: "Marca recusada", detalhes: [vm.erro] };
      const cf = conflitoDeMarca(antes.marca as string | null, vm.marca);
      if (cf.conflito) {
        // PR #242 (teste de aceite 4): marca diferente da que já está no Bling. O MODELO só propõe a troca com prova VERIFICADA (URL externa); com prova fraca
        // (marca só "declarada" no próprio cadastro/nota) bloqueia e mostra a evidência. Uma PESSOA (formulário) pode sempre. Toda troca fica registrada na proposta.
        const pessoa = c.agente?.provedor === "nenhum";
        if (!pessoa && vm.evidencia !== "url_externa") return { erro: "Marca conflitante com o cadastro do Bling", detalhes: [`O Bling tem "${cf.atual}" e a proposta é "${cf.proposta}", e a evidência é fraca (${vm.evidencia}). O agente não troca marca já cadastrada sem URL de fonte externa: peça pelo formulário do Catálogo, com a fonte.`],
          evidencia: { marca_atual_no_bling: cf.atual, marca_proposta: cf.proposta, tipo_da_evidencia: vm.evidencia, verificada: vm.verificada, fontes: e.fontes } };
        extras.push(`TROCA DE MARCA: de "${cf.atual}" para "${cf.proposta}" (conflita com o cadastro do Bling; evidência ${vm.evidencia}${pessoa ? "; pedido de uma pessoa" : ""})`);
      }
      e.campos.marca = vm.marca;
      extras.push(`marca: evidência ${vm.evidencia}${vm.verificada ? "" : " (não verificada)"}${vm.aviso ? ` — ${vm.aviso}` : ""}`);
    }
    const local = await c.dados.produtoPorSku(e.sku);
    return criarPropostaVersionada(c, { titulo: `Atualizar ${campos.join(", ")} de ${e.sku} no Bling`, itens: [{
      produto_id: local?.id, sku: e.sku, operacao: "bling.produtos.alterar", alvo: String(r.produto.id), campos, antes, depois: e.campos, fontes: e.fontes,
      validacoes: [`produto lido no Bling em ${new Date().toISOString()}`, "corpo montado e validado contra a lista de campos permitidos", ...extras] }] });
  },
};
