// Contratos das ferramentas do Gênesis (Tool Registry do agente). Fonte única do que cada ferramenta pode ler/gravar,
// com que risco e se exige aprovação. NÃO executa nada: só descreve e é conferido por teste contra o código real
// (ia/ferramentas.ts e bling_ferramentas.ts). "planejada" = ainda não existe; não conta como funcionalidade pronta.
import { FERRAMENTAS as FERRAMENTAS_BLING, type Risco } from "../bling_ferramentas.ts";

export type Escopo = "admin" | "publico";
export type Operacao = "leitura" | "proposta" | "escrita_erp" | "externa";
export type Estado = "implementada" | "planejada";

export interface Contrato {
  nome: string;
  escopo: Escopo;
  operacao: Operacao;
  risco: Risco;
  estado: Estado;
  descricao: string;
  /** Tabelas lidas (com o filtro que torna a leitura segura). */
  le: string[];
  /** Tabelas/RPCs gravadas. Proposta sempre grava `a_confirmar`; nada aprova sozinho. */
  grava: string[];
  /** Campos de entrada obrigatórios (ex.: fonte). */
  obrigatorios: string[];
  aprovacaoHumana: boolean;
  idempotencyKey: boolean;
  /** Ferramenta do catálogo fechado do Bling usada por trás (bling_ferramentas.ts), quando houver. */
  ferramentaBling?: string;
  /** Fase da Ordem Mestra em que passa a existir (apenas planejadas). */
  fase?: 1 | 2 | 3 | 4 | 5;
}

const L = (nome: string, descricao: string, le: string[], extra: Partial<Contrato> = {}): Contrato => ({
  nome, escopo: "admin", operacao: "leitura", risco: "LOW", estado: "implementada", descricao, le, grava: [],
  obrigatorios: [], aprovacaoHumana: false, idempotencyKey: false, ...extra,
});
const P = (nome: string, descricao: string, grava: string[], obrigatorios: string[]): Contrato => ({
  nome, escopo: "admin", operacao: "proposta", risco: "LOW", estado: "implementada", descricao, le: ["produtos"], grava,
  obrigatorios, aprovacaoHumana: true, // a proposta só vira dado depois que o lojista aprova na Fila
  idempotencyKey: false,
});

