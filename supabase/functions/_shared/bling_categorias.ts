// Espelho SOMENTE LEITURA da árvore de categorias de produto do Bling. Nunca escreve no Bling.
// Lógica pura sobre portas (testável sem Supabase nem rede). Substitui o conjunto inteiro quando a listagem vem COMPLETA.

export interface CategoriaBling { id: number | string; descricao?: string; categoriaPai?: { id?: number | string } }
export interface LinhaCategoria { loja_id: string; bling_id: string; nome: string; pai_bling_id: string | null; sincronizado_em: string }

export interface PortasCategorias {
  listarPagina(pagina: number, limite: number): Promise<{ itens: CategoriaBling[] } | { erro: string }>;
  existentes(): Promise<string[]>; // bling_id já guardados
  gravar(linhas: LinhaCategoria[]): Promise<void>;
  remover(blingIds: string[]): Promise<void>; // só chamado com a listagem COMPLETA
  registrarErro(mensagem: string, detalhe?: Record<string, unknown>): Promise<void>;
  espera(ms: number): Promise<void>;
  agora(): number;
}
export interface ResultadoCategorias { paginas: number; vistas: number; gravadas: number; removidas: number; completo: boolean; erro?: string }

const LIMITE = 100, INTERVALO_MS = 350, MAX_PAGINAS = 20;
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 200) : null);

/** Pai "0" ou ausente = categoria raiz. */
export function mapearCategoria(lojaId: string, c: CategoriaBling, agoraISO: string): LinhaCategoria | null {
  const nome = txt(c.descricao);
  if (c.id == null || String(c.id).trim() === "" || !nome) return null;
  const pai = c.categoriaPai?.id;
  return { loja_id: lojaId, bling_id: String(c.id), nome, pai_bling_id: pai == null || String(pai) === "0" || String(pai) === String(c.id) ? null : String(pai), sincronizado_em: agoraISO };
}

export async function sincronizarCategorias(lojaId: string, p: PortasCategorias): Promise<ResultadoCategorias> {
  const r: ResultadoCategorias = { paginas: 0, vistas: 0, gravadas: 0, removidas: 0, completo: false };
  const vistas = new Map<string, LinhaCategoria>();
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const pg = await p.listarPagina(pagina, LIMITE);
    await p.espera(INTERVALO_MS);
    if ("erro" in pg) { r.erro = pg.erro; await p.registrarErro(pg.erro, { pagina, recurso: "categorias" }); return r; }
    r.paginas++;
    for (const c of pg.itens) { const l = mapearCategoria(lojaId, c, new Date(p.agora()).toISOString()); if (l) vistas.set(l.bling_id, l); }
    if (pg.itens.length < LIMITE) { r.completo = true; break; }
  }
  r.vistas = vistas.size;
  if (!r.completo) { r.erro = "listagem de categorias incompleta"; await p.registrarErro(r.erro, { recurso: "categorias" }); return r; }
  if (vistas.size === 0) return r; // lista vazia: nunca apaga o espelho por causa de uma resposta vazia
  const linhas = [...vistas.values()];
  await p.gravar(linhas); r.gravadas = linhas.length;
  const sobras = (await p.existentes()).filter((id) => !vistas.has(id));
  if (sobras.length) { await p.remover(sobras); r.removidas = sobras.length; }
  return r;
}
