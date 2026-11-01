// Validador DETERMINÍSTICO de aplicação veicular (qual peça serve em qual veículo). Função pura: sem rede, sem banco, sem relógio (a data de hoje entra no contexto).
// Existe porque regra no prompt orienta o Nano mas não o impede: aqui a trava é código, chamada no ponto em que o agente propõe e antes de aprovar/publicar.
//
// O que isto PROVA: a proposta traz a VERSÃO do veículo (marca, modelo, motor, faixa de anos de um tipo explícito), uma fonte com localizador e data,
// e a base da afirmação não é só "o motor é o mesmo" nem "a peça parece parecida"; o código citado como conferido é um dos códigos do produto;
// o agente nunca aprova nem publica; hipótese fraca nunca vira confirmada.
// O que isto NÃO PROVA: que a fonte diz o que a proposta afirma, que o veículo existe, nem a compatibilidade física. A pessoa que aprova confere a fonte.

export type Acao = "propor" | "aprovar" | "publicar";
export type Ator = "agente" | "usuario";
export type BaseAplicacao = "versao_do_veiculo" | "somente_motor" | "somente_modelo" | "referencia_cruzada_similar";
export type TipoAno = "importacao_brasil" | "comercializacao_brasil" | "ano_modelo_crlv" | "fabricacao" | "lancamento_mundial";
export type TipoFonte = "catalogo_fabricante" | "manual_montadora" | "cruzamento_codigo_oem" | "catalogo_distribuidor" | "nota_fiscal" | "anuncio_marketplace" | "outra";
export type MarcaTipo = "montadora" | "reposicao" | "fabricante_motor" | "desconhecido";

export interface Fonte { tipo: TipoFonte; url?: string | null; documento?: string | null; data: string; codigo_conferido?: string | null }
export interface VeiculoVersao {
  marca: string; modelo: string; motor: string; ano_inicial: number | null; ano_final: number | null; em_producao?: boolean;
  tipo_ano: TipoAno | null; versao?: string | null; regime?: "importado" | "ckd" | "skd" | "nacional" | null;
}
export interface ProdutoTecnico { loja_id: string; sku: string; oem: string[]; fabricante: string[]; marca_tipo?: MarcaTipo }
export interface PropostaAplicacao { loja_id: string; sku: string; veiculo: VeiculoVersao; base: BaseAplicacao; fontes: Fonte[]; declara_genuina?: boolean }
export interface Contexto { acao: Acao; ator: Ator; hoje: string }

export interface Bloqueio { codigo: string; mensagem: string }
export type Nivel = "bloqueada" | "hipotese" | "confirmavel";
export interface Resultado { ok: boolean; bloqueios: Bloqueio[]; avisos: string[]; nivel: Nivel }

/** Fontes que podem sustentar uma aplicação CONFIRMADA. Anúncio, nota fiscal e distribuidor localizam candidatas, não confirmam. */
export const FONTES_FORTES: readonly TipoFonte[] = ["catalogo_fabricante", "manual_montadora", "cruzamento_codigo_oem"];

const codigo = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const temLocalizador = (f: Fonte) => /^https:\/\/\S+$/i.test(f.url ?? "") || (f.documento ?? "").trim().length >= 3;
const anoOk = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1950 && n <= 2100;
/** Mais de um veículo (ou motor) numa só aplicação: cada veículo é uma aplicação própria. */
const MISTURA = /[\/;,+]|\s(e|ou|and)\s|\sa\s\d{4}\s/i;

export function codigosDoProduto(p: Pick<ProdutoTecnico, "oem" | "fabricante">): Set<string> {
  return new Set([...p.oem, ...p.fabricante].map(codigo).filter(Boolean));
}
/** Uma fonte sustenta uma aplicação confirmada? Tipo forte, localizador, data válida e (no cruzamento) código que bate com o produto. */
export function fonteForte(f: Fonte, p: ProdutoTecnico, hoje: string): boolean {
  if (!FONTES_FORTES.includes(f.tipo) || !temLocalizador(f) || !dataValida(f.data) || f.data > hoje) return false;
  if (f.tipo === "cruzamento_codigo_oem") return !!f.codigo_conferido && codigosDoProduto(p).has(codigo(f.codigo_conferido));
  return true;
}

