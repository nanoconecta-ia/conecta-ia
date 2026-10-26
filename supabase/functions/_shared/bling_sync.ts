// Espelho SOMENTE LEITURA do catálogo do Bling (varredura periódica). Nunca escreve no Bling.
// Custo, fornecedor e preço de compra NUNCA são copiados. Lógica pura sobre portas: testável sem Supabase nem rede.
// Caminhos/params da API v3 ainda "conferido: false" (documentação oficial inacessível): conferir antes de confiar em produção.

export interface ItemLista { id: number; nome?: string; codigo?: string; preco?: number; situacao?: string; formato?: string; idProdutoPai?: number; estoque?: { saldoVirtualTotal?: number } }
// deno-lint-ignore no-explicit-any
export type Detalhe = any;

export interface LinhaProduto {
  loja_id: string; bling_id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null;
  situacao: string | null; categoria_bling_id: string | null; marca: string | null; gtin: string | null; gtin_tributario: string | null;
  descricao_curta: string | null; descricao_complementar: string | null; peso_kg: number | null; largura_cm: number | null;
  altura_cm: number | null; profundidade_cm: number | null; unidade: string | null; condicao: string | null; formato: string | null;
  pai_bling_id: string | null; volumes: number | null; sincronizado_em: string;
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const pos = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null); // 0 = "não informado": nunca vira dado

/** Mapeia o produto do Bling para a linha do espelho. Só campos permitidos; nada de custo/fornecedor. */
export function mapearProduto(lojaId: string, lista: ItemLista, d: Detalhe | null, agoraISO: string): LinhaProduto {
  const x = d ?? {};
  return {
    loja_id: lojaId, bling_id: String(lista.id),
    sku: txt(x.codigo ?? lista.codigo), nome: txt(x.nome ?? lista.nome),
    preco: typeof (x.preco ?? lista.preco) === "number" ? (x.preco ?? lista.preco) : null,
    estoque: typeof (x.estoque?.saldoVirtualTotal ?? lista.estoque?.saldoVirtualTotal) === "number" ? (x.estoque?.saldoVirtualTotal ?? lista.estoque?.saldoVirtualTotal) : null,
    situacao: txt(x.situacao ?? lista.situacao),
    categoria_bling_id: x.categoria?.id ? String(x.categoria.id) : null,
    marca: txt(x.marca), gtin: txt(x.gtin), gtin_tributario: txt(x.gtinEmbalagem),
    descricao_curta: txt(x.descricaoCurta), descricao_complementar: txt(x.descricaoComplementar),
    peso_kg: pos(x.pesoBruto) ?? pos(x.pesoLiquido), largura_cm: pos(x.dimensoes?.largura), altura_cm: pos(x.dimensoes?.altura),
    profundidade_cm: pos(x.dimensoes?.profundidade), unidade: txt(x.unidade), condicao: x.condicao != null ? String(x.condicao) : null,
    formato: txt(x.formato ?? lista.formato), pai_bling_id: lista.idProdutoPai ? String(lista.idProdutoPai) : null,
    volumes: pos(x.volumes), sincronizado_em: agoraISO,
  };
}

export interface Existente { bling_id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null; situacao: string | null; sincronizado_em: string | null }

/** Precisa buscar o detalhe? Novo, mudou algo da lista, ou o último detalhe tem mais de `maxIdadeMs`. */
export function precisaDetalhe(l: ItemLista, e: Existente | undefined, agora: number, maxIdadeMs = 24 * 3600_000): boolean {
  if (!e) return true;
  const num = (v: unknown) => (v == null ? null : Number(v));
  if ((l.nome ?? null) !== (e.nome ?? null) || (l.codigo || null) !== (e.sku ?? null) || (l.situacao ?? null) !== (e.situacao ?? null)) return true;
  if (num(l.preco) !== num(e.preco) || num(l.estoque?.saldoVirtualTotal) !== num(e.estoque)) return true;
  return !e.sincronizado_em || agora - Date.parse(e.sincronizado_em) > maxIdadeMs;
}

export type GrupoLista = "ativos" | "inativos";
export interface PortasSync {
  /** `grupo`: produtos ATIVOS ou INATIVOS do Bling (excluídos nunca entram no espelho). */
  listarPagina(pagina: number, limite: number, grupo?: GrupoLista): Promise<{ itens: ItemLista[] } | { erro: string }>;
  detalhe(id: number): Promise<Detalhe | null>;
  existentes(): Promise<Existente[]>;
  gravar(linhas: LinhaProduto[]): Promise<void>;
  marcarAusentes(blingIds: string[]): Promise<void>; // só chamado com a listagem COMPLETA
  registrarErro(mensagem: string, detalhe?: Record<string, unknown>): Promise<void>;
  espera(ms: number): Promise<void>;
  agora(): number;
}
export interface ResultadoSync { paginas: number; vistos: number; gravados: number; detalhes: number; ausentes: number; completo: boolean; erro?: string }

const LIMITE = 100, INTERVALO_MS = 350; // ~3 req/s por conta

export async function sincronizar(lojaId: string, p: PortasSync, orcamentoMs = 100_000): Promise<ResultadoSync> {
  const ini = p.agora();
  const r: ResultadoSync = { paginas: 0, vistos: 0, gravados: 0, detalhes: 0, ausentes: 0, completo: false };
  const ex = new Map((await p.existentes()).map((e) => [e.bling_id, e]));
  const vistos = new Set<string>();
  let lote: LinhaProduto[] = [];
  const descarregar = async () => { if (lote.length) { await p.gravar(lote); r.gravados += lote.length; lote = []; } };

  for (const grupo of ["ativos", "inativos"] as GrupoLista[]) {
    for (let pagina = 1; ; pagina++) {
      if (p.agora() - ini > orcamentoMs) { await descarregar(); return r; } // sem timeout: retoma na próxima rodada
      const pg = await p.listarPagina(pagina, LIMITE, grupo);
      await p.espera(INTERVALO_MS);
      if ("erro" in pg) { await descarregar(); r.erro = pg.erro; await p.registrarErro(pg.erro, { pagina, grupo }); return r; }
      r.paginas++;
      for (const it of pg.itens) {
        vistos.add(String(it.id)); r.vistos++;
        let d: Detalhe | null = null;
        if (precisaDetalhe(it, ex.get(String(it.id)), p.agora())) {
          if (p.agora() - ini > orcamentoMs) continue; // fica para a próxima rodada (não grava meia-linha)
          d = await p.detalhe(it.id); r.detalhes++;
          await p.espera(INTERVALO_MS);
          if (!d) { await p.registrarErro("detalhe indisponível", { bling_id: it.id }); continue; }
        } else continue; // sem mudança: não regrava
        lote.push(mapearProduto(lojaId, it, d, new Date(p.agora()).toISOString()));
        if (lote.length >= 50) await descarregar();
      }
      if (pg.itens.length < LIMITE) break;
    }
  }
  await descarregar();
  // Listagem completa (ativos + inativos): o que sumiu das duas listas deixa de ser publicável.
  const ausentes = [...ex.keys()].filter((id) => !vistos.has(id) && ex.get(id)!.situacao !== "ausente");
  if (ausentes.length) { await p.marcarAusentes(ausentes); r.ausentes = ausentes.length; }
  r.completo = true;
  return r;
}
