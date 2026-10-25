// Conferência entre a taxonomia do Conecta e as categorias do Bling, nos dois sentidos. Só calcula e mostra: NÃO grava no Bling.
// Criar categoria no Bling passa pela proposta do agente e pela sua aprovação (ferramenta de escrita desligada até autorização).
export type NoTax = { id: string; pai_id: string | null; nome: string; slug: string };
export type CategoriaBling = { bling_id: string; nome: string; pai_bling_id: string | null };
export type Ligacao = { bling_categoria_id: string; taxonomia_no_id: string };

export interface ParLigado { no: NoTax; categoria: CategoriaBling }
export interface FaltaNoBling { no: NoTax; paiNome: string | null; /** pai do Bling já existente; null = categoria de topo OU pai ainda a criar */ paiBlingId: string | null; /** o pai também falta: criar o pai antes */ dependeDoPai: boolean }
export interface SugestaoLigacao { no: NoTax; categoria: CategoriaBling }
export interface Divergencia { no: NoTax; categoria: CategoriaBling; motivo: string }
export interface Conferencia {
  ligados: ParLigado[]; faltamNoBling: FaltaNoBling[]; sugestoes: SugestaoLigacao[];
  blingSemNo: CategoriaBling[]; divergencias: Divergencia[]; ligacoesQuebradas: Ligacao[];
}

/** Compara sem acento, caixa e espaços repetidos ("Bombas d'água" = "bombas d’agua"). */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’'`´]/g, "'").replace(/\s+/g, " ").trim();
}

export function conferir(nos: NoTax[], categorias: CategoriaBling[], ligacoes: Ligacao[]): Conferencia {
  const noPorId = new Map(nos.map((n) => [n.id, n]));
  const catPorId = new Map(categorias.map((c) => [c.bling_id, c]));
  const blingDoNo = new Map<string, string>(); // no.id -> bling_id
  const ligados: ParLigado[] = []; const ligacoesQuebradas: Ligacao[] = [];
  for (const l of ligacoes) {
    const no = noPorId.get(l.taxonomia_no_id); const cat = catPorId.get(l.bling_categoria_id);
    if (!no || !cat) { ligacoesQuebradas.push(l); continue; }
    if (!blingDoNo.has(no.id)) blingDoNo.set(no.id, cat.bling_id);
    ligados.push({ no, categoria: cat });
  }
  const catLigadas = new Set(ligados.map((p) => p.categoria.bling_id));

  const divergencias: Divergencia[] = [];
  for (const { no, categoria } of ligados) {
    const esperado = no.pai_id ? blingDoNo.get(no.pai_id) ?? null : null; // categoria do Bling que deveria ser a mãe
    const real = categoria.pai_bling_id && categoria.pai_bling_id !== "0" ? categoria.pai_bling_id : null;
    if (no.pai_id && esperado && real !== esperado) divergencias.push({ no, categoria, motivo: "A categoria mãe no Bling não é a que a taxonomia indica." });
    else if (!no.pai_id && real) divergencias.push({ no, categoria, motivo: "É área de topo na taxonomia, mas tem categoria mãe no Bling." });
  }

  const semLigacao = nos.filter((n) => !blingDoNo.has(n.id));
  const semNo = categorias.filter((c) => !catLigadas.has(c.bling_id));
  // sugestão de ligação: mesmo nome (normalizado) e mesma mãe quando as duas mães já estão ligadas; nada é ligado sozinho
  const sugestoes: SugestaoLigacao[] = []; const usadas = new Set<string>();
  for (const no of semLigacao) {
    const paiBling = no.pai_id ? blingDoNo.get(no.pai_id) ?? null : null;
    const achada = semNo.find((c) => !usadas.has(c.bling_id) && normalizar(c.nome) === normalizar(no.nome)
      && (!no.pai_id || !paiBling || (c.pai_bling_id ?? null) === paiBling));
    if (achada) { sugestoes.push({ no, categoria: achada }); usadas.add(achada.bling_id); }
  }
  const comSugestao = new Set(sugestoes.map((s) => s.no.id));

  // o que criar no Bling: pais antes dos filhos
  const prof = (n: NoTax): number => { let d = 0; let p = n.pai_id; const vistos = new Set<string>(); while (p && noPorId.has(p) && !vistos.has(p)) { vistos.add(p); d++; p = noPorId.get(p)!.pai_id; } return d; };
  const faltamNoBling: FaltaNoBling[] = semLigacao.filter((n) => !comSugestao.has(n.id)).sort((a, b) => prof(a) - prof(b) || a.nome.localeCompare(b.nome, "pt-BR")).map((no) => {
    const pai = no.pai_id ? noPorId.get(no.pai_id) ?? null : null;
    const paiLigado = pai ? blingDoNo.get(pai.id) ?? sugestoes.find((s) => s.no.id === pai.id)?.categoria.bling_id ?? null : null;
    return { no, paiNome: pai?.nome ?? null, paiBlingId: paiLigado, dependeDoPai: !!pai && !paiLigado };
  });
  const blingSemNo = semNo.filter((c) => !usadas.has(c.bling_id));
  return { ligados, faltamNoBling, sugestoes, blingSemNo, divergencias, ligacoesQuebradas };
}
