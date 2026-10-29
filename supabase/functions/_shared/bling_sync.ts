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

/** Preserva campos antigos quando o Bling permite LISTAR um excluído, mas não consultar seu detalhe. */
export interface Existente extends Omit<Partial<LinhaProduto>, "sincronizado_em"> {
  bling_id: string; sku: string | null; nome: string | null; preco: number | null; estoque: number | null;
  situacao: string | null; sincronizado_em: string | null;
}

/** Precisa buscar o detalhe? Novo, mudou algo da lista, ou o último detalhe tem mais de `maxIdadeMs`. */
export function precisaDetalhe(l: ItemLista, e: Existente | undefined, agora: number, maxIdadeMs = 24 * 3600_000): boolean {
  if (!e) return true;
  const num = (v: unknown) => (v == null ? null : Number(v));
  if ((l.nome ?? null) !== (e.nome ?? null) || (l.codigo || null) !== (e.sku ?? null) || (l.situacao ?? null) !== (e.situacao ?? null)) return true;
  if (num(l.preco) !== num(e.preco) || num(l.estoque?.saldoVirtualTotal) !== num(e.estoque)) return true;
  return !e.sincronizado_em || agora - Date.parse(e.sincronizado_em) > maxIdadeMs;
}

export type GrupoLista = "ativos" | "inativos" | "excluidos";
export interface PortasSync {
  /** `grupo`: produtos ativos, inativos ou excluídos (critério 2, 3 e 4 da API v3). */
  listarPagina(pagina: number, limite: number, grupo?: GrupoLista): Promise<{ itens: ItemLista[] } | { erro: string }>;
  detalhe(id: number): Promise<Detalhe | null>;
  existentes(): Promise<Existente[]>;
  gravar(linhas: LinhaProduto[]): Promise<void>;
  marcarAusentes(blingIds: string[]): Promise<void>; // só chamado com a listagem COMPLETA
  registrarErro(mensagem: string, detalhe?: Record<string, unknown>): Promise<void>;
  espera(ms: number): Promise<void>;
  agora(): number;
}
export interface ResultadoSync { paginas: number; vistos: number; gravados: number; detalhes: number; resumosExcluidos: number; ausentes: number; completo: boolean; erro?: string }

const LIMITE = 100, INTERVALO_MS = 350; // ~3 req/s por conta

/** Fallback controlado para excluído sem GET /produtos/{id} (pode devolver 404).
 * Preserva metadados previamente espelhados, atualiza apenas valores conhecidos e força situacao E.
 * Custo, fornecedor e campos fiscais nunca são lidos, mapeados ou guardados.
 */
export function resumirExcluido(lojaId: string, item: ItemLista, anterior: Existente | undefined, agoraISO: string): LinhaProduto {
  const base = mapearProduto(lojaId, { ...item, situacao: "E" }, null, agoraISO);
  return {
    ...base,
    ...anterior,
    loja_id: lojaId,
    bling_id: String(item.id),
    sku: txt(item.codigo) ?? anterior?.sku ?? null,
    nome: txt(item.nome) ?? anterior?.nome ?? null,
    preco: typeof item.preco === "number" ? item.preco : anterior?.preco ?? null,
    estoque: typeof item.estoque?.saldoVirtualTotal === "number" ? item.estoque.saldoVirtualTotal : anterior?.estoque ?? null,
    situacao: "E",
    sincronizado_em: agoraISO,
  };
}