export function validarAplicacao(prop: PropostaAplicacao, produto: ProdutoTecnico, ctx: Contexto): Resultado {
  const b: Bloqueio[] = []; const a: string[] = [];
  const no = (c: string, m: string) => b.push({ codigo: c, mensagem: m });
  const v = prop.veiculo, anoHoje = Number(ctx.hoje.slice(0, 4));

  // ── Isolamento e papéis
  if (prop.loja_id !== produto.loja_id) no("loja_diferente", "O produto pertence a outra loja.");
  if (prop.sku !== produto.sku) no("sku_diferente", `A aplicação é do SKU ${prop.sku}, mas o produto lido é ${produto.sku}.`);
  if (ctx.ator === "agente" && ctx.acao !== "propor") no("agente_nao_aprova", "O agente só propõe aplicações: aprovar e publicar são de uma pessoa.");

  // ── Versão do veículo (compartilhar o motor ou o modelo não basta)
  const faltam = (["marca", "modelo", "motor"] as const).filter((k) => !(v?.[k] ?? "").trim());
  if (faltam.length) no("versao_incompleta", `Faltam dados da versão do veículo: ${faltam.join(", ")}.`);
  for (const k of ["modelo", "motor", "marca"] as const) if (MISTURA.test(v?.[k] ?? "")) { no("veiculos_misturados", "Há mais de um veículo ou motor numa só aplicação: cada veículo é uma aplicação própria."); break; }
  if (!anoOk(v?.ano_inicial)) no("ano_inicial_invalido", "Informe o ano inicial (entre 1950 e 2100).");
  if (v?.ano_final == null) { if (!v?.em_producao) no("ano_final_ausente", "Informe o ano final ou marque que o veículo ainda está em produção."); }
  else if (!anoOk(v.ano_final)) no("ano_final_invalido", "Ano final inválido (entre 1950 e 2100).");
  else if (anoOk(v.ano_inicial) && v.ano_final < v.ano_inicial) no("anos_invertidos", "O ano final não pode ser antes do ano inicial.");
  if (anoOk(v?.ano_inicial) && v.ano_inicial > anoHoje + 1) no("ano_futuro", "O ano inicial está no futuro.");
  if (anoOk(v?.ano_final) && v.ano_final > anoHoje + 1) no("ano_futuro", "O ano final está no futuro.");
  if (!v?.tipo_ano) no("tipo_ano_ausente", "Diga o que o ano significa: importação ou comercialização no Brasil, ano-modelo do CRLV ou fabricação.");
  else if (v.tipo_ano === "lancamento_mundial") no("ano_lancamento_mundial_nao_vale", "O ano de lançamento mundial não vale: o relevante é a importação ou comercialização no Brasil.");
  if (!v?.regime) a.push("Regime de montagem (importado, CKD, SKD ou nacional) não informado: a versão brasileira pode diferir da original.");

  // ── Base da afirmação
  if (prop.base === "somente_motor") no("motor_nao_prova_aplicacao", "Compartilhar o código de motor não prova que a peça serve: o mesmo motor aparece em veículos e gerações diferentes.");
  else if (prop.base === "somente_modelo") no("modelo_sem_versao", "Só o modelo não basta: indique a versão (motor e faixa de anos).");
  else if (prop.base === "referencia_cruzada_similar") {
    if (ctx.acao === "propor") a.push("Referência cruzada ou similar não prova equivalência: fica como hipótese.");
    else no("similar_nao_prova_equivalencia", "Referência cruzada ou similar não prova equivalência: não pode ser aprovada nem publicada.");
  }

  // ── Fontes: localizador e data; código "conferido" tem de ser do produto
  const fontes = prop.fontes ?? [];
  const validas = fontes.filter((f) => temLocalizador(f) && dataValida(f.data) && f.data <= ctx.hoje);
  if (fontes.length === 0 || validas.length === 0) {
    if (fontes.some((f) => dataValida(f.data) && f.data > ctx.hoje)) no("data_da_fonte_invalida", "A data da fonte está no futuro.");
    else no("fonte_ausente", "Informe a fonte (URL https ou documento) e a data em que foi consultada. Sem fonte, não há aplicação.");
  }
  const codigos = codigosDoProduto(produto);
  for (const f of fontes) {
    if (f.tipo !== "cruzamento_codigo_oem") continue;
    if (!f.codigo_conferido) no("codigo_nao_informado", "Cruzamento por código exige o código que foi conferido.");
    else if (codigos.size === 0) no("produto_sem_codigo_tecnico", "O produto não tem código OEM nem do fabricante cadastrado: não há com o que cruzar.");
    else if (!codigos.has(codigo(f.codigo_conferido))) no("codigo_diverge", `O código ${f.codigo_conferido} não é um dos códigos do produto: o cruzamento não vale.`);
  }
  const forte = validas.some((f) => fonteForte(f, produto, ctx.hoje));
  if (!forte && validas.length > 0) {
    if (ctx.acao === "propor") a.push("Só há fonte fraca (anúncio, nota fiscal ou distribuidor): a aplicação fica como hipótese, não como confirmada.");
    else no("sem_fonte_forte", "Aprovar ou publicar exige catálogo do fabricante, manual da montadora ou cruzamento de código conferido.");
  }

  // ── Genuína x reposição
  if (prop.declara_genuina && produto.marca_tipo === "reposicao") no("reposicao_nao_e_genuina", "A peça é de marca de reposição: não pode ser apresentada como genuína da montadora.");
  if (produto.marca_tipo === "reposicao" && fontes.some((f) => f.tipo === "manual_montadora")) a.push("O manual da montadora cita o veículo, não a peça de reposição: confirme a equivalência no catálogo do fabricante da peça.");

  const nivel: Nivel = b.length > 0 ? "bloqueada" : forte && prop.base === "versao_do_veiculo" ? "confirmavel" : "hipotese";
  return { ok: b.length === 0, bloqueios: b, avisos: a, nivel };
}

