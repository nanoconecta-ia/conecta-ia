// Ferramentas de ESCRITA do agente: tudo entra como "a_confirmar", com fonte e data; nada é aprovado sozinho.
// Usam o cliente de service_role (passado pelo chamador) porque gravam fora do que a RLS do usuário permite.
// Cada RPC confere, no banco, que o produto pertence à loja (defesa em profundidade além da checagem aqui).
export const CAMPOS_ENRIQUECIMENTO = [
  "marca_peca", "descricao_curta", "descricao_longa", "peso_kg", "dimensoes", "categoria_sugerida", "ncm_sugerido",
  // Loja virtual / site ligado ao Bling (issue #166): busca, SEO. Especificações técnicas vão como "espec:<campo>" (ver abaixo).
  "tags", "seo_titulo", "seo_descricao",
] as const;
/** Especificação técnica / campo customizado do ERP: "espec:" + nome do campo normalizado (a-z, 0-9, _), ex.: espec:diametro_externo_mm. */
export const CAMPO_ESPEC = /^espec:[a-z0-9_]{2,30}$/;
const CAMPOS_TEXTO_SEO = new Set(["seo_titulo", "seo_descricao", "descricao_curta", "descricao_longa", "tags"]);
export const campoEnriquecimentoValido = (c: string) => (CAMPOS_ENRIQUECIMENTO as readonly string[]).includes(c) || CAMPO_ESPEC.test(c);
/** Limites por campo (o que vai para o site precisa caber nos campos do ERP/loja). null = ok; texto = motivo da recusa. */
export function problemaNoValor(campo: string, valor: unknown): string | null {
  const t = typeof valor === "string" ? valor.trim() : typeof valor === "number" ? String(valor) : "";
  if (campo === "tags") { const tags = t.split(",").map((x) => x.trim()).filter(Boolean); return !tags.length ? "Informe ao menos uma tag." : tags.length > 20 ? "No máximo 20 tags." : tags.some((x) => x.length > 40) ? "Cada tag deve ter até 40 caracteres." : null; }
  if (campo === "seo_titulo") return t.length < 10 || t.length > 70 ? "Título SEO deve ter de 10 a 70 caracteres." : null;
  if (campo === "seo_descricao") return t.length < 50 || t.length > 160 ? "Descrição SEO deve ter de 50 a 160 caracteres." : null;
  if (CAMPO_ESPEC.test(campo)) return !t || t.length > 200 ? "Especificação deve ter de 1 a 200 caracteres." : null;
  return null;
}
export const TIPOS_CODIGO = ["oem", "fabricante", "ean", "similar", "substituto", "antigo"] as const; // "sku" é do Bling, o agente não propõe

import { validarAplicacao, type BaseAplicacao, type Fonte, type PropostaAplicacao, type TipoAno, type TipoFonte } from "../aplicacoes/regras_aplicacao.ts";
import { validarTextoSeo } from "../aplicacoes/regras_seo.ts";

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
  if (!campoEnriquecimentoValido(campo)) return { erro: `Campo não reconhecido. Use um de: ${CAMPOS_ENRIQUECIMENTO.join(", ")} ou espec:<campo> para especificação técnica.` };
  if (!fonte) return { erro: "Informe a fonte (URL ou documento) de onde veio o dado. Sem fonte, não posso propor." };
  if (e.valor == null || e.valor === "") return { erro: "Informe o valor proposto." };
  const problema = problemaNoValor(campo, e.valor);
  if (problema) return { erro: problema };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  if (CAMPOS_TEXTO_SEO.has(campo)) {
    // Texto que vai ao site só pode citar aplicações e códigos já APROVADOS deste produto; "original/genuína/homologada" nunca, sem prova.
    const apps = await listar(admin.from("produto_aplicacoes").select("modelo, motorizacao, ano_inicial, ano_final").eq("produto_id", produtoId).eq("status", "aprovado"));
    const cods = await listar(admin.from("produto_codigos").select("valor").eq("produto_id", produtoId).eq("status", "aprovado"));
    const r = validarTextoSeo(String(e.valor), {
      sku, codigosAprovados: cods.map((c) => String(c?.valor ?? "")).filter(Boolean),
      aplicacoesAprovadas: apps.map((a) => ({ marca: "", modelo: String(a?.modelo ?? ""), motor: a?.motorizacao ?? null, ano_inicial: a?.ano_inicial ?? null, ano_final: a?.ano_final ?? null })),
    });
    if (!r.ok) return { erro: `Texto recusado: ${r.bloqueios.map((b) => b.mensagem).join(" ")}`, bloqueios: r.bloqueios };
  }
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

