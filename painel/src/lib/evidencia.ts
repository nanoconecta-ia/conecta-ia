// Apresentação da evidência de busca de produto: mostra TODOS os candidatos com a origem real de cada um e deixa claro o que NÃO foi comprovado.
export type SituacaoProduto = "ativo" | "inativo" | "excluido" | "ausente_do_espelho" | "desconhecida";
export interface CandidatoEv { id: string; sku: string | null; nome: string | null; situacao: SituacaoProduto; preco: number | null; estoque: number | null; achado_por: string[]; origem: "api_bling" | "espelho"; no_espelho: boolean; sincronizado_em: string | null }
export interface FonteEv { origem: "api_bling" | "espelho"; consulta: string; consultada: boolean; completa: boolean; total: number; paginas: number; motivo: string | null }
export interface ConclusaoEv { escopo?: { filtros_executados: string[]; campos_cobertos: string[]; campos_nao_cobertos: string[] }; ausencia_nos_filtros_pesquisados: boolean; api_completa: boolean; apenas_espelho: boolean; autoriza_criacao: false; aviso: string }

const SITUACAO: Record<SituacaoProduto, string> = { ativo: "Ativo", inativo: "Inativo", excluido: "Excluído", ausente_do_espelho: "Ausente do espelho", desconhecida: "Situação desconhecida" };
const ACHADO: Record<string, string> = { sku_exato: "SKU exato", referencia_no_nome: "referência no nome/código", gtin: "GTIN" };
const MOTIVO: Record<string, string> = { reconectar_bling: "Bling precisa ser reconectado", limite_bling: "limite de chamadas do Bling", tempo_esgotado: "tempo esgotado", api_indisponivel_ou_resposta_invalida: "API indisponível ou resposta inválida", paginas_limite_atingido: "mais páginas do que o limite lido", espelho_indisponivel: "espelho indisponível" };
export const rotuloSituacao = (s: SituacaoProduto) => SITUACAO[s] ?? SITUACAO.desconhecida;
export const rotuloAchado = (a: string) => ACHADO[a] ?? a;
export const rotuloMotivo = (m: string | null) => (m ? MOTIVO[m] ?? m : null);

export function linhaFonte(f: FonteEv): string {
  const quem = f.origem === "api_bling" ? `API do Bling (${rotuloAchado(f.consulta)})` : "Espelho do Conecta (só produtos ativos sincronizados)";
  if (!f.consultada) return `${quem}: NÃO consultada${f.motivo ? ` — ${rotuloMotivo(f.motivo)}` : ""}`;
  const parcial = f.completa ? "" : " — leitura INCOMPLETA" + (f.motivo ? ` (${rotuloMotivo(f.motivo)})` : "");
  return `${quem}: ${f.total} resultado(s) em ${f.paginas || 1} página(s)${parcial}`;
}
export function linhaCandidato(c: CandidatoEv): string {
  const preco = c.preco == null ? "preço não informado" : `R$ ${c.preco.toFixed(2)}`;
  return `${c.nome ?? "sem nome"} · SKU ${c.sku ?? "sem SKU"} · ID ${c.id} · ${preco} · estoque ${c.estoque ?? "não informado"}`;
}
export function selosCandidato(c: CandidatoEv): string[] {
  return [rotuloSituacao(c.situacao), c.origem === "api_bling" ? "dado da API do Bling" : "dado do espelho", c.no_espelho ? "está no espelho" : "fora do espelho", ...c.achado_por.map((a) => `achado por: ${rotuloAchado(a)}`)];
}
/** Texto fixo sobre o que a busca prova. Nunca diz "não existe" sem a conclusão do servidor. */
export function resumoConclusao(c: ConclusaoEv): string {
  const ausencia = c.ausencia_nos_filtros_pesquisados ? "Zero resultados nos filtros pesquisados (API, inclui excluídos). Não é prova universal de ausência no ERP." : "Ausência no ERP: NÃO comprovada.";
  return `${ausencia} Criação de cadastro autorizada por esta busca: não.`;
}
