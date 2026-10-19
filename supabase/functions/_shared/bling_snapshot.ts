// Backup versionado do cadastro do Bling. SOMENTE LEITURA do Bling: as portas de coleta só têm métodos de leitura.
// Lógica pura sobre portas (testável sem Supabase nem rede). Caminhos da API v3 marcados "conferido: false" no doc
// docs/conector-ia/bling-referencia-do-conector.md: conferir antes de confiar em produção.
// O snapshot contém custo e fornecedor: nunca expor ao site público nem às ferramentas dos agentes.

// deno-lint-ignore no-explicit-any
export type Json = any;

/** As 59 colunas da planilha de exportação de produtos do Bling (arquivo de 2026-10-19), na ordem original. */
export const COLUNAS_BLING = [
  "ID", "Código", "Descrição", "Unidade", "NCM", "Origem", "Preço", "Valor IPI fixo", "Observações", "Situação", "Estoque", "Preço de custo",
  "Cód. no fornecedor", "Fornecedor", "Localização", "Estoque máximo", "Estoque mínimo", "Peso líquido (Kg)", "Peso bruto (Kg)", "GTIN/EAN",
  "GTIN/EAN da Embalagem", "Largura do produto", "Altura do Produto", "Profundidade do produto", "Data Validade", "Descrição do Produto no Fornecedor",
  "Descrição Complementar", "Itens p/ caixa", "Produto Variação", "Tipo Produção", "Classe de enquadramento do IPI", "Código na Lista de Serviços",
  "Tipo do item", "Grupo de Tags/Tags", "Tributos", "Código Pai", "Código Integração", "Grupo de produtos", "Marca", "CEST", "Volumes",
  "Descrição Curta", "Cross-Docking", "URL Imagens Externas", "Link Externo", "Meses Garantia no Fornecedor", "Clonar dados do pai",
  "Condição do Produto", "Frete Grátis", "Número FCI", "Vídeo", "Departamento", "Unidade de Medida", "Preço de Compra",
  "Valor base ICMS ST para retenção", "Valor ICMS ST para retenção", "Valor ICMS próprio do substituto", "Categoria do produto", "Informações Adicionais",
] as const;

