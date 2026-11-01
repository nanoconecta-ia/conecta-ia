// Validador DETERMINÍSTICO de taxonomia: em que nó da árvore uma peça pode ser classificada. Função pura.
// Peça na categoria errada leva ao cliente à peça errada; por isso o nó precisa existir, ser da mesma árvore (perfil de ramo), estar HOMOLOGADO por uma pessoa
// (ele e todos os ancestrais) e a classificação precisa ter um fundamento que não seja "o nome parece". O agente só PROPÕE: não cria, não aprova, não publica.
//
// O que isto PROVA: o nó existe, é da árvore certa, está aprovado (com os ancestrais), o fundamento não é só semelhança de nome, o agente não aprova.
// O que isto NÃO PROVA: que a peça realmente pertence àquele nó (isso é julgamento técnico de quem aprova, com a ponte do Bling ou o documento técnico).

export type StatusNo = "proposto" | "aprovado";
export interface NoTaxonomia { id: string; pai_id: string | null; nome: string; slug: string; perfil_ramo: string; status: StatusNo }
export type Fundamento = "ponte_bling_homologada" | "documento_tecnico" | "regra_homologada" | "semelhanca_do_nome" | "nenhum";
export type AcaoTaxonomia = "propor" | "aprovar" | "publicar" | "criar_no" | "aprovar_no";
export type Ator = "agente" | "usuario";
export interface PropostaTaxonomia { loja_id: string; sku: string; produto: { loja_id: string; sku: string; perfil_ramo: string }; no_id: string | null; fundamento: Fundamento }
export interface Contexto { acao: AcaoTaxonomia; ator: Ator }
export interface Bloqueio { codigo: string; mensagem: string }
export interface Resultado { ok: boolean; bloqueios: Bloqueio[]; avisos: string[]; caminho: string[] }

const PROFUNDIDADE_MAX = 12;

/** Caminho da raiz até o nó, com proteção contra ciclo e pai inexistente. `completo` = chegou numa raiz. */
export function caminhoDoNo(id: string, arvore: readonly NoTaxonomia[]): { nos: NoTaxonomia[]; completo: boolean } {
  const por = new Map(arvore.map((n) => [n.id, n]));
  const nos: NoTaxonomia[] = []; const vistos = new Set<string>();
  let atual = por.get(id);
  while (atual && nos.length < PROFUNDIDADE_MAX && !vistos.has(atual.id)) {
    vistos.add(atual.id); nos.unshift(atual);
    if (atual.pai_id == null) return { nos, completo: true };
    atual = por.get(atual.pai_id);
  }
  return { nos, completo: false };
}

export function validarTaxonomia(p: PropostaTaxonomia, arvore: readonly NoTaxonomia[], ctx: Contexto): Resultado {
  const b: Bloqueio[] = []; const a: string[] = []; const no = (c: string, m: string) => b.push({ codigo: c, mensagem: m });
  const final = ctx.acao === "aprovar" || ctx.acao === "publicar";

  if (p.loja_id !== p.produto.loja_id) no("loja_diferente", "O produto pertence a outra loja.");
  if (p.sku !== p.produto.sku) no("sku_diferente", "A classificação é de outro SKU.");
  if (ctx.ator === "agente" && ctx.acao !== "propor") no("agente_nao_aprova", "O agente só propõe classificação: criar nó, aprovar nó, aprovar e publicar são de uma pessoa.");

  const alvo = p.no_id ? arvore.find((n) => n.id === p.no_id) : undefined;
  if (!alvo) { no("no_inexistente", "O nó de taxonomia não existe. O agente não cria nós: use um nó existente ou peça à pessoa para criar."); return { ok: false, bloqueios: b, avisos: a, caminho: [] }; }
  if (alvo.perfil_ramo !== p.produto.perfil_ramo) no("perfil_diferente", `O nó é da árvore "${alvo.perfil_ramo}", mas o produto é do ramo "${p.produto.perfil_ramo}".`);

  const { nos, completo } = caminhoDoNo(alvo.id, arvore);
  if (!completo) no("caminho_quebrado", "O caminho do nó até a raiz está incompleto ou em ciclo.");
  if (nos.some((n) => n.perfil_ramo !== alvo.perfil_ramo)) no("arvore_misturada", "O caminho mistura árvores de ramos diferentes.");

  const naoAprovados = nos.filter((n) => n.status !== "aprovado");
  if (naoAprovados.length) {
    const lista = naoAprovados.map((n) => n.nome).join(" > ");
    if (final) no(alvo.status !== "aprovado" ? "no_nao_homologado" : "ancestral_nao_homologado", `Só nós homologados por uma pessoa valem: ainda não aprovado(s): ${lista}.`);
    else a.push(`Nó ainda não homologado (${lista}): a classificação fica como hipótese até a pessoa aprovar o nó.`);
  }
  if (arvore.some((n) => n.pai_id === alvo.id)) a.push("O nó tem subnós: prefira o nó mais específico (folha) que descreve a peça.");

  if (p.fundamento === "nenhum") no("fundamento_ausente", "Diga por que a peça vai neste nó: ponte do Bling homologada, documento técnico ou regra homologada.");
  else if (p.fundamento === "semelhanca_do_nome") {
    if (final) no("fundamento_insuficiente", "Semelhança do nome não basta para aprovar ou publicar a classificação.");
    else a.push("Semelhança do nome é só hipótese: confirme com a ponte do Bling, um documento técnico ou uma regra homologada.");
  }
  return { ok: b.length === 0, bloqueios: b, avisos: a, caminho: nos.map((n) => n.nome) };
}