export const CONTRATOS: readonly Contrato[] = [
  // ---- Agente administrativo (JWT do lojista; leitura pela RLS do usuário) — IMPLEMENTADAS ----
  L("resumo_loja", "Totais da loja.", ["produtos (loja)", "produto_enriquecimento (a_confirmar)"]),
  L("listar_produtos", "Lista produtos da loja (nome, SKU, preço, estoque, publicado).", ["produtos (loja)"]),
  L("ver_produto", "Detalhe de um produto e o que falta para publicar.", ["produtos (loja)", "produto_enriquecimento (aprovado)"], { obrigatorios: ["sku"] }),
  L("itens_pendentes", "Enriquecimentos aguardando aprovação.", ["produto_enriquecimento (a_confirmar)"]),
  L("buscar_taxonomia", "Busca nós da taxonomia.", ["taxonomia_nos"], { obrigatorios: ["texto"] }),
  L("status_bling", "Estado da conexão e da última sincronização (não consulta o Bling).", ["bling_conexoes (status, ultimo_sync_ok_em, ultimo_erro)"]),
  L("listar_plugins", "Plugins ativos da loja.", ["loja_plugins"]),
  L("chamar_plugin", "Chama plugin tipo api, ativo, capacidade declarada, risco LOW. Retorno é dado a conferir.", ["loja_plugins"], { operacao: "externa", obrigatorios: ["plugin", "capacidade"] }),
  P("propor_enriquecimento", "Propõe valor de campo de enriquecimento.", ["rpc enriquecimento_propor → produto_enriquecimento"], ["sku", "campo", "valor", "fonte"]),
  P("propor_codigo", "Propõe código de referência (nunca sku).", ["rpc codigo_propor → produto_codigos"], ["sku", "tipo", "valor", "fonte"]),
  P("propor_aplicacao", "Propõe aplicação veicular.", ["rpc aplicacao_propor → produto_aplicacoes"], ["sku", "modelo", "fonte"]),
  L("buscar_imagem_web", "Busca imagens candidatas (não grava).", [], { operacao: "externa", obrigatorios: ["consulta"] }),
  P("propor_imagem", "Propõe imagem https; nasce aprovada=false.", ["rpc imagem_propor → produto_imagens"], ["sku", "url"]),

  // ---- Agente público (vitrine). Hoje determinístico por palavras-chave (vitrine-assistente), sem LLM ----
  { nome: "publico.consultar_produto_publicado", escopo: "publico", operacao: "leitura", risco: "LOW", estado: "implementada",
    descricao: "Preço, estoque, marca, códigos e aplicações APROVADOS de produto publicado de loja ativa; sem confirmação, leva ao WhatsApp.",
    le: ["produtos (publicado, loja ativa)", "produto_enriquecimento (aprovado)", "produto_codigos (aprovado)", "produto_aplicacoes (aprovado)"],
    grava: [], obrigatorios: ["slug", "sku"], aprovacaoHumana: false, idempotencyKey: false },
  { nome: "publico.encaminhar_whatsapp", escopo: "publico", operacao: "leitura", risco: "LOW", estado: "implementada",
    descricao: "Monta link wa.me com nome e SKU do produto (não envia nada).", le: ["lojas (whatsapp)"], grava: [],
    obrigatorios: ["slug", "sku"], aprovacaoHumana: false, idempotencyKey: false },

  // ---- Planejadas (Ordem Mestra). Não existem no código; não declarar pronto ----
  { nome: "bling_consultar_produto", escopo: "admin", operacao: "leitura", risco: "LOW", estado: "planejada", fase: 1,
    descricao: "Consulta AO VIVO um produto no Bling (prova operacional da Fase 1), via Policy Engine e auditoria.",
    le: ["bling (ao vivo)"], grava: ["auditoria"], obrigatorios: ["sku ou id"], aprovacaoHumana: false, idempotencyKey: false,
    ferramentaBling: "bling.produtos.obter" },
  { nome: "bling_listar_produtos", escopo: "admin", operacao: "leitura", risco: "LOW", estado: "planejada", fase: 1,
    descricao: "Lista produtos do Bling ao vivo com paginação e limite de taxa.", le: ["bling (ao vivo)"], grava: ["auditoria"],
    obrigatorios: [], aprovacaoHumana: false, idempotencyKey: false, ferramentaBling: "bling.produtos.listar" },
  { nome: "calcular_qualidade_cadastro", escopo: "admin", operacao: "leitura", risco: "LOW", estado: "planejada", fase: 2,
    descricao: "Índice de qualidade do cadastro e comparação antes/depois.", le: ["produtos", "produto_enriquecimento"], grava: [],
    obrigatorios: ["sku"], aprovacaoHumana: false, idempotencyKey: false },
  { nome: "gerar_seo_produto", escopo: "admin", operacao: "proposta", risco: "LOW", estado: "planejada", fase: 3,
    descricao: "Propõe título/descrição/metadados SEO só com fatos aprovados.", le: ["produtos", "produto_enriquecimento (aprovado)"],
    grava: ["seo_propostas (a criar)"], obrigatorios: ["sku"], aprovacaoHumana: true, idempotencyKey: false },
  { nome: "gerar_feed_merchant", escopo: "admin", operacao: "proposta", risco: "MEDIUM", estado: "planejada", fase: 4,
    descricao: "Prepara feed do Google Merchant Center; envio é conector separado e aprovado.", le: ["produtos publicados"],
    grava: ["feeds (a criar)"], obrigatorios: [], aprovacaoHumana: true, idempotencyKey: true },
  { nome: "propor_campanha", escopo: "admin", operacao: "proposta", risco: "HIGH", estado: "planejada", fase: 4,
    descricao: "Propõe campanha/anúncios/orçamento. Publicar ou alterar orçamento exige autorização específica.", le: ["produtos publicados"],
    grava: ["campanhas_propostas (a criar)"], obrigatorios: ["objetivo"], aprovacaoHumana: true, idempotencyKey: true },
  { nome: "bling_alterar_produto_campo_autorizado", escopo: "admin", operacao: "escrita_erp", risco: "MEDIUM", estado: "planejada", fase: 2,
    descricao: "Grava no Bling SÓ campo autorizado da matriz, com aprovação, idempotency_key e leitura de confirmação.",
    le: ["bling (ao vivo)"], grava: ["bling (campo autorizado)", "auditoria"], obrigatorios: ["sku", "campo", "valor", "aprovacao_id", "idempotency_key"],
    aprovacaoHumana: true, idempotencyKey: true, ferramentaBling: "bling.produtos.alterar" },
];