/** Número no padrão do Bling: ponto de milhar e vírgula decimal ("12.000,000000"). Ausente ou inválido vira zero. */
export function numeroBling(v: unknown, casas: number): string {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : 0;
  const [int, dec] = (Number.isFinite(n) ? n : 0).toFixed(casas).split(".");
  const neg = int.startsWith("-");
  const corpo = (neg ? int.slice(1) : int).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${corpo}${dec ? "," + dec : ""}`;
}

const txt = (v: unknown): string => (v == null ? "" : String(v));
const SITUACAO: Record<string, string> = { A: "Ativo", I: "Inativo", E: "Excluído" };
const PRODUCAO: Record<string, string> = { P: "Própria", T: "Terceiros" };
const CONDICAO: Record<string, string> = { "0": "NÃO ESPECIFICADO", "1": "NOVO", "2": "USADO" };
const MEDIDA: Record<string, string> = { "0": "Metros", "1": "Centímetro", "2": "Milímetro" };

export interface ContextoCsv { categorias: Map<string, string>; fornecedores: Map<string, string> }

/** Uma linha (59 valores) no formato do Bling a partir do JSON da API e dos vínculos de fornecedor. */
export function linhaBling(p: Json, vinculos: Json[], ctx: ContextoCsv): string[] {
  const t = p?.tributacao ?? {};
  const vin = (vinculos ?? []).find((v) => v?.padrao === true) ?? (vinculos ?? [])[0] ?? null;
  const validade = txt(p?.dataValidade);
  const imagens = Array.isArray(p?.midia?.imagens?.externas) ? p.midia.imagens.externas.map((i: Json) => txt(i?.link)).filter(Boolean).join("|") : "";
  const tags = Array.isArray(p?.tags) ? p.tags.map((x: Json) => txt(typeof x === "string" ? x : x?.nome)).filter(Boolean).join(",") : "";
  const catId = p?.categoria?.id ? String(p.categoria.id) : "";
  const fornId = vin?.fornecedor?.id ? String(vin.fornecedor.id) : "";
  const valores: Record<(typeof COLUNAS_BLING)[number], string> = {
    "ID": txt(p?.id),
    "Código": `${txt(p?.codigo)}\t`,
    "Descrição": txt(p?.nome),
    "Unidade": txt(p?.unidade),
    "NCM": txt(t.ncm),
    "Origem": txt(t.origem ?? 0),
    "Preço": numeroBling(p?.preco, 6),
    "Valor IPI fixo": numeroBling(t.valorIpiFixo, 2),
    "Observações": txt(p?.observacoes),
    "Situação": SITUACAO[txt(p?.situacao)] ?? txt(p?.situacao),
    "Estoque": numeroBling(p?.estoque?.saldoVirtualTotal, 7),
    "Preço de custo": numeroBling(vin?.precoCusto, 6),
    "Cód. no fornecedor": `\t${txt(vin?.codigo)}`,
    "Fornecedor": fornId ? ctx.fornecedores.get(fornId) ?? "" : "",
    "Localização": `\t${txt(p?.estoque?.localizacao)}`,
    "Estoque máximo": numeroBling(p?.estoque?.maximo, 2),
    "Estoque mínimo": numeroBling(p?.estoque?.minimo, 2),
    "Peso líquido (Kg)": numeroBling(p?.pesoLiquido, 5),
    "Peso bruto (Kg)": numeroBling(p?.pesoBruto, 5),
    "GTIN/EAN": `\t${txt(p?.gtin)}`,
    "GTIN/EAN da Embalagem": `\t${txt(p?.gtinEmbalagem)}`,
    "Largura do produto": numeroBling(p?.dimensoes?.largura, 2),
    "Altura do Produto": numeroBling(p?.dimensoes?.altura, 2),
    "Profundidade do produto": numeroBling(p?.dimensoes?.profundidade, 2),
    "Data Validade": validade.startsWith("0000") ? "" : validade,
    "Descrição do Produto no Fornecedor": txt(vin?.descricao),
    "Descrição Complementar": txt(p?.descricaoComplementar),
    "Itens p/ caixa": numeroBling(p?.itensPorCaixa, 2),
    "Produto Variação": "",
    "Tipo Produção": PRODUCAO[txt(p?.tipoProducao)] ?? txt(p?.tipoProducao),
    "Classe de enquadramento do IPI": txt(t.classeEnquadramentoIpi),
    "Código na Lista de Serviços": txt(t.codigoListaServicos),
    "Tipo do item": txt(t.spedTipoItem),
    "Grupo de Tags/Tags": tags,
    "Tributos": numeroBling(t.percentualTributos, 2),
    "Código Pai": "",
    "Código Integração": "",
    "Grupo de produtos": t.grupoProduto?.id ? String(t.grupoProduto.id) : "",
    "Marca": txt(p?.marca),
    "CEST": txt(t.cest),
    "Volumes": numeroBling(p?.volumes, 0),
    "Descrição Curta": txt(p?.descricaoCurta),
    "Cross-Docking": numeroBling(p?.estoque?.crossdocking, 0),
    "URL Imagens Externas": imagens,
    "Link Externo": txt(p?.linkExterno),
    "Meses Garantia no Fornecedor": numeroBling(vin?.garantia, 0),
    "Clonar dados do pai": "NÃO",
    "Condição do Produto": CONDICAO[txt(p?.condicao ?? "0")] ?? "NÃO ESPECIFICADO",
    "Frete Grátis": p?.freteGratis === true ? "SIM" : "NÃO",
    "Número FCI": txt(t.nFCI),
    "Vídeo": txt(p?.midia?.video?.url),
    "Departamento": "",
    "Unidade de Medida": MEDIDA[txt(p?.dimensoes?.unidadeMedida ?? "0")] ?? "Metros",
    "Preço de Compra": numeroBling(vin?.precoCompra, 6),
    "Valor base ICMS ST para retenção": numeroBling(t.valorBaseStRetencao, 4),
    "Valor ICMS ST para retenção": numeroBling(t.valorStRetencao, 4),
    "Valor ICMS próprio do substituto": numeroBling(t.valorICMSSubstituto, 4),
    "Categoria do produto": catId ? ctx.categorias.get(catId) ?? "" : "",
    "Informações Adicionais": txt(t.dadosAdicionais),
  };
  return COLUNAS_BLING.map((c) => valores[c]);
}

const aspas = (s: string) => `"${s.replace(/"/g, '""')}"`;
/** CSV no formato do Bling: ponto e vírgula, todos os campos entre aspas, UTF-8. */
export function csvBling(linhas: string[][]): string {
  return [COLUNAS_BLING.map(aspas).join(";"), ...linhas.map((l) => l.map(aspas).join(";"))].join("\n") + "\n";
}

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto (e o mesmo hash). */
export function jsonEstavel(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${jsonEstavel(v[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
export async function hashProduto(produto: Json, vinculos: Json[]): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jsonEstavel({ produto, vinculos }))));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Comparacao { novos: string[]; alterados: string[]; removidos: string[] }
/** Compara o snapshot guardado com o que o Bling devolve agora (id -> hash). Serve para atualizar quando o Bling volta. */
export function compararHashes(guardado: Map<string, string>, vivo: Map<string, string>): Comparacao {
  const novos = [...vivo.keys()].filter((id) => !guardado.has(id));
  const alterados = [...vivo.keys()].filter((id) => guardado.has(id) && guardado.get(id) !== vivo.get(id));
  const removidos = [...guardado.keys()].filter((id) => !vivo.has(id));
  return { novos, alterados, removidos };
}

export interface ProdutoColetado { bling_id: string; codigo: string | null; json_produto: Json; json_vinculos: Json[]; hash: string }
export interface PortasBackup {
  /** Páginas de ids (ativos e inativos). Só leitura. */
  listarProdutos(situacao: "ativos" | "inativos", pagina: number, limite: number): Promise<{ itens: { id: number; codigo?: string }[] } | { erro: string }>;
  detalhe(id: number): Promise<Json | null>;
  vinculos(id: number): Promise<Json[] | null>;
  categorias(pagina: number, limite: number): Promise<{ itens: { id: number; descricao: string; categoriaPai?: { id?: number } }[] } | { erro: string }>;
  contato(id: number): Promise<{ id: number; nome: string; numeroDocumento?: string } | null>;
  /** Persistência (nosso banco). */
  iniciar(origem: "manual" | "diario"): Promise<string>;
  gravar(snapshotId: string, lote: { produtos: ProdutoColetado[]; categorias: { bling_id: string; nome: string; pai_bling_id: string | null }[]; contatos: { bling_id: string; nome: string; documento: string | null }[] }): Promise<void>;
  concluir(snapshotId: string, status: "completo" | "parcial" | "falhou", erro?: string): Promise<void>;
  podar(): Promise<void>;
  espera(ms: number): Promise<void>;
  agora(): number;
}
export interface ResultadoBackup { snapshotId: string; status: "completo" | "parcial" | "falhou"; produtos: number; categorias: number; contatos: number; erro?: string }

const LIMITE = 100, INTERVALO_MS = 350, LOTE = 20;

/** Coleta tudo (só leitura do Bling) e guarda. Nunca lança: o resultado diz se ficou completo, parcial ou falhou. */
export async function executarBackup(origem: "manual" | "diario", p: PortasBackup, orcamentoMs = 100_000): Promise<ResultadoBackup> {
  const ini = p.agora();
  const snapshotId = await p.iniciar(origem);
  const r: ResultadoBackup = { snapshotId, status: "completo", produtos: 0, categorias: 0, contatos: 0 };
  const estourou = () => p.agora() - ini > orcamentoMs;
  const falha = async (erro: string, parcial: boolean) => {
    r.status = parcial ? "parcial" : "falhou"; r.erro = erro.slice(0, 300);
    await p.concluir(snapshotId, r.status, r.erro);
    return r;
  };
  try {
    // 1) categorias
    const categorias: { bling_id: string; nome: string; pai_bling_id: string | null }[] = [];
    for (let pg = 1; ; pg++) {
      const c = await p.categorias(pg, LIMITE); await p.espera(INTERVALO_MS);
      if ("erro" in c) return await falha(c.erro, false);
      for (const i of c.itens) categorias.push({ bling_id: String(i.id), nome: i.descricao, pai_bling_id: i.categoriaPai?.id ? String(i.categoriaPai.id) : null });
      if (c.itens.length < LIMITE) break;
    }
    await p.gravar(snapshotId, { produtos: [], categorias, contatos: [] }); r.categorias = categorias.length;

    // 2) produtos (ativos e inativos), com vínculos de fornecedor; contatos dos fornecedores citados
    const ids: number[] = [];
    for (const situacao of ["ativos", "inativos"] as const) {
      for (let pg = 1; ; pg++) {
        const l = await p.listarProdutos(situacao, pg, LIMITE); await p.espera(INTERVALO_MS);
        if ("erro" in l) return await falha(l.erro, false);
        ids.push(...l.itens.map((i) => i.id));
        if (l.itens.length < LIMITE) break;
      }
    }
    const fornecedores = new Set<number>();
    let lote: ProdutoColetado[] = [];
    const descarregar = async () => { if (lote.length) { await p.gravar(snapshotId, { produtos: lote, categorias: [], contatos: [] }); r.produtos += lote.length; lote = []; } };
    for (const id of [...new Set(ids)]) {
      if (estourou()) { await descarregar(); return await falha("tempo esgotado antes de terminar a coleta", true); }
      const d = await p.detalhe(id); await p.espera(INTERVALO_MS);
      if (!d) { await descarregar(); return await falha(`detalhe do produto ${id} indisponível`, true); }
      const v = (await p.vinculos(id)) ?? []; await p.espera(INTERVALO_MS);
      for (const x of v) if (x?.fornecedor?.id) fornecedores.add(Number(x.fornecedor.id));
      lote.push({ bling_id: String(id), codigo: d?.codigo ? String(d.codigo) : null, json_produto: d, json_vinculos: v, hash: await hashProduto(d, v) });
      if (lote.length >= LOTE) await descarregar();
    }
    await descarregar();
    const contatos: { bling_id: string; nome: string; documento: string | null }[] = [];
    for (const fid of fornecedores) {
      if (estourou()) { await p.gravar(snapshotId, { produtos: [], categorias: [], contatos }); r.contatos = contatos.length; return await falha("tempo esgotado ao ler os fornecedores", true); }
      const c = await p.contato(fid); await p.espera(INTERVALO_MS);
      if (c) contatos.push({ bling_id: String(c.id), nome: c.nome, documento: c.numeroDocumento ? String(c.numeroDocumento) : null });
    }
    await p.gravar(snapshotId, { produtos: [], categorias: [], contatos }); r.contatos = contatos.length;
    await p.concluir(snapshotId, "completo");
    await p.podar();
    return r;
  } catch (e) {
    return await falha(e instanceof Error ? e.message : "falha inesperada no backup", r.produtos > 0);
  }
}