// ── Intercambiabilidade: equivalência entre códigos
export type RelacaoCodigo = "equivalente" | "similar" | "substituto" | "supersessao";
export interface ClaimIntercambiavel { loja_id: string; sku: string; de: string; para: string; relacao: RelacaoCodigo; fontes: Fonte[]; medidas_conferidas?: boolean }
/** Só "equivalente" ou "supersessão" com fonte forte, código conferido e medidas conferidas pode ser dado como intercambiável. Similar e substituto nunca. */
export function validarIntercambiabilidade(c: ClaimIntercambiavel, produto: ProdutoTecnico, ctx: Contexto): Resultado {
  const b: Bloqueio[] = []; const a: string[] = []; const no = (k: string, m: string) => b.push({ codigo: k, mensagem: m });
  if (c.loja_id !== produto.loja_id) no("loja_diferente", "O produto pertence a outra loja.");
  if (c.sku !== produto.sku) no("sku_diferente", "A equivalência é de outro SKU.");
  if (ctx.ator === "agente" && ctx.acao !== "propor") no("agente_nao_aprova", "O agente só propõe: aprovar e publicar são de uma pessoa.");
  if (!c.de.trim() || !c.para.trim()) no("codigos_ausentes", "Informe os dois códigos.");
  else if (codigo(c.de) === codigo(c.para)) no("codigos_iguais", "Os dois códigos são o mesmo.");
  const validas = (c.fontes ?? []).filter((f) => temLocalizador(f) && dataValida(f.data) && f.data <= ctx.hoje);
  if (validas.length === 0) no("fonte_ausente", "Informe a fonte (URL https ou documento) e a data.");
  const forte = validas.some((f) => fonteForte(f, produto, ctx.hoje));
  if (c.relacao === "similar" || c.relacao === "substituto") {
    if (ctx.acao === "propor") a.push(`Relação "${c.relacao}" é só hipótese: não prova equivalência nem autoriza trocar uma peça pela outra.`);
    else no("similar_nao_prova_equivalencia", `Relação "${c.relacao}" não pode ser aprovada como intercambiável.`);
  } else if (ctx.acao !== "propor") {
    if (!forte) no("sem_fonte_forte", "Equivalência confirmada exige catálogo do fabricante, manual ou cruzamento de código conferido.");
    if (!c.medidas_conferidas) no("medidas_nao_conferidas", "Equivalência confirmada exige as medidas conferidas (mm, espessura, diâmetro, número de dentes).");
  }
  const confirmavel = b.length === 0 && (c.relacao === "equivalente" || c.relacao === "supersessao") && forte && !!c.medidas_conferidas;
  return { ok: b.length === 0, bloqueios: b, avisos: a, nivel: b.length ? "bloqueada" : confirmavel ? "confirmavel" : "hipotese" };
}