/** Tabelas que o agente PÚBLICO nunca pode ler (custos, segredos, dados internos, outras áreas administrativas). */
export const PROIBIDAS_AO_PUBLICO = [
  "bling_conexoes", "bling_credenciais", "loja_chaves_ia", "loja_mcp_chaves", "loja_plugins", "auditoria", "usuarios_loja",
  "produto_fiscal", "fiscal_log", "sync_erros", "sync_eventos", "enriquecimento_tarefas", "restricoes_loja", "restricoes_plataforma_uf",
];

export const contratoDe = (nome: string): Contrato | undefined => CONTRATOS.find((c) => c.nome === nome);

/** Valida a coerência interna de um contrato; devolve a lista de violações (vazia = ok). Usado pelo teste e por futuros registros. */
export function validarContrato(c: Contrato): string[] {
  const v: string[] = [];
  if (c.operacao === "proposta" && !c.obrigatorios.includes("fonte") && c.nome.startsWith("propor_") && c.nome !== "propor_imagem" && c.nome !== "propor_campanha")
    v.push(`${c.nome}: proposta sem "fonte" obrigatória`);
  if (c.operacao === "proposta" && !c.aprovacaoHumana) v.push(`${c.nome}: proposta precisa de aprovação humana`);
  if (c.operacao === "escrita_erp") {
    if (!c.aprovacaoHumana || !c.idempotencyKey) v.push(`${c.nome}: escrita no ERP exige aprovação e idempotency_key`);
    if (c.risco === "LOW") v.push(`${c.nome}: escrita no ERP não pode ser LOW`);
    if (c.estado === "implementada") v.push(`${c.nome}: escrita no ERP não pode estar implementada sem teste, mock e autorização`);
  }
  if ((c.risco === "HIGH" || c.risco === "CRITICAL") && !c.aprovacaoHumana) v.push(`${c.nome}: risco ${c.risco} exige aprovação`);
  if (c.escopo === "publico") {
    if (c.risco !== "LOW") v.push(`${c.nome}: ferramenta pública deve ser LOW`);
    if (c.operacao === "escrita_erp" || c.operacao === "proposta") v.push(`${c.nome}: agente público não escreve nem propõe`);
    for (const t of c.le) if (PROIBIDAS_AO_PUBLICO.some((p) => t.startsWith(p))) v.push(`${c.nome}: lê tabela proibida ao público (${t})`);
  }
  if (c.estado === "planejada" && c.fase === undefined) v.push(`${c.nome}: planejada sem fase`);
  if (c.ferramentaBling) {
    const fb = FERRAMENTAS_BLING.find((f) => f.nome === c.ferramentaBling);
    if (!fb) v.push(`${c.nome}: ferramenta Bling inexistente (${c.ferramentaBling})`);
    else if (c.operacao === "escrita_erp" && fb.ativa) v.push(`${c.nome}: ferramenta Bling de escrita está ativa`);
  }
  return v;
}
