// Organização do menu em grupos (torre de controle). Puro e testável: o App só renderiza o que sai daqui.
// A visibilidade (flags, conector, pair) continua vindo de montarMenu; aqui só se agrupa e se filtra.

export type Item = [rota: string, titulo: string];
export type GrupoMenu = { id: string; titulo: string; itens: Item[] };

const GRUPOS: { id: string; titulo: string; rotas: string[] }[] = [
  { id: "comando", titulo: "Comando", rotas: ["/", "/conector", "/central", "/indicadores"] },
  { id: "catalogo", titulo: "Catálogo", rotas: ["/catalogo", "/studio", "/taxonomia", "/fila", "/imagens"] },
  { id: "agentes", titulo: "Agentes", rotas: ["/estudio", "/assistente", "/meu-agente", "/aprovacoes", "/dispositivos", "/gateway", "/integracoes"] },
  { id: "loja", titulo: "Loja", rotas: ["/aparencia", "/banners", "/condicoes", "/design"] },
  { id: "erp", titulo: "ERP e fiscal", rotas: ["/bling", "/backup", "/contador"] },
];

/** Agrupa os itens visíveis. Rota que não está em nenhum grupo cai em "Outros" (nada some do menu por esquecimento). */
export function agruparMenu(itens: Item[]): GrupoMenu[] {
  const porRota = new Map(itens.map((i) => [i[0], i] as const));
  const usadas = new Set<string>();
  const saida: GrupoMenu[] = [];
  for (const g of GRUPOS) {
    const lista = g.rotas.flatMap((r) => { const i = porRota.get(r); if (!i) return []; usadas.add(r); return [i]; });
    if (lista.length) saida.push({ id: g.id, titulo: g.titulo, itens: lista });
  }
  const resto = itens.filter((i) => !usadas.has(i[0]));
  if (resto.length) saida.push({ id: "outros", titulo: "Outros", itens: resto });
  return saida;
}

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca da paleta de comandos: sem acento, sem maiúsculas; começa-com vence contém; mantém a ordem do menu no empate. */
export function filtrarComandos(itens: Item[], consulta: string): Item[] {
  const q = sem(consulta.trim());
  if (!q) return itens;
  const pontuar = (i: Item) => { const t = sem(i[1]); if (t.startsWith(q)) return 0; if (t.split(/\s+/).some((p) => p.startsWith(q))) return 1; if (t.includes(q) || sem(i[0]).includes(q)) return 2; return -1; };
  return itens.map((i, ordem) => ({ i, ordem, p: pontuar(i) })).filter((x) => x.p >= 0).sort((a, b) => a.p - b.p || a.ordem - b.ordem).map((x) => x.i);
}