export const TIPOS_FONTE: readonly TipoFonte[] = ["catalogo_fabricante", "manual_montadora", "cruzamento_codigo_oem", "catalogo_distribuidor", "nota_fiscal", "anuncio_marketplace", "outra"];
export const BASES: readonly BaseAplicacao[] = ["versao_do_veiculo", "somente_motor", "somente_modelo", "referencia_cruzada_similar"];
export const TIPOS_ANO: readonly TipoAno[] = ["importacao_brasil", "comercializacao_brasil", "ano_modelo_crlv", "fabricacao", "lancamento_mundial"];
export const REGIMES = ["importado", "ckd", "skd", "nacional"] as const;
const hojeIso = () => new Date().toISOString().slice(0, 10);
const noLista = <T extends string>(lista: readonly T[], v: unknown): T | null => (typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as T) : null);
/** Leitura tolerante: se a consulta falhar, devolve lista vazia (o lado seguro: nada aprovado, nada para cruzar). */
// deno-lint-ignore no-explicit-any
async function listar(consulta: any): Promise<any[]> { try { const r = await consulta; return Array.isArray(r?.data) ? r.data : []; } catch { return []; } }

/** Aplicação veicular: o agente precisa trazer a VERSÃO do veículo, um tipo de ano, a base da afirmação e uma fonte com localizador e data.
 *  A trava é o validador (aplicacoes/regras_aplicacao.ts), não o prompt. O agente só propõe: entra a_confirmar, com confiança limitada. */
export async function proporAplicacao(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80);
  if (!sku) return { erro: "Informe o SKU." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  const codigos = await listar(admin.from("produto_codigos").select("tipo, valor").eq("produto_id", produtoId).eq("status", "aprovado"));
  const valores = (t: string) => codigos.filter((c) => c?.tipo === t && typeof c.valor === "string").map((c) => c.valor as string);
  const fonte: Fonte = {
    tipo: noLista(TIPOS_FONTE, e.fonte_tipo) ?? "outra", url: txt(e.fonte_url, 600) || null, documento: txt(e.fonte_documento ?? e.fonte, 400) || null,
    data: txt(e.fonte_data, 10), codigo_conferido: txt(e.codigo_conferido, 80) || null,
  };
  const ini = Number.isInteger(e.ano_inicial) ? e.ano_inicial as number : null, fim = Number.isInteger(e.ano_final) ? e.ano_final as number : null;
  const proposta: PropostaAplicacao = {
    loja_id: lojaId, sku, base: noLista(BASES, e.base) ?? "somente_modelo", fontes: [fonte], declara_genuina: e.declara_genuina === true,
    veiculo: { marca: txt(e.marca_veiculo, 60), modelo: txt(e.modelo, 80), motor: txt(e.motorizacao, 60), ano_inicial: ini, ano_final: fim, em_producao: e.em_producao === true,
      tipo_ano: noLista(TIPOS_ANO, e.tipo_ano), regime: noLista(REGIMES, e.regime), versao: txt(e.versao, 80) || null },
  };
  const r = validarAplicacao(proposta, { loja_id: lojaId, sku, oem: valores("oem"), fabricante: valores("fabricante"), marca_tipo: "desconhecido" }, { acao: "propor", ator: "agente", hoje: hojeIso() });
  if (!r.ok) return { erro: `Aplicação recusada: ${r.bloqueios.map((b) => b.mensagem).join(" ")}`, bloqueios: r.bloqueios };
  const v = proposta.veiculo;
  const resumoFonte = [fonte.tipo, fonte.url ?? fonte.documento, fonte.data, `ano=${v.tipo_ano}`, `marca=${v.marca}`, v.regime ? `regime=${v.regime}` : null, fonte.codigo_conferido ? `codigo=${fonte.codigo_conferido}` : null, `base=${proposta.base}`].filter(Boolean).join(" | ").slice(0, 400);
  const limite = r.nivel === "confirmavel" ? 0.7 : 0.4; // quem aprova é a pessoa: a confiança do agente nunca passa disso
  const pedida = conf(e.confianca);
  const { error } = await admin.rpc("aplicacao_propor", { p_loja: lojaId, p_produto: produtoId, p_modelo: v.modelo, p_motorizacao: v.motor, p_ano_inicial: ini, p_ano_final: fim, p_fonte: resumoFonte, p_confianca: pedida == null ? limite : Math.min(pedida, limite) });
  if (error) return { erro: "Não foi possível registrar a aplicação." };
  return { ok: true, status: "a_confirmar", nivel: r.nivel, avisos: r.avisos };
}

export async function proporImagem(admin: AdminRpc, lojaId: string, e: Record<string, unknown>): Promise<unknown> {
  const sku = txt(e.sku, 80), url = txt(e.url, 600), origem = txt(e.origem, 200), pagina = txt(e.pagina, 600);
  if (!sku || !url) return { erro: "Informe o SKU e o endereço da imagem." };
  if (!/^https:\/\//i.test(url)) return { erro: "A imagem precisa ser um endereço https." };
  const produtoId = await idDoSku(admin, lojaId, sku);
  if (!produtoId) return { erro: "Produto não encontrado nesta loja." };
  // cruzamento = o próprio SKU buscado (sinal disponível numa busca por texto; a Fila avisa que os direitos ainda não foram confirmados)
  const { error } = await admin.rpc("imagem_propor", { p_loja: lojaId, p_produto: produtoId, p_url: url, p_origem: origem || "busca_web", p_sku: sku, p_pagina: pagina || null });
  if (error) return { erro: "Não foi possível propor a imagem." };
  return { ok: true, status: "a_confirmar", aviso: "A imagem entrou pendente de aprovação na Fila; direitos de uso ainda não confirmados." };
}