export async function sincronizar(lojaId: string, p: PortasSync, orcamentoMs = 100_000): Promise<ResultadoSync> {
  const ini = p.agora();
  const r: ResultadoSync = { paginas: 0, vistos: 0, gravados: 0, detalhes: 0, resumosExcluidos: 0, ausentes: 0, completo: false };
  const ex = new Map((await p.existentes()).map((e) => [e.bling_id, e]));
  const skuDono = new Map<string, string>();
  for (const e of ex.values()) if (e.sku) skuDono.set(e.sku, e.bling_id);
  const vistos = new Set<string>();
  let lote: LinhaProduto[] = [];
  let falhasDetalhe = 0;
  let falhasSku = 0;
  const descarregar = async () => {
    if (lote.length) { await p.gravar(lote); r.gravados += lote.length; lote = []; }
  };
  // Não incluir uma linha com SKU já pertencente a outro ID do Bling.
  // Uma colisão é pendência humana, nunca motivo para sobrescrever o cadastro anterior.
  const incluir = async (linha: LinhaProduto) => {
    if (linha.sku && skuDono.has(linha.sku) && skuDono.get(linha.sku) !== linha.bling_id) {
      falhasSku++;
      await p.registrarErro("SKU repetido entre IDs do Bling", { bling_id: linha.bling_id, sku: linha.sku });
      return;
    }
    if (linha.sku) skuDono.set(linha.sku, linha.bling_id);
    lote.push(linha);
    if (lote.length >= 50) await descarregar();
  };

  for (const grupo of ["ativos", "inativos", "excluidos"] as GrupoLista[]) {
    for (let pagina = 1; ; pagina++) {
      if (p.agora() - ini > orcamentoMs) {
        await descarregar();
        r.erro = "tempo esgotado antes de concluir a varredura";
        return r;
      }
      const pg = await p.listarPagina(pagina, LIMITE, grupo);
      await p.espera(INTERVALO_MS);
      if ("erro" in pg) {
        await descarregar(); r.erro = pg.erro;
        await p.registrarErro(pg.erro, { pagina, grupo });
        return r;
      }
      r.paginas++;
      for (const it of pg.itens) {
        if (!Number.isSafeInteger(it.id) || it.id <= 0) {
          await descarregar();
          r.erro = "ID inválido na listagem do Bling";
          await p.registrarErro(r.erro, { pagina, grupo });
          return r; // resposta inconsistente: NÃO marcar ausentes
        }
        const id = String(it.id);
        if (vistos.has(id)) {
          await descarregar();
          r.erro = "ID repetido na listagem do Bling";
          await p.registrarErro(r.erro, { pagina, grupo, bling_id: id });
          return r; // paginação instável: NÃO marcar ausentes
        }
        vistos.add(id);
        r.vistos++;
        const anterior = ex.get(id);
        const listado = grupo === "excluidos" ? { ...it, situacao: "E" } : it;
        if (!precisaDetalhe(listado, anterior, p.agora())) continue;
        if (p.agora() - ini > orcamentoMs) {
          await descarregar(); r.erro = "tempo esgotado durante a leitura dos detalhes";
          return r;
        }
        const d = await p.detalhe(it.id);
        r.detalhes++;
        await p.espera(INTERVALO_MS);
        if (!d) {
          if (grupo === "excluidos") {
            await incluir(resumirExcluido(lojaId, listado, anterior, new Date(p.agora()).toISOString()));
            r.resumosExcluidos++;
            continue;
          }
          falhasDetalhe++;
          await p.registrarErro("detalhe indisponível", { bling_id: it.id, grupo });
          continue;
        }
        const linha = mapearProduto(lojaId, listado, d, new Date(p.agora()).toISOString());
        if (grupo === "excluidos") linha.situacao = "E";
        await incluir(linha);
      }
      if (pg.itens.length < LIMITE) break;
    }
  }
  await descarregar();
  if (falhasDetalhe || falhasSku) {
    r.erro = `varredura parcial: ${falhasDetalhe} detalhes indisponíveis, ${falhasSku} conflitos de SKU`;
    return r; // nenhum registro é marcado "ausente" com pendências
  }
  if (vistos.size === 0 && ex.size > 0) {
    r.erro = "listagem vazia inesperada para loja com produtos";
    await p.registrarErro(r.erro, { existentes: ex.size });
    return r; // proteção contra resposta vazia falsa da API
  }
  // Só após as 3 situações terem sido totalmente verificadas.
  const ausentes = [...ex.keys()].filter((id) => !vistos.has(id) && ex.get(id)!.situacao !== "ausente");
  if (ausentes.length) {
    await p.marcarAusentes(ausentes);
    r.ausentes = ausentes.length;
  }
  r.completo = true;
  return r;
}
