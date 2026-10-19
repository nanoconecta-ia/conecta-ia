// Indicadores do dashboard operacional. Vêm de rpc('dashboard_operacional'); valor null = "não medido" (nunca vira zero).
export interface Indicador { chave: string; titulo: string; ajuda: string; valor: number | null; filtro: string; observacao?: string }

const DEF: [string, string, string][] = [
  ["produtos_sincronizados", "Produtos sincronizados", "Espelho do Bling, sem os ausentes."],
  ["produtos_incompletos", "Produtos incompletos", "Faltando SKU, preço, descrição curta, marca, GTIN ou peso."],
  ["produtos_bloqueados", "Produtos bloqueados", "Travados: o agente só pode sugerir."],
  ["produtos_enriquecidos", "Produtos enriquecidos", "Com ao menos um dado aprovado com fonte."],
  ["categorias_aprovadas", "Categorias aprovadas", "Categorias do Bling ligadas a um nó de taxonomia aprovado."],
  ["prontos_publicacao", "Prontos para publicação", "Ativos, completos e com imagem principal aprovada."],
  ["imagens_pendentes", "Imagens pendentes", "Aguardando sua decisão."],
  ["erros_sincronizacao_24h", "Erros de sincronização (24 h)", "Registrados nas últimas 24 horas."],
  ["ferramentas_em_execucao", "Ferramentas em execução", "Operações enviadas e ainda sem confirmação."],
  ["aprovacoes_pendentes", "Aprovações pendentes", "Propostas aguardando decisão e dentro do prazo."],
  ["divergencias", "Divergências Bling/Conecta.IA", "Produtos em erro ou divergência após execução."],
  ["qualidade_seo", "Qualidade SEO", "Ainda não medida nesta fase."],
];

export function normalizar(bruto: unknown): { indicadores: Indicador[]; custo: { provedor: string; modelo: string; tokens: number; custo_estimado: number | null }[] } | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, { valor?: unknown; filtro?: unknown; observacao?: unknown } | undefined>;
  const indicadores = DEF.map(([chave, titulo, ajuda]) => {
    const x = o[chave];
    const valor = typeof x?.valor === "number" ? x.valor : null;   // qualquer coisa que não seja número é "não medido"
    return { chave, titulo, ajuda, valor, filtro: typeof x?.filtro === "string" ? x.filtro : chave, observacao: typeof x?.observacao === "string" ? x.observacao : undefined };
  });
  const c = (o as unknown as { custo_por_agente_mes?: unknown }).custo_por_agente_mes;
  const custo = Array.isArray(c) ? c.filter((l): l is { provedor: string; modelo: string; tokens: number; custo_estimado: number | null } => !!l && typeof l === "object").map((l) => ({
    provedor: String(l.provedor ?? "n/d"), modelo: String(l.modelo ?? "n/d"), tokens: Number(l.tokens ?? 0), custo_estimado: l.custo_estimado == null ? null : Number(l.custo_estimado) })) : [];
  return { indicadores, custo };
}

export const formatarValor = (v: number | null) => (v === null ? "não medido" : v.toLocaleString("pt-BR"));

const FILTROS_VALIDOS = /^[a-z_]+(:[a-z_]+)?$/;
/** Rota da lista que o cartão abre. Filtro inválido nunca vira rota. */
export function rotaDoFiltro(filtro: string): string | null {
  if (!FILTROS_VALIDOS.test(filtro)) return null;
  if (filtro === "aprovacoes") return "/central?estado=pendente";
  return `/indicadores/${filtro}`;
}
export const TITULO_FILTRO: Record<string, string> = Object.fromEntries(DEF.map(([k, t]) => [k, t]));
